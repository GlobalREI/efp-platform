import React from 'react'
/**
 * PitchList — Kanban-style pipeline of all pitches
 *
 * Reads: /pitches  →  array or object of:
 *   { id, player, club, contact, flag, pos, stage, note, hot, pdfName }
 *
 * Stages: sent → awaiting → feedback → interest → negotiations → done | rejected
 */
import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ref, onValue, off, remove } from 'firebase/database'
import { db } from '../data/firebase'
import { PageHeader } from '../components/PageHeader'
import styles from './PitchList.module.css'

interface Pitch {
  id: string | number
  player?: string
  club?: string
  contact?: string
  flag?: string
  pos?: string
  stage?: string
  note?: string
  hot?: boolean
  pdfName?: string
}

const COLUMNS: { key: string; label: string; color: string }[] = [
  { key: 'sent',         label: 'Sent',            color: '#94A3B8' },
  { key: 'awaiting',     label: 'Awaiting Reply',  color: '#F59E0B' },
  { key: 'feedback',     label: 'Feedback',        color: '#8B5CF6' },
  { key: 'interest',     label: 'Active Interest', color: '#3B82F6' },
  { key: 'negotiations', label: 'Negotiating',     color: '#F97316' },
  { key: 'done',         label: 'Deal Done ✓',     color: '#10B981' },
  { key: 'rejected',     label: 'Not Interested',  color: '#EF4444' },
]

export function PitchList() {
  const nav = useNavigate()

  async function deletePitch(e: React.MouseEvent, id: string | number, player: string) {
    e.stopPropagation()
    if (!confirm(`Delete pitch for "${player}"? This cannot be undone.`)) return
    await remove(ref(db, `pitches/${id}`))
  }

  const [pitches, setPitches] = useState<Pitch[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [view,    setView]    = useState<'kanban' | 'list'>('kanban')

  useEffect(() => {
    const r = ref(db, 'pitches')
    const h = (snap: any) => {
      if (!snap.exists()) { setPitches([]); setLoading(false); return }
      const raw = snap.val()
      const rows: Pitch[] = Array.isArray(raw)
        ? raw.map((p: any, i: number) => ({ ...p, id: p.id ?? i }))
        : Object.entries(raw).map(([id, v]: [string, any]) => ({ id, ...v }))
      setPitches(rows)
      setLoading(false)
    }
    onValue(r, h)
    return () => off(r, 'value', h)
  }, [])

  const filtered = useMemo(() => {
    if (!search) return pitches
    const q = search.toLowerCase()
    return pitches.filter(p =>
      [p.player, p.club, p.contact, p.pos].some(s => s?.toLowerCase().includes(q))
    )
  }, [pitches, search])

  const byStage = useMemo(() => {
    const map: Record<string, Pitch[]> = {}
    COLUMNS.forEach(c => { map[c.key] = [] })
    filtered.forEach(p => {
      const stage = p.stage || 'sent'
      if (map[stage]) map[stage].push(p)
      else map['sent'].push(p)
    })
    return map
  }, [filtered])

  const activeCount = pitches.filter(p => !['done', 'rejected'].includes(p.stage || '')).length

  const filters = (
    <div className={styles.filters}>
      <button
        className={`${styles.viewBtn} ${view === 'kanban' ? styles.viewBtnActive : ''}`}
        onClick={() => setView('kanban')}
      >⊞ Board</button>
      <button
        className={`${styles.viewBtn} ${view === 'list' ? styles.viewBtnActive : ''}`}
        onClick={() => setView('list')}
      >☰ List</button>
    </div>
  )

  if (loading) {
    return (
      <div className={styles.page}>
        <PageHeader title="Pitch Pipeline" sub="Loading…" />
        <div className={styles.kanban}>
          {COLUMNS.slice(0, 5).map(c => (
            <div key={c.key} className={styles.col}>
              <div className={styles.colHeader}>
                <span className={styles.colDot} style={{ background: c.color }} />
                <span className={styles.colLabel}>{c.label}</span>
              </div>
              {[...Array(2)].map((_, i) => <div key={i} className={styles.skeletonCard} />)}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="Pitch Pipeline"
        sub={`${activeCount} active pitch${activeCount !== 1 ? 'es' : ''} · ${pitches.length} total`}
        search={{ value: search, onChange: setSearch, placeholder: 'Search player, club…' }}
        filters={filters}
      />

      {view === 'kanban' ? (
        <div className={styles.kanban}>
          {COLUMNS.map(col => {
            const cards = byStage[col.key] || []
            return (
              <div key={col.key} className={styles.col}>
                <div className={styles.colHeader}>
                  <span className={styles.colDot} style={{ background: col.color }} />
                  <span className={styles.colLabel}>{col.label}</span>
                  <span className={styles.colCount}>{cards.length}</span>
                </div>
                <div className={styles.colBody}>
                  {cards.length === 0 ? (
                    <div className={styles.colEmpty}>—</div>
                  ) : (
                    cards.map(p => (
                      <div
                        key={p.id}
                        className={`${styles.card} ${p.hot ? styles.cardHot : ''}`}
                        onClick={() => nav(`/pitches/${p.id}`)}
                      >
                        <div className={styles.cardPlayer}>
                          {p.hot && <span className={styles.hotDot} title="Hot">🔥</span>}
                          {p.player || 'Unknown Player'}
                        </div>
                        <div className={styles.cardClub}>
                          {p.flag && <span className={styles.cardFlag}>{p.flag}</span>}
                          {p.club}
                        </div>
                        {p.pos && <div className={styles.cardPos}>{p.pos}</div>}
                        {p.note && <div className={styles.cardNote}>{p.note}</div>}
                        {p.pdfName && <div className={styles.cardPdf}>📎 {p.pdfName}</div>}
                        <button
                          className={styles.deleteBtn}
                          onClick={e => deletePitch(e, p.id, p.player || 'Unknown')}
                          title="Delete pitch"
                        >×</button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* ── List view ── */
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thPlayer}>Player</th>
              <th className={styles.thClub}>Club</th>
              <th className={styles.thPos}>Pos</th>
              <th className={styles.thContact}>Contact</th>
              <th className={styles.thStage}>Stage</th>
              <th className={styles.thNote}>Note</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className={styles.emptyCell}>No pitches match.</td></tr>
            ) : filtered.map(p => {
              const col = COLUMNS.find(c => c.key === (p.stage || 'sent'))
              return (
                <tr key={p.id} className={styles.row} onClick={() => nav(`/pitches/${p.id}`)}>
                  <td>
                    <span className={styles.playerName}>
                      {p.hot && '🔥 '}
                      {p.player || '—'}
                    </span>
                  </td>
                  <td>
                    {p.flag && <span className={styles.flag}>{p.flag} </span>}
                    {p.club || '—'}
                  </td>
                  <td className={styles.pos}>{p.pos || '—'}</td>
                  <td className={styles.contact}>{p.contact || '—'}</td>
                  <td>
                    {col && (
                      <span className={styles.stagePill} style={{ borderColor: col.color, color: col.color }}>
                        {col.label}
                      </span>
                    )}
                  </td>
                  <td className={styles.note}>{p.note}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
