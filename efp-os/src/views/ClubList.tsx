/**
 * ClubList — all club profiles
 *
 * Reads: /clubs  →  { [id]: { name, league, country, flag, status, linkedContacts[], ... } }
 *
 * Features: search · league filter · status filter · click → /clubs/:id
 */
import { useEffect, useState, useMemo } from 'react'
import { useNavigate }  from 'react-router-dom'
import { ref, onValue, off } from 'firebase/database'
import { db }           from '../data/firebase'
import { PageHeader }   from '../components/PageHeader'
import styles from './ClubList.module.css'

interface Club {
  id: string
  name: string
  league?: string
  country?: string
  flag?: string
  status?: string
  linkedContacts?: { name: string; role: string }[]
  savedAt?: number
}

const STATUS_COLOR: Record<string, string> = {
  'Active':          '#10B981',
  'Strong':          '#10B981',
  'Building':        '#3B82F6',
  'Needs Attention': '#F59E0B',
  'Needs Follow-up': '#F59E0B',
  'Not Started':     '#CBD5E1',
}

export function ClubList() {
  const nav = useNavigate()

  const [clubs,   setClubs]   = useState<Club[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [league,  setLeague]  = useState('all')
  const [status,  setStatus]  = useState('all')

  useEffect(() => {
    const r = ref(db, 'clubs')
    const handler = (snap: any) => {
      if (!snap.exists()) { setClubs([]); setLoading(false); return }
      const rows: Club[] = Object.entries(snap.val()).map(([id, v]: [string, any]) => ({ id, ...v }))
      rows.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      setClubs(rows)
      setLoading(false)
    }
    onValue(r, handler)
    return () => off(r, 'value', handler)
  }, [])

  const leagues = useMemo(() => {
    const s = new Set<string>()
    clubs.forEach(c => { if (c.league) s.add(c.league) })
    return Array.from(s).sort()
  }, [clubs])

  const statuses = useMemo(() => {
    const s = new Set<string>()
    clubs.forEach(c => { if (c.status) s.add(c.status) })
    return Array.from(s).sort()
  }, [clubs])

  const rows = useMemo(() => clubs.filter(c => {
    if (league !== 'all' && c.league !== league) return false
    if (status !== 'all' && c.status !== status) return false
    if (search) {
      const q = search.toLowerCase()
      return [c.name, c.league, c.country].some(s => s?.toLowerCase().includes(q))
    }
    return true
  }), [clubs, league, status, search])

  const filters = (
    <div className={styles.filters}>
      <select className={styles.sel} value={league} onChange={e => setLeague(e.target.value)}>
        <option value="all">All Leagues</option>
        {leagues.map(l => <option key={l} value={l}>{l}</option>)}
      </select>
      <select className={styles.sel} value={status} onChange={e => setStatus(e.target.value)}>
        <option value="all">All Statuses</option>
        {statuses.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    </div>
  )

  if (loading) {
    return (
      <div className={styles.page}>
        <PageHeader title="Clubs" sub="Loading…" />
        <div className={styles.skeletonWrap}>
          {[...Array(8)].map((_, i) => <div key={i} className={styles.skeleton} />)}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="Clubs"
        sub={`${clubs.length} club${clubs.length !== 1 ? 's' : ''}`}
        search={{ value: search, onChange: setSearch, placeholder: 'Search clubs, leagues…' }}
        filters={filters}
      />

      {rows.length === 0 ? (
        <div className={styles.empty}>
          {search || league !== 'all' || status !== 'all'
            ? 'No clubs match the current filters.'
            : 'No clubs yet — add one from the main platform.'}
        </div>
      ) : (
        <div className={styles.grid}>
          {rows.map(c => {
            const color = STATUS_COLOR[c.status || ''] || '#CBD5E1'
            const contacts = c.linkedContacts?.length ?? 0
            return (
              <button key={c.id} className={styles.card} onClick={() => nav(`/clubs/${c.id}`)}>
                <div className={styles.cardTop}>
                  <div className={styles.avatar}>
                    {c.flag ? (
                      <span className={styles.flag}>{c.flag}</span>
                    ) : (
                      <span className={styles.initials}>
                        {(c.name || '?').substring(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className={styles.meta}>
                    <span className={styles.clubName}>{c.name}</span>
                    <span className={styles.league}>{c.league || '—'}</span>
                  </div>
                  <div className={styles.dot} style={{ background: color }} title={c.status} />
                </div>
                <div className={styles.cardBottom}>
                  <span className={styles.country}>{c.country || ''}</span>
                  {contacts > 0 && (
                    <span className={styles.contactCount}>
                      👤 {contacts} contact{contacts !== 1 ? 's' : ''}
                    </span>
                  )}
                  {c.status && (
                    <span className={styles.statusLabel} style={{ color }}>
                      {c.status}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
