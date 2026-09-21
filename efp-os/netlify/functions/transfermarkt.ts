/**
 * Netlify Function: /api/transfermarkt?q=...
 * Searches Transfermarkt for players by name.
 * Mirrors the efp-ops Next.js route at /api/transfermarkt/route.ts
 */
import { parse } from 'node-html-parser'

const TM_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Referer': 'https://www.transfermarkt.com/',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'same-origin',
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
    const res = await fetch(url, { headers: TM_HEADERS })

    if (!res.ok) {
      return {
        statusCode: 502,
        headers: CORS,
        body: JSON.stringify({ error: `Transfermarkt returned ${res.status}` }),
      }
    }

    const html = await res.text()
    const root = parse(html)

    const results: {
      id: string; name: string; position: string; age: string
      nationality: string; club: string; marketValue: string
      profileUrl: string; imageUrl: string
    }[] = []

    const sections = root.querySelectorAll('.box')
    for (const section of sections) {
      const header = section.querySelector('.content-box-headline')
      if (!header) continue
      const headerText = header.text.trim().toLowerCase()
      if (!headerText.includes('player') && !headerText.includes('spieler')) continue

      const rows = section.querySelectorAll('table.items tbody tr')
      for (const row of rows) {
        if (!row.classList.contains('odd') && !row.classList.contains('even')) continue
        const cells = row.querySelectorAll('td')
        if (cells.length < 3) continue

        const nameEl = row.querySelector('.hauptlink a')
        if (!nameEl) continue
        const name = nameEl.text.trim()
        const href = nameEl.getAttribute('href') || ''
        const profileUrl = href ? `https://www.transfermarkt.com${href}` : ''
        const idMatch = href.match(/\/spieler\/(\d+)/)
        const id = idMatch ? idMatch[1] : ''
        const img = row.querySelector('img')
        const imageUrl = img?.getAttribute('data-src') || img?.getAttribute('src') || ''

        let age = '', nationality = '', club = '', marketValue = ''

        for (let i = 0; i < cells.length; i++) {
          const text = cells[i].text.trim()
          if (!age && /^\d{2}$/.test(text) && parseInt(text) >= 14 && parseInt(text) <= 45) age = text
          if (!marketValue && /[€£$]/.test(text) && (text.includes('m') || text.includes('k') || text.includes('Th'))) marketValue = text
          const flagImg = cells[i].querySelector('img.flaggenrahmen, img[src*="flagge"]')
          if (!nationality && flagImg) nationality = flagImg.getAttribute('title') || flagImg.getAttribute('alt') || ''
          const clubLink = cells[i].querySelector('a[href*="/startseite/verein/"]')
          if (!club && clubLink) club = clubLink.text.trim()
        }

        let position = ''
        const subRows = row.querySelectorAll('table tr')
        if (subRows.length > 1) position = subRows[1]?.querySelector('td')?.text?.trim() || ''

        if (name && id) results.push({ id, name, position, age, nationality, club, marketValue, profileUrl, imageUrl })
      }
    }

    // Fallback: simpler row selector
    if (results.length === 0) {
      const allRows = root.querySelectorAll('table.items tr.odd, table.items tr.even')
      for (const row of allRows) {
        const nameEl = row.querySelector('.hauptlink a')
        if (!nameEl) continue
        const name = nameEl.text.trim()
        const href = nameEl.getAttribute('href') || ''
        const profileUrl = href ? `https://www.transfermarkt.com${href}` : ''
        const idMatch = href.match(/\/spieler\/(\d+)/)
        const id = idMatch ? idMatch[1] : ''
        const img = row.querySelector('img')
        const imageUrl = img?.getAttribute('data-src') || img?.getAttribute('src') || ''
        const cells = row.querySelectorAll('td')
        let age = '', nationality = '', club = '', marketValue = '', position = ''

        for (const cell of cells) {
          const text = cell.text.trim()
          if (!age && /^\d{2}$/.test(text) && parseInt(text) >= 14 && parseInt(text) <= 45) age = text
          if (!marketValue && /[€£$]/.test(text)) marketValue = text
          const flagImg = cell.querySelector('img.flaggenrahmen, img[src*="flagge"], img[title]')
          if (!nationality && flagImg) nationality = flagImg.getAttribute('title') || ''
          const clubLink = cell.querySelector('a[href*="verein"]')
          if (!club && clubLink) club = clubLink.text.trim()
        }
        const subRows = row.querySelectorAll('table tr')
        if (subRows.length > 1) position = subRows[1]?.querySelector('td')?.text?.trim() || ''

        if (name && id) results.push({ id, name, position, age, nationality, club, marketValue, profileUrl, imageUrl })
      }
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ results: results.slice(0, 10) }),
    }
  } catch (err) {
    console.error('TM player search error:', err)
    return {
      statusCode: 502,
      headers: CORS,
      body: JSON.stringify({ error: 'Failed to fetch from Transfermarkt' }),
    }
  }
}
