/**
 * ScoutView — Match Engine
 *
 * Cross-references player mandates (/mandates) against club needs (/needs).
 * Scores each pair and renders filterable match cards.
 *
 * Score breakdown (100 pts max):
 *   Position match  40 pts
 *   Age fit         30 pts
 *   Budget fit      30 pts
 */
import { useEffect, useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ref, onValue, off } from 'firebase/database'
import { db } from '../data/firebase'
import { PageHeader } from '../components/PageHeader'
import styles from './ScoutView.module.css'

/* ── Types ─────────────────────────────────────────────────────────────── */
interface Mandate {
  id: string
  name: string
  pos?: string
  pos2?: string
  age?: string | number
  value?: string
  club?: string
  nationality?: string
  archived?: boolean
}

interface Need {
  id: string
  club?: string
  pos?: string
  positions?: string[]
  ageMin?: string | number
  ageMax?: string | number
  budMin?: string | number
  budMax?: string | number
  budget?: string
  urgency?: string
  status?: string
  archived?: boolean
  league?: string
  flag?: string
}

interface Match {
  mandate: Mandate
  need: Need
  score: number
  posMatch: boolean
  ageMatch: 'exact' | 'close' | 'none' | 'unconstrained'
  budMatch: 'exact' | 'close' | 'none' | 'unconstrained'
}

/* ── Helpers ────────────────────────────────────────────────────────────── */
const POS_GROUPS: Record<string, string[]> = {
  GK:  ['GK'],
  CB:  ['CB'],
  RB:  ['RB', 'RWB'],
  LB:  ['LB', 'LWB'],
  CDM: ['CDM', 'DM'],
  CM:  ['CM'],
  CAM: ['CAM', 'AM', 'N10'],
  RW:  ['RW', 'RM'],
  LW:  ['LW', 'LM'],
  CF:  ['CF', 'ST', 'SS'],
}

function canonPos(p: string): string {
  const up = p.toUpperCase().trim()
  for (const [canon, variants] of Object.entries(POS_GROUPS)) {
    if (variants.some(v => up === v || up.includes(v))) return canon
  }
  return up
}

function parseMoney(v?: string | number): number | null {
  if (!v) return null
  const s = String(v).replace(/[€$£,\s]/g, '').toUpperCase()
  const n = parseFloat(s)
  if (isNaN(n)) return null
  if (s.endsWith('M')) return n * 1_000_000
  if (s.endsWith('K')) return n * 1_000
  return n
}

function parseNum(v?: string | number): number | null {
  const n = Number(v)
  return isNaN(n) || n === 0 ? null : n
}

function scoreMatch(m: Mandate, n: Need): Match {
  const needPos = (n.positions?.length ? n.positions : n.pos ? [n.pos] : []).map(canonPos)
  const mPos  = canonPos(m.pos  || '')
  const mPos2 = canonPos(m.pos2 || '')

  // Position (40 pts)
  let posScore = 0; let posMatch = false
  if (!needPos.length)                    { posScore = 20 }
  else if (needPos.includes(mPos))        { posScore = 40; posMatch = true }
  else if (mPos2 && needPos.includes(mPos2)) { posScore = 25; posMatch = true }

  // Age (30 pts)
  const mAge   = parseNum(m.age)
  const needMin = parseNum(n.ageMin)
  const needMax = parseNum(n.ageMax)
  let ageScore = 0; let ageMatch: Match['ageMatch'] = 'unconstrained'
  if (!needMin && !needMax)  { ageScore = 20; ageMatch = 'unconstrained' }
  else if (mAge != null) {
    const okMin = !needMin || mAge >= needMin
    const okMax = !needMax || mAge <= needMax
    if (okMin && okMax) { ageScore = 30; ageMatch = 'exact' }
    else {
      const over = (needMin && mAge < needMin ? needMin - mAge : 0) +
                   (needMax && mAge > needMax ? mAge - needMax : 0)
      if (over <= 2) { ageScore = 15; ageMatch = 'close' }
      else            { ageScore = 0;  ageMatch = 'none' }
    }
  } else { ageScore = 10 }

  // Budget (30 pts)
  const mVal = parseMoney(m.value)
  const bMin = parseMoney(n.budMin) || parseMoney(n.budget)
  const bMax = parseMoney(n.budMax) || parseMoney(n.budget)
  let budScore = 0; let budMatch: Match['budMatch'] = 'unconstrained'
  if (!bMin && !bMax) { budScore = 20; budMatch = 'unconstrained' }
  else if (mVal != null) {
    const lo = bMin ?? 0; const hi = bMax ?? Infinity
    if (mVal >= lo && mVal <= hi)           { budScore = 30; budMatch = 'exact' }
    else if (mVal <= hi * 1.2 && mVal >= lo * 0.8) { budScore = 15; budMatch = 'close' }
    else                                    { budScore = 0;  budMatch = 'none' }
  } else { budScore = 10 }

  return { mandate: m, need: n, score: posScore + ageScore + budScore, posMatch, ageMatch, budMatch }
}

