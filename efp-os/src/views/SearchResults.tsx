/**
 * SearchResults — global cross-entity search
 *
 * Reads all entities simultaneously from Firebase and filters client-side.
 * URL param: ?q=<query>
 * Entities: mandates, clubs, contacts, needs, pitches
 */
import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ref, onValue, off } from 'firebase/database'
import { db } from '../data/firebase'
import styles from './SearchResults.module.css'

/* ── tiny result type ── */
interface Result {
  entity: 'mandate' | 'club' | 'contact' | 'need' | 'pitch'
  id: string
  title: string
  sub: string
  path: string
}

const ENTITY_ICON: Record<string, string> = {
  mandate: '⚽',
  club:    '🏟',
  contact: '👤',
  need:    '📋',
  pitch:   '📨',
}

const ENTITY_LABEL: Record<string, string> = {
  mandate: 'Player',
  club:    'Club',
  contact: 'Contact',
  need:    'Club Need',
  pitch:   'Pitch',
}

export function SearchResults() {
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()

  const [query,    setQuery]    = useState(params.get('q') || '')
  const [input,    setInput]    = useState(params.get('q') || '')

  const [mandates, setMandates] = useState<any[]>([])
  const [clubs,    setClubs]    = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [needs,    setNeeds]    = useState<any[]>([])
  const [pitches,  setPitches]  = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)

  /* ── load all entities once ── */
  useEffect(() => {
    let done = 0
    const check = () => { done++; if (done === 5) setLoading(false) }

    const sub = (path: string, setter: (r: any[]) => void, isArray = false) => {
      const r = ref(db, path)
      const h = (snap: any) => {
        if (!snap.exists()) { setter([]); check(); return }
        const raw = snap.val()
        setter(
          isArray
            ? (Array.isArray(raw) ? raw.map((v: any, i: number) => ({ id: String(i), ...v }))
                                  : Object.entries(raw).map(([id, v]: any) => ({ id, ...v })))
            : Object.entries(raw).map(([id, v]: any) => ({ id, ...v }))
        )
        check()
      }
      onValue(r, h)
      return () => off(r, 'value', h)
    }

    const u1 = sub('mandates', setMandates)
    const u2 = sub('clubs',    setClubs)
    const u3 = sub('contacts', setContacts)
    const u4 = sub('needs',    setNeeds)
    const u5 = sub('pitches',  setPitches, true)

    return () => { u1(); u2(); u3(); u4(); u5() }
  }, [])

  /* ── search ── */
  const results = useMemo((): Result[] => {
    if (!query.trim()) return []
    const q = query.toLowerCase()

    const out: Result[] = []

    mandates.forEach(m => {
      const name = m.player || m.name || ''
      if ([name, m.pos, m.club, m.contact].some((s: string) => s?.toLowerCase().includes(q)))
        out.push({ entity: 'mandate', id: m.id, title: name, sub: [m.pos, m.club].filter(Boolean).join(' · '), path: `/mandates/${m.id}` })
    })

    clubs.forEach(c => {
      if ([c.name, c.league, c.country].some((s: string) => s?.toLowerCase().includes(q)))
        out.push({ entity: 'club', id: c.id, title: c.name, sub: [c.league, c.status].filter(Boolean).join(' · '), path: `/clubs/${c.id}` })
    })

    contacts.forEach(c => {
      if ([c.name, c.role, c.club, c.email].some((s: string) => s?.toLowerCase().includes(q)))
        out.push({ entity: 'contact', id: c.id, title: c.name, sub: [c.role, c.club].filter(Boolean).join(' · '), path: `/contacts/${c.id}` })
    })

    needs.forEach(n => {
      const positions = n.positions?.join(', ') || n.pos || ''
      if ([n.club, positions, n.league].some((s: string) => s?.toLowerCase().includes(q)))
        out.push({ entity: 'need', id: n.id, title: n.club || 'Club Need', sub: [positions, n.budget].filter(Boolean).join(' · '), path: `/needs/${n.id}` })
    })

    pitches.forEach(p => {
      if ([p.player, p.club, p.contact, p.pos].some((s: string) => s?.toLowerCase().includes(q)))
        out.push({ entity: 'pitch', id: String(p.id), title: p.player || 'Unknown', sub: [p.club, p.stage].filter(Boolean).join(' · '), path: `/pitches/${p.id}` })
    })

    return out
  }, [query, mandates, clubs, contacts, needs, pitches])

  /* group by entity */
  const grouped = useMemo(() => {
    const g: Record<string, Result[]> = {}
    results.forEach(r => {
      if (!g[r.entity]) g[r.entity] = []
      g[r.entity].push(r)
    })
    return g
  }, [results])

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    setQuery(input)
    setParams({ q: input })
  }

  return (
    <div className={styles.page}>
      {/* Search bar */}
      <form className={styles.searchForm} onSubmit={submitSearch}>
        <span className={styles.searchIcon}>🔍</span>
        <input
          className={styles.searchInput}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Search players, clubs, contacts, needs, pitches…"
          autoFocus
        />
        {input && (
          <button type="button" className={styles.clearBtn} onClick={() => { setInput(''); setQuery(''); setParams({}) }}>✕</button>
        )}
      </form>

      {/* Loading */}
      {loading && (
        <div className={styles.status}>Loading data…</div>
      )}

      {/* No query */}
      {!loading && !query && (
        <div className={styles.hint}>
          <span className={styles.hintIcon}>🔍</span>
          <p>Search across all players, clubs, contacts, needs and pitches</p>
        </div>
      )}

      {/* No results */}
      {!loading && query && results.length === 0 && (
        <div className={styles.hint}>
          <span className={styles.hintIcon}>∅</span>
          <p>No results for <strong>"{query}"</strong></p>
        </div>
      )}

      {/* Results */}
      {!loading && results.length > 0 && (
        <div className={styles.results}>
          <div className={styles.resultCount}>{results.length} result{results.length !== 1 ? 's' : ''} for "{query}"</div>

          {(['mandate','club','contact','need','pitch'] as const).map(entity => {
            const group = grouped[entity]
            if (!group?.length) return null
            return (
              <div key={entity} className={styles.group}>
                <div className={styles.groupHeader}>
                  <span>{ENTITY_ICON[entity]}</span>
                  <span>{ENTITY_LABEL[entity]}s</span>
                  <span className={styles.groupCount}>{group.length}</span>
                </div>
                <div className={styles.groupItems}>
                  {group.map(r => (
                    <div key={r.id} className={styles.item} onClick={() => nav(r.path)}>
                      <div className={styles.itemTitle}>{r.title}</div>
                      {r.sub && <div className={styles.itemSub}>{r.sub}</div>}
                      <span className={styles.itemArrow}>→</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
