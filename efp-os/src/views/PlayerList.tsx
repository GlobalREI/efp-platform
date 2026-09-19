/**
 * MandateList (PlayerList) — all active and archived transfer mandates
 *
 * Reads:  /mandates            — mandate objects
 *         /playerNotes/<name>  — priority + status per player
 *
 * Features:
 *  - Live Firebase subscription
 *  - Search (name / club / position)
 *  - Filter: window, archived toggle
 *  - Sort: priority, name, date added
 *  - Click row → /mandates/:id
 */
import { useEffect, useState, useMemo } from 'react'
import { useNavigate }  from 'react-router-dom'
import { ref, onValue, off } from 'firebase/database'
import { db }           from '../data/firebase'
import { PageHeader }   from '../components/PageHeader'
import { PriorityBadge, StatusPill } from '../components/Badge'
import styles from './PlayerList.module.css'

/* ── Types ─────────────────────────────────────────────────────────────── */
interface Mandate {
  id: string
  name: string
  pos?: string
  pos2?: string
  age?: string
  club?: string
  value?: string
  nationality?: string
  transfer_window?: string
  statusText?: string
  dotClass?: string
  archived?: boolean
  savedAt?: number
}

interface PlayerNote {
  priority?: number | null
  status?: string
  dealType?: string
}

const PRIO_MAP: Record<number, 'P1' | 'P2' | 'P3'> = { 1: 'P1', 2: 'P2', 3: 'P3' }

