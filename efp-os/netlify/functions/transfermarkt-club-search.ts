/**
 * Netlify Function: /api/transfermarkt/club-search?q=...
 * Searches Transfermarkt for clubs by name.
 * Mirrors the efp-ops Next.js route at /api/transfermarkt/club-search/route.ts
 */
import { parse } from 'node-html-parser'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Referer': 'https://www.transfermarkt.com/',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'same-origin',
  'Cache-Control': 'no-cache',
}

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const handler = async (event: any) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' }
  }

  const query = event.queryStringParameters?.q || ''
  if (!query || query.length < 2) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Query too short' }) }
  }

  try {
    const url = `https://www.transfermarkt.com/schnellsuche/ergebnis/schnellsuche?query=${encodeURIComponent(query)}&x=0&y=0`
    const res = await fetch(url, { headers: HEADERS })

    if (!res.ok) {
      return {
        statusCode: 502,
        headers: CORS,
        body: JSON.stringify({ error: `TM returned ${res.status}` }),
      }
    }

    const html = await res.text()
    const root = parse(html)

    const clubs: {
      id: string; name: string; league: string; country: string
      squadSize: string; avgAge: string; marketValue: string
      logoUrl: string; profileUrl: string
    }[] = []

    const boxes = root.querySelectorAll('.box')
    for (const box of boxes) {
      const headline = box.querySelector('.content-box-headline')
      if (!headline) continue
      const ht = headline.text.toLowerCase()
      if (!ht.includes('club') && !ht.includes('verein') && !ht.includes('team')) continue

      const rows = box.querySelectorAll('table.items tbody tr.odd, table.items tbody tr.even')
      for (const row of rows) {
        const nameLink = row.querySelector('td.hauptlink a, a.vereinprofil_tooltip')
        if (!nameLink) continue
        const name = nameLink.text.trim()
        const href = nameLink.getAttribute('href') || ''
        const idMatch = href.match(/\/verein\/(\d+)/)
        if (!idMatch) continue
        const id = idMatch[1]
        const profileUrl = `https://www.transfermarkt.com${href.split('?')[0]}`

        const img = row.querySelector('img.tiny_wappen, img[src*="wappen"]')
        const logoUrl = img?.getAttribute('data-src') || img?.getAttribute('src') || ''

        const cells = row.querySelectorAll('td')
        let league = '', country = '', squadSize = '', avgAge = '', marketValue = ''

        for (const cell of cells) {
          const text = cell.text.trim()
          const leagueLink = cell.querySelector('a[href*="startseite/wettbewerb"], a[href*="liga"]')
          if (!league && leagueLink) league = leagueLink.text.trim()
          const flag = cell.querySelector('img.flaggenrahmen, img[src*="flagge"]')
          if (!country && flag) country = flag.getAttribute('title') || flag.getAttribute('alt') || ''
          if (!squadSize && /^\d{1,2}$/.test(text) && parseInt(text) > 10 && parseInt(text) < 60) squadSize = text
          if (!avgAge && /^\d{2}\.\d$/.test(text)) avgAge = text
          if (!marketValue && /[€£$]/.test(text) && (text.includes('m') || text.includes('bn') || text.includes('Bn'))) marketValue = text
        }

        if (name && id) clubs.push({ id, name, league, country, squadSize, avgAge, marketValue, logoUrl, profileUrl })
      }
    }

    // Fallback
    if (clubs.length === 0) {
      const allRows = root.querySelectorAll('table.items tr.odd, table.items tr.even')
      for (const row of allRows) {
        const nameLink = row.querySelector('a[href*="verein/"]')
        if (!nameLink) continue
        const href = nameLink.getAttribute('href') || ''
        const idMatch = href.match(/\/verein\/(\d+)/)
        if (!idMatch) continue
        const id = idMatch[1]
        const name = nameLink.text.trim()
        if (!name) continue
        const img = row.querySelector('img')
        const logoUrl = img?.getAttribute('data-src') || img?.getAttribute('src') || ''
        clubs.push({
          id, name, league: '', country: '', squadSize: '', avgAge: '', marketValue: '',
          logoUrl, profileUrl: `https://www.transfermarkt.com${href}`,
        })
      }
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ clubs: clubs.slice(0, 10) }),
    }
  } catch (err) {
    console.error('TM club search error:', err)
    return {
      statusCode: 502,
      headers: CORS,
      body: JSON.stringify({ error: 'Failed to search Transfermarkt' }),
    }
  }
}
