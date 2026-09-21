/**
 * Netlify Function: /api/transfermarkt/player/:id
 * Fetches detailed player profile from Transfermarkt.
 * Called via redirect in netlify.toml: /api/transfermarkt/player/:id → ?id=:id
 * Mirrors the efp-ops Next.js route at /api/transfermarkt/player/[id]/route.ts
 */
import { parse } from 'node-html-parser'

const TM_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Referer': 'https://www.transfermarkt.com/',
}

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
}

function mapPosition(tmPosition: string): string {
  const lower = tmPosition.toLowerCase()
  if (lower.includes('goalkeeper') || lower.includes('keeper')) return 'GK'
  if (lower.includes('centre-back') || lower.includes('center-back') || lower.includes('central defender')) return 'CB'
  if (lower.includes('right-back') || lower.includes('right back')) return 'RB'
  if (lower.includes('left-back') || lower.includes('left back')) return 'LB'
  if (lower.includes('defensive midfield')) return 'CDM'
  if (lower.includes('central midfield') || lower.includes('centre midfield')) return 'CM'
  if (lower.includes('attacking midfield')) return 'CAM'
  if (lower.includes('right wing') || lower.includes('right winger')) return 'RW'
  if (lower.includes('left wing') || lower.includes('left winger')) return 'LW'
  if (lower.includes('striker') || lower.includes('centre-forward') || lower.includes('center-forward')) return 'ST'
  if (lower.includes('attack')) return 'ST'
  if (lower.includes('midfield')) return 'CM'
  if (lower.includes('defender') || lower.includes('defence')) return 'CB'
  return ''
}

function parseMarketValue(val: string): number {
  if (!val) return 0
  const clean = val.replace(/[€£$\s,]/g, '')
  const mMatch = clean.match(/([\d.]+)m/i)
  if (mMatch) return Math.round(parseFloat(mMatch[1]) * 1_000_000)
  const kMatch = clean.match(/([\d.]+)(k|th)/i)
  if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1_000)
  const num = parseFloat(clean.replace(/[^\d.]/g, ''))
  return isNaN(num) ? 0 : num
}

function parseHeight(h: string): number {
  if (!h) return 0
  const m = h.replace(',', '.').match(/([\d.]+)/)
  if (!m) return 0
  const val = parseFloat(m[1])
  if (val < 10) return Math.round(val * 100)
  return Math.round(val)
}

