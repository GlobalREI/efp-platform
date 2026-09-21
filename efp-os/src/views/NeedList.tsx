import React from 'react'
/**
 * NeedList — all club needs (requirements)
 *
 * Reads: /needs  →  { [id]: { club, pos, positions[], budget, budMin, budMax,
 *                              ageMin, ageMax, contact, urgency, status, notes,
 *                              dealType, window, archived } }
 */
import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ref, onValue, off, remove } from 'firebase/database'
import { db } from '../data/firebase'
import { PageHeader } from '../components/PageHeader'
import { StatusPill } from '../components/Badge'
import { AddNeedForm } from './AddNeedForm'
import styles from './NeedList.module.css'

interface Need {
  id: string
  club?: string
  pos?: string
  positions?: string[]
  budget?: string
  budMin?: string
  budMax?: string
  ageMin?: string
  ageMax?: string
  contact?: string
  urgency?: string
  status?: string
  notes?: string
  dealType?: string
  window?: string
  archived?: boolean
  flag?: string
  league?: string
}

const URGENCY_COLOR: Record<string, string> = {
  urgent:  '#EF4444',
  high:    '#F59E0B',
  open:    '#10B981',
  closed:  '#94A3B8',
}

export function NeedList() {
  const nav = useNavigate()

  async function deleteNeed(e: React.MouseEvent, id: string, club: string) {
    e.stopPropagation()
    if (!confirm(`Delete need for "${club}"? This cannot be undone.`)) return
    await remove(ref(db, `needs/${id}`))
  }

  const [needs,       setNeeds]       = useState<Need[]>([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [filter,      setFilter]      = useState('active')   // active | archived | all
  const [sortBy,      setSortBy]      = useState('club')
  const [addOpen,   setAddOpen]   = useState(false)

  useEffect(() => {
    const r = ref(db, 'needs')
    const h = (snap: any) => {
      if (!snap.exists()) { setNeeds([]); setLoading(false); return }
      const raw = snap.val()
      const rows: Need[] = Array.isArray(raw)
        ? raw.map((n: any, i: number) => ({ id: String(i), ...n }))
        : Object.entries(raw).map(([id, v]: [string, any]) => ({ id, ...v }))
      setNeeds(rows)
      setLoading(false)
    }
    onValue(r, h)
    return () => off(r, 'value', h)
  }, [])

  const rows = useMemo(() => {
    let filtered = needs.filter(n => {
      if (filter === 'active'   && n.archived) return false
      if (filter === 'archived' && !n.archived) return false
      if (search) {
        const q = search.toLowerCase()
        return [n.club, n.pos, n.league, n.contact]
          .some(s => s?.toLowerCase().includes(q))
      }
      return true
    })

    return filtered.sort((a, b) => {
      if (sortBy === 'club')    return (a.club || '').localeCompare(b.club || '')
      if (sortBy === 'urgency') {
        const order: Record<string, number> = { urgent:0, high:1, open:2, closed:3 }
        return (order[a.urgency||'open']??2) - (order[b.urgency||'open']??2)
      }
      return (a.pos || '').localeCompare(b.pos || '')
    })
  }, [needs, filter, search, sortBy])

  const activeCount = needs.filter(n => !n.archived).length

  const filters = (
    <div className={styles.filters}>
      <select className={styles.sel} value={filter} onChange={e => setFilter(e.target.value)}>
        <option value="active">Active</option>
        <option value="archived">Archived</option>
        <option value="all">All</option>
      </select>
      <select className={styles.sel} value={sortBy} onChange={e => setSortBy(e.target.value)}>
        <option value="club">Sort: Club</option>
        <option value="urgency">Sort: Urgency</option>
        <option value="position">Sort: Position</option>
      </select>
    </div>
  )

  if (loading) {
    return (
      <div className={styles.page}>
        <PageHeader title="Club Needs" sub="Loading…" />
        <div className={styles.skeletonWrap}>
          {[...Array(6)].map((_, i) => <div key={i} className={styles.skeleton} />)}
        </div>
      </div>
    )
  }

  return (
    <>
    <div className={styles.page}>
      <PageHeader
        title="Club Needs"
        sub={`${activeCount} active requirement${activeCount !== 1 ? 's' : ''}`}
        search={{ value: search, onChange: setSearch, placeholder: 'Search club, position…' }}
        filters={filters}
      />

      {rows.length === 0 ? (
        <div className={styles.empty}>
          {search || filter !== 'active' ? 'No needs match the current filters.' : 'No club needs yet.'}
        </div>
      ) : (
        <div className={styles.grid}>
          {rows.map(n => {
            const positions = n.positions?.length ? n.positions : (n.pos ? [n.pos] : [])
            const budget = n.budMin && n.budMax
              ? `${n.budMin} – ${n.budMax}`
              : (n.budget || null)
            const dot = URGENCY_COLOR[n.urgency || 'open'] || '#94A3B8'
            return (
              <div
                key={n.id}
                className={`${styles.card} ${n.archived ? styles.archived : ''}`}
                onClick={() => nav(`/needs/${n.id}`)}
              >
                <div className={styles.cardTop}>
                  <div className={styles.clubInfo}>
                    {n.flag && <span className={styles.flag}>{n.flag}</span>}
                    <div>
                      <div className={styles.clubName}>{n.club || 'Unknown Club'}</div>
                      {n.league && <div className={styles.league}>{n.league}</div>}
                    </div>
                  </div>
                  <span className={styles.urgencyDot} style={{ background: dot }} title={n.urgency || 'open'} />
                  <button className={styles.deleteBtn} onClick={e => deleteNeed(e, n.id, n.club || '')} title="Delete need">×</button>
                </div>

                <div className={styles.positions}>
                  {positions.map((p, i) => (
                    <span key={i} className={styles.posPill}>{p}</span>
                  ))}
                  {positions.length === 0 && <span className={styles.posEmpty}>No position listed</span>}
                </div>

                <div className={styles.cardMeta}>
                  {budget && <span className={styles.budget}>💰 {budget}</span>}
                  {n.dealType && n.dealType !== 'either' && (
                    <span className={styles.dealType}>{n.dealType === 'loan' ? '🔄 Loan' : '✍ Buy'}</span>
                  )}
                  {n.window && <span className={styles.window}>{n.window}</span>}
                </div>

                {n.status && (
                  <div className={styles.cardStatus}>
                    <StatusPill status={n.status} />
                  </div>
                )}

                {n.contact && (
                  <div className={styles.contact}>via {n.contact}</div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
    <AddNeedForm open={addOpen} onClose={() => setAddOpen(false)} />
  </>
  )
}