const scoreColor = (s: number) => s >= 80 ? '#10B981' : s >= 65 ? '#F59E0B' : '#94A3B8'
const URGENCY_DOT: Record<string, string> = {
  urgent: '#EF4444', high: '#F59E0B', open: '#10B981', closed: '#94A3B8',
}

/* ── Component ──────────────────────────────────────────────────────────── */
export function ScoutView() {
  const nav = useNavigate()
  const [mandates, setMandates] = useState<Mandate[]>([])
  const [needs,    setNeeds]    = useState<Need[]>([])
  const [loading,  setLoading]  = useState(true)
  const [playerQ,  setPlayerQ]  = useState('')
  const [clubQ,    setClubQ]    = useState('')
  const [posFilter, setPosFilter] = useState('')
  const [minScore,  setMinScore]  = useState(60)

  useEffect(() => {
    let mDone = false, nDone = false
    const check = () => { if (mDone && nDone) setLoading(false) }

    const mr = ref(db, 'mandates')
    const mh = (snap: any) => {
      if (snap.exists()) {
        const raw = snap.val()
        const rows: Mandate[] = Array.isArray(raw)
          ? raw.map((v: any, i: number) => ({ id: String(i), ...v }))
          : Object.entries(raw).map(([id, v]: [string, any]) => ({ id, ...v }))
        setMandates(rows.filter(r => !r.archived))
      }
      mDone = true; check()
    }
    onValue(mr, mh)

    const nr = ref(db, 'needs')
    const nh = (snap: any) => {
      if (snap.exists()) {
        const raw = snap.val()
        const rows: Need[] = Array.isArray(raw)
          ? raw.map((v: any, i: number) => ({ id: String(i), ...v }))
          : Object.entries(raw).map(([id, v]: [string, any]) => ({ id, ...v }))
        setNeeds(rows.filter(r => !r.archived))
      }
      nDone = true; check()
    }
    onValue(nr, nh)

    return () => { off(mr, 'value', mh); off(nr, 'value', nh) }
  }, [])

  const allMatches = useMemo<Match[]>(() => {
    const out: Match[] = []
    for (const m of mandates) {
      for (const n of needs) {
        const match = scoreMatch(m, n)
        if (match.score >= 50) out.push(match)
      }
    }
    return out.sort((a, b) => b.score - a.score)
  }, [mandates, needs])

  const filtered = useMemo(() => allMatches.filter(m => {
    if (m.score < minScore) return false
    if (posFilter) {
      const c = canonPos(posFilter)
      const np = (m.need.positions?.length ? m.need.positions : m.need.pos ? [m.need.pos] : []).map(canonPos)
      if (!np.includes(c)) return false
    }
    if (playerQ && !m.mandate.name?.toLowerCase().includes(playerQ.toLowerCase())) return false
    if (clubQ   && !m.need.club?.toLowerCase().includes(clubQ.toLowerCase()))    return false
    return true
  }), [allMatches, minScore, posFilter, playerQ, clubQ])

  const kpis = useMemo(() => {
    const scores = filtered.map(m => m.score)
    return {
      total:   filtered.length,
      avg:     scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      high:    filtered.filter(m => m.score >= 80).length,
      players: new Set(filtered.map(m => m.mandate.id)).size,
    }
  }, [filtered])

  const go = useCallback((m: Match, t: 'player' | 'need') => {
    if (t === 'player') nav(`/mandates/${m.mandate.id}`)
    else nav(`/needs/${m.need.id}`)
  }, [nav])

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <div className={styles.spinner} />
        <span className={styles.loadingText}>Running match engine…</span>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="Scout"
        sub={`${kpis.total} match${kpis.total !== 1 ? 'es' : ''} · ${kpis.players} player${kpis.players !== 1 ? 's' : ''}`}
        actions={
          <button className={styles.rerunBtn} onClick={() => setMinScore(s => s)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            Re-run
          </button>
        }
      />

      {/* KPI strip */}
      <div className={styles.kpiRow}>
        <div className={styles.kpi}>
          <span className={styles.kpiVal}>{kpis.total}</span>
          <span className={styles.kpiLabel}>Total matches</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiVal} style={{ color: scoreColor(kpis.avg) }}>{kpis.avg}%</span>
          <span className={styles.kpiLabel}>Avg score</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiVal} style={{ color: '#10B981' }}>{kpis.high}</span>
          <span className={styles.kpiLabel}>High quality (80%+)</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiVal}>{kpis.players}</span>
          <span className={styles.kpiLabel}>Players matched</span>
        </div>
      </div>

      {/* Filter bar */}
      <div className={styles.filterBar}>
        <input
          className={styles.filterInput}
          placeholder="🔍 Player…"
          value={playerQ}
          onChange={e => setPlayerQ(e.target.value)}
        />
        <input
          className={styles.filterInput}
          placeholder="🏟 Club…"
          value={clubQ}
          onChange={e => setClubQ(e.target.value)}
        />
        <select
          className={styles.filterSelect}
          value={posFilter}
          onChange={e => setPosFilter(e.target.value)}
        >
          <option value="">All positions</option>
          {['GK','CB','RB','LB','CDM','CM','CAM','RW','LW','CF'].map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <div className={styles.scoreFilter}>
          <span className={styles.scoreLabel}>Min score</span>
          <input
            type="range"
            className={styles.scoreRange}
            min={50} max={95} step={5}
            value={minScore}
            onChange={e => setMinScore(Number(e.target.value))}
          />
          <span className={styles.scoreVal} style={{ color: scoreColor(minScore) }}>
            {minScore}%
          </span>
        </div>
      </div>

      {/* Match grid */}
      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🎯</div>
          <div className={styles.emptyTitle}>No matches found</div>
          <div className={styles.emptyDesc}>Lower the minimum score or adjust your filters</div>
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((m, i) => (
            <MatchCard key={`${m.mandate.id}-${m.need.id}-${i}`} match={m} onClick={go} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ── MatchCard ──────────────────────────────────────────────────────────── */
function MatchCard({ match, onClick }: {
  match: Match
  onClick: (m: Match, t: 'player' | 'need') => void
}) {
  const { mandate: m, need: n, score, posMatch, ageMatch, budMatch } = match
  const sc = scoreColor(score)
  const urgDot = URGENCY_DOT[n.urgency || 'open'] ?? '#94A3B8'
  const needPosLabel = (n.positions?.length ? n.positions : n.pos ? [n.pos] : []).join(' / ')

  return (
    <div className={styles.card}>
      <div className={styles.scoreBadge} style={{ background: sc + '1A', color: sc }}>
        {score}%
      </div>

      {/* Player */}
      <button className={styles.cardSide} onClick={() => onClick(match, 'player')}>
        <div className={styles.cardAvatar} style={{ background: '#2D4A33' }}>
          {m.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
        </div>
        <div className={styles.cardInfo}>
          <div className={styles.cardName}>{m.name}</div>
          <div className={styles.cardMeta}>
            {[m.pos, m.pos2].filter(Boolean).join(' · ')}
            {m.age ? ` · ${m.age}yr` : ''}
          </div>
          {m.value && <div className={styles.cardValue}>{m.value}</div>}
        </div>
      </button>

      <div className={styles.arrow}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </div>

      {/* Club need */}
      <button className={styles.cardSide} onClick={() => onClick(match, 'need')}>
        <div className={styles.cardAvatar} style={{ background: '#5B21B6' }}>
          {n.club?.slice(0, 2).toUpperCase() || 'CL'}
        </div>
        <div className={styles.cardInfo}>
          <div className={styles.cardName}>{n.club || 'Unknown club'}</div>
          <div className={styles.cardMeta}>
            {needPosLabel}
            {n.ageMax ? ` · U${n.ageMax}` : ''}
          </div>
          {(n.budMax || n.budget) && (
            <div className={styles.cardValue}>
              {n.budMin ? `€${n.budMin}–€${n.budMax}` : `up to €${n.budMax || n.budget}`}
            </div>
          )}
        </div>
        <span className={styles.urgDot} style={{ background: urgDot }} title={n.urgency || 'open'} />
      </button>

      {/* Quality pills */}
      <div className={styles.pills}>
        <span className={`${styles.pill} ${posMatch ? styles.pillGreen : styles.pillGrey}`}>
          Pos {posMatch ? '✓' : '~'}
        </span>
        <span className={`${styles.pill} ${
          ageMatch === 'exact' ? styles.pillGreen :
          ageMatch === 'close' ? styles.pillAmber :
          ageMatch === 'none'  ? styles.pillRed   : styles.pillGrey
        }`}>
          Age {ageMatch === 'exact' ? '✓' : ageMatch === 'close' ? '~' : ageMatch === 'unconstrained' ? '—' : '✗'}
        </span>
        <span className={`${styles.pill} ${
          budMatch === 'exact' ? styles.pillGreen :
          budMatch === 'close' ? styles.pillAmber :
          budMatch === 'none'  ? styles.pillRed   : styles.pillGrey
        }`}>
          Budget {budMatch === 'exact' ? '✓' : budMatch === 'close' ? '~' : budMatch === 'unconstrained' ? '—' : '✗'}
        </span>
      </div>
    </div>
  )
}
