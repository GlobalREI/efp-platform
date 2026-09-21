/**
 * tmApi — Transfermarkt API helpers
 *
 * All calls route through /api/transfermarkt.

 * In production: Netlify Functions (via redirects in netlify.toml).
 * In development: run `netlify dev` — it starts Vite + functions together.
 */

export interface TmPlayer {
  id: string
  name: string
  position: string
  age: string
  nationality: string
  club: string
  marketValue: string
  profileUrl: string
  imageUrl: string
}

export interface TmClub {
  id: string
  name: string
  league: string
  country: string
  squadSize: string
  avgAge: string
  marketValue: string
  logoUrl: string
  profileUrl: string
}

const BASE = '/api/transfermarkt'

/** Search TM for players by name */
export async function searchTmPlayers(query: string): Promise<TmPlayer[]> {
  if (!query || query.length < 2) return []
  const res = await fetch(`${BASE}?q=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error(`TM player search failed (${res.status})`)
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return (data.results ?? []) as TmPlayer[]
}

/** Search TM for clubs by name */
export async function searchTmClubs(query: string): Promise<TmClub[]> {
  if (!query || query.length < 2) return []
  const res = await fetch(`${BASE}/club-search?q=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error(`TM club search failed (${res.status})`)
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return (data.clubs ?? []) as TmClub[]
}

/** Filter players by position, age range, and market value range */
export function filterTmPlayers(
  players: TmPlayer[],
  opts: { position?: string; ageMin?: number; ageMax?: number; mvMin?: number; mvMax?: number }
): TmPlayer[] {
  return players.filter(p => {
    const age = parseInt(p.age, 10)
    const mv = parseTmValue(p.marketValue)

    if (opts.position && !p.position.toLowerCase().includes(opts.position.toLowerCase())) return false
    if (opts.ageMin && !isNaN(age) && age < opts.ageMin) return false
    if (opts.ageMax && !isNaN(age) && age > opts.ageMax) return false
    if (opts.mvMin && mv !== null && mv < opts.mvMin) return false
    if (opts.mvMax && mv !== null && mv > opts.mvMax) return false
    return true
  })
}

/** Parse TM market value string like "€4.5m" or "€850k" → number in millions */
export function parseTmValue(val: string): number | null {
  if (!val) return null
  const s = val.replace(/[€£$,\s]/g, '').toLowerCase()
  const numMatch = s.match(/(\d+\.?\d*)([mk]?)/)
  if (!numMatch) return null
  const n = parseFloat(numMatch[1])
  const suffix = numMatch[2]
  if (suffix === 'm' || s.includes('m')) return n
  if (suffix === 'k' || s.includes('k') || s.includes('th')) return n / 1000
  // bare number — assume millions if > 100, else as-is
  return n > 100 ? n / 1_000_000 : n
}

/** Fetch agent / agency name for a player by TM ID (uses the per-player detail endpoint) */
export async function fetchTmPlayerAgent(id: string): Promise<string> {
  try {
    const res = await fetch(`${BASE}/player/${id}`)
    if (!res.ok) return ''
    const data = await res.json()
    return (data.player?.current_agent as string) || ''
  } catch {
    return ''
  }
}

/** Format millions as "€4.5M" */
export function formatTmValue(millions: number | null): string {
  if (millions === null) return '—'
  if (millions >= 1) return `€${millions % 1 === 0 ? millions : millions.toFixed(1)}M`
  return `€${Math.round(millions * 1000)}K`
}