function parseContractDate(str: string): string {
  if (!str) return ''
  str = str.trim()
  const longMatch = str.match(/(\w{3})\s+(\d{1,2}),?\s+(\d{4})/)
  if (longMatch) {
    const months: Record<string, string> = { Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12' }
    const m = months[longMatch[1]]
    if (m) return `${longMatch[3]}-${m}-${longMatch[2].padStart(2, '0')}`
  }
  const shortMatch = str.match(/(\d{2})[./](\d{2})[./](\d{4})/)
  if (shortMatch) return `${shortMatch[3]}-${shortMatch[2]}-${shortMatch[1]}`
  const yearMatch = str.match(/^(\d{4})$/)
  if (yearMatch) return `${yearMatch[1]}-06-30`
  return ''
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const handler = async (event: any) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' }
  }

  // ID comes from the redirect query param: /api/transfermarkt/player/:id → ?id=:id
  const id = event.queryStringParameters?.id || ''
  if (!id || !/^\d+$/.test(id)) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid player ID' }) }
  }

  try {
    const profileUrl = `https://www.transfermarkt.com/player/profil/spieler/${id}`
    const ceapiUrl = `https://www.transfermarkt.com/ceapi/marketValueDevelopment/graph/${id}`

    const [profileRes, mvRes] = await Promise.allSettled([
      fetch(profileUrl, { headers: TM_HEADERS }),
      fetch(ceapiUrl, {
        headers: { ...TM_HEADERS, 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' },
      }),
    ])

    if (profileRes.status === 'rejected' || !profileRes.value.ok) {
      return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: 'Could not load player profile' }) }
    }

    const html = await profileRes.value.text()
    const root = parse(html)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = { tm_id: id }

    const h1 = root.querySelector('h1.data-header__headline-wrapper--no-logo, h1[itemprop="name"]')
    data.name = h1?.querySelector('strong')?.text?.trim() || h1?.text?.trim() || ''
    data.name = (data.name as string).replace(/\s+/g, ' ').replace(/^\d+\s*/, '').trim()

    const infoTable = root.querySelector('.info-table, .auflistung')
    if (infoTable) {
      const items = infoTable.querySelectorAll('li, tr')
      for (const item of items) {
        const label = item.querySelector('.info-table__content--regular, th, .data-header__label')?.text?.trim().toLowerCase() || ''
        const value = item.querySelector('.info-table__content--bold, td:last-child, .data-header__content')?.text?.trim() || ''

        if (label.includes('date of birth') || label.includes('dob') || label.includes('born')) {
          const ageMatch = value.match(/\((\d+)\)/)
          if (ageMatch) data.age = parseInt(ageMatch[1])
          const dobMatch = value.match(/(\w+ \d+, \d{4}|\d{2}\.\d{2}\.\d{4})/)
          if (dobMatch) data.date_of_birth = dobMatch[1]
        }
        if (label.includes('height')) data.height_cm = parseHeight(value)
        if (label.includes('position')) { data.position_raw = value; data.position = mapPosition(value) }
        if (label.includes('foot')) {
          const foot = value.toLowerCase()
          data.foot = foot.includes('right') ? 'Right' : foot.includes('left') ? 'Left' : foot.includes('both') ? 'Both' : value
        }
        if (label.includes('citizenship') || label.includes('nationality')) {
          const flags = item.querySelectorAll('img.flaggenrahmen')
          data.nationality = flags.length > 0
            ? flags.map((f: any) => f.getAttribute('title') || '').filter(Boolean).join('/')
            : value
        }
        if (label.includes('current club') || label.includes('club')) {
          const clubLink = item.querySelector('a[href*="verein"]')
          data.current_club = clubLink?.text?.trim() || value
        }
        if (label.includes('contract expires') || label.includes('contract until') || label.includes('contract')) {
          const contractDate = parseContractDate(value)
          if (contractDate) data.contract_expiry = contractDate
        }
        if (label.includes('player agent') || label.includes('agent')) data.current_agent = value
      }
    }

    const header = root.querySelector('.data-header__details')
    if (header) {
      const spans = header.querySelectorAll('.data-header__label, .data-header__content')
      let currentLabel = ''
      for (const span of spans) {
        const text = span.text.trim()
        if (span.classList.contains('data-header__label')) {
          currentLabel = text.toLowerCase()
        } else if (currentLabel && text) {
          if (currentLabel.includes('date of birth') && !data.age) {
            const ageMatch = text.match(/\((\d+)\)/)
            if (ageMatch) data.age = parseInt(ageMatch[1])
          }
          if (currentLabel.includes('citizenship') && !data.nationality) {
            const flags = span.querySelectorAll('img')
            data.nationality = flags.length > 0
              ? flags.map((f: any) => f.getAttribute('title') || '').filter(Boolean).join('/')
              : text
          }
          if (currentLabel.includes('height') && !data.height_cm) data.height_cm = parseHeight(text)
          if (currentLabel.includes('position') && !data.position) { data.position_raw = text; data.position = mapPosition(text) }
          if ((currentLabel.includes('agent') || currentLabel.includes('player agent')) && !data.current_agent) data.current_agent = text
          if (currentLabel.includes('contract') && !data.contract_expiry) {
            const d = parseContractDate(text)
            if (d) data.contract_expiry = d
          }
        }
      }
    }

    const mvEl = root.querySelector('.data-header__market-value-wrapper, .tm-player-market-value-development__current-value')
    if (mvEl) {
      const mvText = mvEl.text.trim()
      data.market_value_raw = mvText
      data.est_transfer_value = parseMarketValue(mvText)
    }

    if (mvRes.status === 'fulfilled' && mvRes.value.ok) {
      try {
        const mvData = await mvRes.value.json()
        if (mvData?.currentValue) {
          data.est_transfer_value = parseInt(mvData.currentValue) || data.est_transfer_value
          data.market_value_raw = `€${(parseInt(mvData.currentValue) / 1_000_000).toFixed(1)}m`
        }
        if (mvData?.list && Array.isArray(mvData.list) && mvData.list.length > 0) {
          const latest = mvData.list[mvData.list.length - 1]
          if (latest?.mw) { data.est_transfer_value = parseMarketValue(latest.mw); data.market_value_raw = latest.mw }
          if (latest?.verein && !data.current_club) data.current_club = latest.verein
        }
      } catch {
        // JSON parse failed — use scraped value
      }
    }

    if (!data.current_club) {
      const clubEl = root.querySelector('.data-header__club a, .data-header__club-name')
      data.current_club = clubEl?.text?.trim() || ''
    }

    if (!data.position) {
      const sub = root.querySelector('.data-header__headline-wrapper .data-header__position')
      if (sub) { data.position_raw = sub.text.trim(); data.position = mapPosition(sub.text.trim()) }
    }

    const playerImg = root.querySelector('.data-header__profile-image, img.data-header__headshot, img[itemprop="image"]')
    data.image_url = playerImg?.getAttribute('src') || playerImg?.getAttribute('data-src') || ''
    data.profile_url = `https://www.transfermarkt.com/player/profil/spieler/${id}`

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ player: data }) }
  } catch (err) {
    console.error('TM player fetch error:', err)
    return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: 'Failed to fetch player data' }) }
  }
}