/* ── Component ──────────────────────────────────────────────────────────── */
export function PlayerList() {
  const nav = useNavigate()

  const [mandates,  setMandates]  = useState<Mandate[]>([])
  const [notes,     setNotes]     = useState<Record<string, PlayerNote>>({})
  const [loading,   setLoading]   = useState(true)

  const [search,    setSearch]    = useState('')
  const [window,    setWindow]    = useState('all')
  const [showArchived, setShowArchived] = useState(false)
  const [sort,      setSort]      = useState<'priority' | 'name' | 'recent'>('priority')

  /* ── Firebase ── */
  useEffect(() => {
    const mRef = ref(db, 'mandates')
    const mHandler = (snap: any) => {
      if (!snap.exists()) { setMandates([]); setLoading(false); return }
      const rows: Mandate[] = Object.entries(snap.val()).map(([id, v]: [string, any]) => ({
        id, ...v,
      }))
      setMandates(rows)
      setLoading(false)

      // Load notes for each player name (batched)
      const nRef = ref(db, 'playerNotes')
      onValue(nRef, (nSnap) => {
        if (!nSnap.exists()) return
        const raw = nSnap.val() as Record<string, any>
        // Keys may be URL-encoded
        const decoded: Record<string, PlayerNote> = {}
        Object.entries(raw).forEach(([k, v]) => {
          decoded[decodeURIComponent(k)] = v as PlayerNote
        })
        setNotes(decoded)
      }, { onlyOnce: true })
    }
    onValue(mRef, mHandler)
    return () => off(mRef, 'value', mHandler)
  }, [])

  /* ── Unique windows for filter ── */
  const windows = useMemo(() => {
    const set = new Set<string>()
    mandates.forEach(m => { if (m.transfer_window) set.add(m.transfer_window) })
    return Array.from(set).sort()
  }, [mandates])

  /* ── Filtered + sorted list ── */
  const rows = useMemo(() => {
    let list = mandates.filter(m => {
      if (!showArchived && m.archived) return false
      if (window !== 'all' && m.transfer_window !== window) return false
      if (search) {
        const q = search.toLowerCase()
        const hit = [m.name, m.pos, m.pos2, m.club, m.nationality].some(
          s => s?.toLowerCase().includes(q)
        )
        if (!hit) return false
      }
      return true
    })

    // Sort
    list = [...list].sort((a, b) => {
      if (sort === 'priority') {
        const pa = notes[a.name]?.priority ?? 99
        const pb = notes[b.name]?.priority ?? 99
        if (pa !== pb) return pa - pb
        return (a.name || '').localeCompare(b.name || '')
      }
      if (sort === 'name') return (a.name || '').localeCompare(b.name || '')
      // recent
      return (b.savedAt ?? 0) - (a.savedAt ?? 0)
    })

    return list
  }, [mandates, notes, search, window, showArchived, sort])

  /* ── Counts ── */
  const activeCount   = mandates.filter(m => !m.archived).length
  const archivedCount = mandates.filter(m =>  m.archived).length

  /* ── Render ── */
  const filters = (
    <div className={styles.filters}>
      <select
        className={styles.filterSelect}
        value={window}
        onChange={e => setWindow(e.target.value)}
      >
        <option value="all">All Windows</option>
        {windows.map(w => <option key={w} value={w}>{w}</option>)}
      </select>

      <select
        className={styles.filterSelect}
        value={sort}
        onChange={e => setSort(e.target.value as typeof sort)}
      >
        <option value="priority">Sort: Priority</option>
        <option value="name">Sort: Name</option>
        <option value="recent">Sort: Recent</option>
      </select>

      <button
        className={`${styles.archiveToggle} ${showArchived ? styles.active : ''}`}
        onClick={() => setShowArchived(v => !v)}
        title={showArchived ? 'Hide archived' : 'Show archived'}
      >
        📦 {archivedCount} archived
      </button>
    </div>
  )

  if (loading) {
    return (
      <div className={styles.page}>
        <PageHeader title="Mandates" sub="Loading…" />
        <div className={styles.skeletonWrap}>
          {[...Array(6)].map((_, i) => <div key={i} className={styles.skeleton} />)}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="Mandates"
        sub={`${activeCount} active${archivedCount ? ` · ${archivedCount} archived` : ''}`}
        search={{ value: search, onChange: setSearch, placeholder: 'Search by name, club, position…' }}
        filters={filters}
      />

      {rows.length === 0 ? (
        <div className={styles.empty}>
          {search || window !== 'all'
            ? 'No mandates match the current filters.'
            : 'No mandates yet — add one from the main platform.'}
        </div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thPrio}>P</th>
              <th className={styles.thName}>Player</th>
              <th className={styles.thPos}>Position</th>
              <th className={styles.thClub}>Club</th>
              <th className={styles.thAge}>Age</th>
              <th className={styles.thWindow}>Window</th>
              <th className={styles.thStatus}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(m => {
              const note    = notes[m.name]
              const prio    = note?.priority ? PRIO_MAP[note.priority] : undefined
              const status  = note?.status || m.statusText || 'Active'
              const pos     = [m.pos, m.pos2].filter(Boolean).join(' / ')

              return (
                <tr
                  key={m.id}
                  className={`${styles.row} ${m.archived ? styles.archived : ''}`}
                  onClick={() => nav(`/mandates/${m.id}`)}
                >
                  <td className={styles.tdPrio}>
                    {prio
                      ? <PriorityBadge priority={prio} size="sm" />
                      : <span className={styles.dot} data-dot={m.dotClass || 'dot-amber'} />
                    }
                  </td>
                  <td className={styles.tdName}>
                    <span className={styles.playerName}>{m.name}</span>
                    {m.nationality && <span className={styles.nat}>{m.nationality}</span>}
                  </td>
                  <td className={styles.tdPos}>{pos || '—'}</td>
                  <td className={styles.tdClub}>{m.club || '—'}</td>
                  <td className={styles.tdAge}>{m.age || '—'}</td>
                  <td className={styles.tdWindow}>
                    {m.transfer_window
                      ? <span className={styles.windowBadge}>{m.transfer_window}</span>
                      : <span className={styles.dash}>—</span>}
                  </td>
                  <td className={styles.tdStatus}>
                    <StatusPill status={m.archived ? 'Archived' : status} size="sm" />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
