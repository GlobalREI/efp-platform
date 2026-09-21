import React from 'react'
import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ref, onValue, off, remove } from 'firebase/database'
import { db } from '../data/firebase'
import { PageHeader } from '../components/PageHeader'
import styles from './WatchList.module.css'

interface WatchlistEntry {
  id: string
  name: string
  pos?: string
  age?: string
  nationality?: string
  club?: string
  marketValue?: string
  tmId?: string
  tmProfileUrl?: string
  addedAt?: number
  notes?: string
}

export function WatchList() {
  const nav = useNavigate()
  const [entries,  setEntries]  = useState<WatchlistEntry[]>([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [sortBy,   setSortBy]   = useState<'addedAt' | 'name' | 'pos'>('addedAt')
  const [sortDir,  setSortDir]  = useState<'asc' | 'desc'>('desc')

  function handleSort(col: 'name' | 'pos') {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('asc') }
  }

  async function deleteEntry(e: React.MouseEvent, id: string, name: string) {
    e.stopPropagation()
    if (!confirm(`Remove "${name}" from watchlist?`)) return
    await remove(ref(db, `watchlist/${id}`))
  }

  useEffect(() => {
    const r = ref(db, 'watchlist')
    const handler = (snap: any) => {
      if (!snap.exists()) { setEntries([]); setLoading(false); return }
      const rows: WatchlistEntry[] = Object.entries(snap.val()).map(([id, v]: [string, any]) => ({ id, ...v }))
      setEntries(rows)
      setLoading(false)
    }
    onValue(r, handler)
    return () => off(r, 'value', handler)
  }, [])

  const rows = useMemo(() => {
    let filtered = entries.filter(e => {
      if (search) {
        const q = search.toLowerCase()
        return [e.name, e.pos, e.club, e.nationality].some(s => s?.toLowerCase().includes(q))
      }
      return true
    })
    filtered = [...filtered].sort((a, b) => {
      if (sortBy === 'addedAt') {
        return sortDir === 'desc' ? (b.addedAt ?? 0) - (a.addedAt ?? 0) : (a.addedAt ?? 0) - (b.addedAt ?? 0)
      }
      const av = (a[sortBy] || '').toLowerCase()
      const bv = (b[sortBy] || '').toLowerCase()
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })
    return filtered
  }, [entries, search, sortBy, sortDir])

  if (loading) {
    return (
      <div className={styles.page}>
        <PageHeader title="Watchlist" sub="Loading…" />
        <div className={styles.skeletonWrap}>
          {[...Array(8)].map((_, i) => <div key={i} className={styles.skeleton} />)}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="Watchlist"
        sub={`${rows.length} of ${entries.length} player${entries.length !== 1 ? 's' : '' }`}
        search={{ value: search, onChange: setSearch, placeholder: 'Search name, position, club…' }}
      />

      {rows.length === 0 ? (
        <div className={styles.empty}>
          {search
            ? 'No players match the search.'
            : 'No players on your watchlist yet — star them from TM Scout.'}
        </div>
      ) : (
        <div className={styles.listWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={`${styles.th} ${styles.thSort}`} onClick={() => handleSort('name')}>
                  Player {sortBy === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : <span className={styles.sortHint}>↕</span>}
                </th>
                <th className={`${styles.th} ${styles.thSort}`} onClick={() => handleSort('pos')}>
                  Pos {sortBy === 'pos' ? (sortDir === 'asc' ? '↑' : '↓') : <span className={styles.sortHint}>↕</span>}
                </th>
                <th className={styles.th}>Age</th>
                <th className={styles.th}>Club</th>
                <th className={styles.th}>Value</th>
                <th className={styles.th}>Added</th>
                <th className={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(e => (
                <tr key={e.id} className={styles.row} onClick={() => nav(`/watchlist/${e.id}`)}>
                  <td className={styles.td}>
                    <span className={styles.rowName}>{e.name}</span>
                    {e.nationality && <span className={styles.rowSub}>{e.nationality}</span>}
                  </td>
                  <td className={styles.td}>
                    {e.pos
                      ? <span className={styles.posBadge}>{e.pos}</span>
                      : <span className={styles.rowSub}>—</span>}
                  </td>
                  <td className={styles.td}><span className={styles.rowSub}>{e.age || '—'}</span></td>
                  <td className={styles.td}><span className={styles.rowSub}>{e.club || '—'}</span></td>
                  <td className={styles.td}><span className={styles.rowSub}>{e.marketValue || '—'}</span></td>
                  <td className={styles.td}>
                    <span className={styles.rowSub}>
                      {e.addedAt
                        ? new Date(e.addedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                        : '—'}
                    </span>
                  </td>
                  <td className={styles.td} style={{ width: 32, textAlign: 'right' }}>
                    <button
                      className={styles.deleteBtn}
                      onClick={ev => deleteEntry(ev, e.id, e.name)}
                      title="Remove from watchlist"
                    >×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
