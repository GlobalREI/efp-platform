/**
 * TmScoutView — Transfermarkt Scout
 *
 * Three tabs:
 *   1. Find a Club   — search TM clubs, define the player profile you're placing,
 *                      cross-ref with Firebase needs/mandates → Need Score
 *   2. Find a Player — search TM players, match against active club needs
 *   3. Find a Loan Player — same as player, pre-set age ≤ 24
 *
 * "+ Save" on any row opens an inline Save Panel so you can link the record:
 *   - Club → link to a player mandate (shows in that player's profile)
 *   - Player / Loan → link to a CRM club (shows in that club's profile)
 *
 * Firebase data auto-refreshes every 5 min in the background.
 * TM search runs on explicit user action (Enter / Search TM button).
 * League filter supports multi-select on ALL tabs.
 */
import { Fragment, useEffect, useRef, useState, useCallback } from 'react'
import { ref, get, push, set } from 'firebase/database'
import { db } from '../data/firebase'
import { PageHeader } from '../components/PageHeader'
import {
  searchTmClubs,
  filterTmPlayers,
  parseTmValue,
  fetchTmPlayerAgent,
  type TmPlayer,
  type TmClub,
} from '../data/tmApi'
import { useNavigate } from 'react-router-dom'
import { getSquadContext, searchLocalPlayers, type SquadContext } from '../data/squadData'
import styles from './TmScoutView.module.css'

/* ── Constants ─────────────────────────────────────────────────────────── */
const REFRESH_MS = 5 * 60 * 1000
const POSITIONS  = ['GK', 'CB', 'RB', 'LB', 'CDM', 'CM', 'CAM', 'RW', 'LW', 'CF', 'ST']
const LEAGUES    = [
  'Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'Ligue 1',
  'Eredivisie', 'Primeira Liga', 'Championship', '2. Bundesliga',
  'Serie B', 'Süper Lig', 'Belgian Pro League', 'Scottish Premiership',
]

type Tab = 'club' | 'player' | 'loan'

/* ── Firebase types ─────────────────────────────────────────────────────── */
interface FbNeed {
  id: string; club?: string; club_name?: string
  pos?: string; positions?: string[]
  budMin?: number | string; budMax?: number | string
  status?: string; league?: string
}
interface FbMandate {
  id: string; name?: string; pos?: string
  age?: number | string; value?: number | string
  status?: string; archived?: boolean
  linked_club_key?: string; linked_club_name?: string
}
interface FbClub {
  id: string; name?: string; league?: string; country?: string
  archived?: boolean
  linked_mandate_key?: string; linked_mandate_name?: string
}

/* ── FbNeedClub — result of a Firebase-based buyer-club search ─────────── */
interface FbNeedClub {
  id: string          // fbClub.id or club name as key
  name: string
  league: string
  country: string
  activeNeeds: FbNeed[]
  budMin: number
  budMax: number
  needScore: number
  fbClubId?: string   // Firebase CRM club id (for "View Profile" button)
}

/* ── Scoring ────────────────────────────────────────────────────────────── */
function needScore(club: TmClub, needs: FbNeed[], filterPos: string): number {
  const name = club.name.toLowerCase()
  const directNeeds = needs.filter(n => {
    const cn = (n.club || n.club_name || '').toLowerCase()
    return cn && (cn.includes(name) || name.includes(cn))
  })
  const posDirectNeeds = filterPos
    ? directNeeds.filter(n => {
        const np = [...(n.positions ?? []), n.pos ?? ''].map(p => p.toLowerCase())
        return np.some(p => p.includes(filterPos.toLowerCase()))
      })
    : directNeeds
  const leagueMatchNeeds = needs.filter(n => {
    const nl = (n.league || '').toLowerCase()
    const cl = club.league.toLowerCase()
    return nl && cl && (nl.includes(cl) || cl.includes(nl))
  })
  return Math.min(100,
    posDirectNeeds.length * 50 +
    (directNeeds.length - posDirectNeeds.length) * 20 +
    leagueMatchNeeds.length * 10
  )
}

/* Format a budget range as "€6–12M" */
function budgetLabel(min: number, max: number): string {
  const fmt = (n: number) => n >= 1 ? `${n % 1 === 0 ? n : n.toFixed(1)}M` : `${Math.round(n * 1000)}K`
  if (!min && !max) return '—'
  if (!min) return `up to €${fmt(max)}`
  if (!max || max >= 999) return `€${fmt(min)}+`
  return `€${fmt(min)} – €${fmt(max)}`
}

/* Budget fit: 1.0 = exact, 0 = out of range */
function budgetFit(mv: number | null, budMin: number, budMax: number): number {
  if (mv === null || mv === 0) return 0.5
  if (mv >= budMin && mv <= budMax) return 1.0
  if (mv < budMin) return Math.max(0, 1 - (budMin - mv) / budMin)
  return Math.max(0, 1 - (mv - budMax) / budMax)
}

function mandateMatchCount(player: TmPlayer, needs: FbNeed[]): number {
  const pos = player.position.toLowerCase()
  const mv  = parseTmValue(player.marketValue)
  return needs.filter(n => {
    const np = [...(n.positions ?? []), n.pos ?? ''].map(p => p.toLowerCase()).filter(Boolean)
    const posOk = np.length === 0 || np.some(p => pos.includes(p) || p.includes(pos))
    if (!posOk) return false
    const budMin = parseFloat(String(n.budMin ?? 0))
    const budMax = parseFloat(String(n.budMax ?? 999))
    if (mv !== null && (mv < budMin * 0.6 || mv > budMax * 1.6)) return false
    return true
  }).length
}

/* ── League match helper ────────────────────────────────────────────────── */
function leagueMatches(a: string, b: string): boolean {
  const al = a.toLowerCase(), bl = b.toLowerCase()
  return al === bl || al.includes(bl) || bl.includes(al)
}

/* ── Sub-components ─────────────────────────────────────────────────────── */
function ScoreBadge({ score }: { score: number }) {
  const bg  = score >= 60 ? 'var(--accent-dim)' : score >= 30 ? 'var(--amber-dim)' : 'var(--surface-2)'
  const col = score >= 60 ? 'var(--accent)' : score >= 30 ? 'var(--amber)' : 'var(--text-3)'
  if (score === 0) return <span style={{ color: 'var(--text-3)', fontSize: 12 }}>—</span>
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 36, height: 22, borderRadius: 'var(--r-full)',
      background: bg, color: col, fontSize: 11, fontWeight: 700,
    }}>{score}</span>
  )
}

function MatchBadge({ count }: { count: number }) {
  if (count === 0) return <span style={{ color: 'var(--text-3)', fontSize: 12 }}>—</span>
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 28, height: 20, borderRadius: 'var(--r-full)',
      background: 'var(--accent-dim)', color: 'var(--accent)', fontSize: 11, fontWeight: 700,
    }}>{count}</span>
  )
}

function Avatar({ imageUrl, name, size = 28, round = false }: { imageUrl: string; name: string; size?: number; round?: boolean }) {
  const [err, setErr] = useState(false)
  const initials = name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
  if (!imageUrl || err) return (
    <div style={{
      width: size, height: size, borderRadius: round ? '50%' : 4,
      background: 'var(--accent-dim)', color: 'var(--accent)',
      fontSize: size < 24 ? 8 : 10, fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>{initials}</div>
  )
  return (
    <img
      src={imageUrl} alt={name}
      style={{ width: size, height: size, borderRadius: round ? '50%' : 4, objectFit: 'contain', flexShrink: 0 }}
      onError={() => setErr(true)}
    />
  )
}

function Spinner({ white = false }: { white?: boolean }) {
  return (
    <div style={{
      width: 13, height: 13, borderRadius: '50%',
      border: `2px solid ${white ? 'rgba(255,255,255,0.35)' : 'var(--border-2)'}`,
      borderTopColor: white ? '#fff' : 'var(--accent)',
      animation: 'tm-spin 0.65s linear infinite',
    }} />
  )
}

/* ── Multi-select league picker ─────────────────────────────────────────── */
function MultiLeagueSelect({ selected, onChange }: {
  selected: string[]
  onChange: (leagues: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function toggle(league: string) {
    onChange(selected.includes(league)
      ? selected.filter(l => l !== league)
      : [...selected, league])
  }

  const label = selected.length === 0 ? 'All leagues'
    : selected.length === 1 ? selected[0]
    : `${selected.length} leagues`

  return (
    <div ref={wrapRef} className={styles.mlWrap}>
      <span className={styles.mlLabel}>League</span>
      <button
        type="button"
        className={`${styles.mlBtn} ${selected.length > 0 ? styles.mlBtnActive : ''}`}
        onClick={() => setOpen(v => !v)}
      >
        <span className={styles.mlBtnText}>{label}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.6"
          strokeLinecap="round" style={{ flexShrink: 0, transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }}>
          <path d="M1 1l4 4 4-4"/>
        </svg>
      </button>
      {open && (
        <div className={styles.mlDropdown}>
          {selected.length > 0 && (
            <button type="button" className={styles.mlClear} onClick={() => { onChange([]); setOpen(false) }}>
              ✕ Clear all ({selected.length} selected)
            </button>
          )}
          {LEAGUES.map(league => (
            <label key={league} className={styles.mlOption}>
              <input
                type="checkbox"
                className={styles.mlCheckbox}
                checked={selected.includes(league)}
                onChange={() => toggle(league)}
              />
              <span className={styles.mlOptionText}>{league}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

function FilterSelect({ label, value, onChange, options, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; placeholder?: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{label}</span>
      <select
        value={value} onChange={e => onChange(e.target.value)}
        style={{
          height: 30, padding: '0 8px', border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)', background: 'var(--surface)',
          color: 'var(--text)', fontSize: 12, cursor: 'pointer',
        }}
      >
        <option value="">{placeholder ?? 'All'}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function RangeFilter({ label, min, max, onMin, onMax, placeholder = ['Min', 'Max'] }: {
  label: string; min: string; max: string
  onMin: (v: string) => void; onMax: (v: string) => void
  placeholder?: [string, string]
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{label}</span>
      <input type="number" value={min} onChange={e => onMin(e.target.value)} placeholder={placeholder[0]}
        style={{ width: 55, height: 30, padding: '0 7px', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12, textAlign: 'center' }} />
      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>–</span>
      <input type="number" value={max} onChange={e => onMax(e.target.value)} placeholder={placeholder[1]}
        style={{ width: 55, height: 30, padding: '0 7px', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12, textAlign: 'center' }} />
    </div>
  )
}

/* ── Squad Depth display ────────────────────────────────────────────────── */
function fmv(m: number): string {
  if (m <= 0) return '—'
  return m >= 1 ? `€${m % 1 === 0 ? m : m.toFixed(1)}M` : `€${Math.round(m * 1000)}K`
}

function SquadDepthContent({ ctx, playerMv, colSpan }: {
  ctx: SquadContext
  playerMv?: number | null
  colSpan: number
}) {
  const ratio = playerMv && ctx.posAvgMv > 0 ? playerMv / ctx.posAvgMv : null
  return (
    <tr>
      <td colSpan={colSpan} style={{ padding: 0, background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
              {ctx.depth}× at {ctx.matchedClub}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
              pos avg {fmv(ctx.posAvgMv)} · squad avg {fmv(ctx.squadAvgMv)}
            </span>
            {ratio !== null && (
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                · this player {fmv(playerMv!)} ({Math.round(ratio * 100)}% of pos avg)
              </span>
            )}
            {ctx.sellSignal && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: '#ef4444',
                background: 'rgba(239,68,68,0.1)', borderRadius: 4, padding: '1px 6px',
              }}>🔴 Sell signal</span>
            )}
            {ctx.buySignal && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: '#22c55e',
                background: 'rgba(34,197,94,0.1)', borderRadius: 4, padding: '1px 6px',
              }}>🟢 Buy signal</span>
            )}
            {ctx.depth === 0 && (
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>No CNF data at this position</span>
            )}
          </div>
          {/* Player chips */}
          {ctx.posPlayers.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {ctx.posPlayers.map((p, idx) => (
                <span key={idx} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '2px 8px', borderRadius: 12,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  fontSize: 11, color: 'var(--text-2)',
                }}>
                  <span style={{ fontWeight: 600, color: 'var(--text)' }}>{p.name}</span>
                  <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{fmv(p.mv)}</span>
                  <span style={{ color: 'var(--text-3)' }}>{p.age}y</span>
                  {p.joined >= 2025 && (
                    <span title="Recent signing" style={{ color: 'var(--amber, #f59e0b)', fontSize: 9 }}>★new</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

/* ── Save Panel ─────────────────────────────────────────────────────────── */
interface SavePanelItem { id: string; name: string; sub?: string }

function SavePanel({
  title, listLabel, items, onSelect, selectedId,
  linkSearch, onSearchChange, onCancel, onConfirm, saving,
}: {
  title: string; listLabel: string
  items: SavePanelItem[]
  onSelect: (id: string) => void; selectedId: string
  linkSearch: string; onSearchChange: (v: string) => void
  onCancel: () => void; onConfirm: () => void; saving: boolean
}) {
  const filtered = items.filter(it =>
    it.name.toLowerCase().includes(linkSearch.toLowerCase()) ||
    (it.sub || '').toLowerCase().includes(linkSearch.toLowerCase())
  )
  return (
    <div className={styles.savePanel}>
      <div className={styles.savePanelHeader}>
        <span className={styles.savePanelTitle}>{title}</span>
      </div>
      <div className={styles.savePanelBody}>
        <p className={styles.savePanelLabel}>{listLabel}</p>
        <input
          className={styles.savePanelSearch}
          type="text"
          placeholder="Search…"
          value={linkSearch}
          onChange={e => onSearchChange(e.target.value)}
          autoFocus
        />
        <ul className={styles.savePanelList}>
          {filtered.length === 0 && (
            <li className={styles.savePanelEmpty}>No matches</li>
          )}
          {filtered.map(it => (
            <li
              key={it.id}
              className={`${styles.savePanelItem} ${selectedId === it.id ? styles.savePanelItemActive : ''}`}
              onClick={() => onSelect(selectedId === it.id ? '' : it.id)}
            >
              <span className={styles.savePanelItemName}>{it.name}</span>
              {it.sub && <span className={styles.savePanelItemSub}>{it.sub}</span>}
            </li>
          ))}
        </ul>
      </div>
      <div className={styles.savePanelFooter}>
        <button type="button" className={styles.savePanelCancel} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className={styles.savePanelConfirm}
          disabled={saving}
          onClick={onConfirm}
        >
          {saving ? 'Saving…' : selectedId ? 'Confirm & Save' : 'Save without link'}
        </button>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   Main Component
══════════════════════════════════════════════════════════════════════════ */
export function TmScoutView() {
  const nav = useNavigate()
  const [tab, setTab] = useState<Tab>('club')

  /* Firebase */
  const [needs,     setNeeds]     = useState<FbNeed[]>([])
  const [mandates,  setMandates]  = useState<FbMandate[]>([])
  const [fbClubs,   setFbClubs]   = useState<FbClub[]>([])
  const [fbLoading, setFbLoading] = useState(true)
  const [lastSync,  setLastSync]  = useState<Date | null>(null)
  const refreshTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  /* TM search */
  const [query,     setQuery]     = useState('')
  const [tmResults, setTmResults] = useState<(TmPlayer | TmClub)[]>([])
  const [searching, setSearching] = useState(false)
  const [tmError,   setTmError]   = useState<string | null>(null)
  const [searched,  setSearched]  = useState(false)
  const [fbNeedClubs, setFbNeedClubs] = useState<FbNeedClub[]>([])

  /* Filters — multi-select leagues + other criteria */
  const [filterLeagues, setFilterLeagues] = useState<string[]>([])
  const [filterPos,     setFilterPos]     = useState('')
  const [filterAgeMin,  setFilterAgeMin]  = useState('')
  const [filterAgeMax,  setFilterAgeMax]  = useState('')
  const [filterMvMin,   setFilterMvMin]   = useState('')
  const [filterMvMax,   setFilterMvMax]   = useState('')

  /* Save: tmId → { firebaseKey, type } for "View Profile" button */
  const [savedMap,  setSavedMap]  = useState<Record<string, { key: string; type: 'club' | 'mandate' }>>({})
  const [savingId,  setSavingId]  = useState<string | null>(null)

  /* Save panel state */
  const [openSaveId,    setOpenSaveId]    = useState<string | null>(null)
  const [selectedLinkId, setSelectedLinkId] = useState<string>('')
  const [linkSearch,    setLinkSearch]    = useState<string>('')

  /* Agent enrichment — lazy-loaded per player after search */
  const [agentMap,     setAgentMap]     = useState<Record<string, string>>({})
  const [agentLoading, setAgentLoading] = useState(false)
  const [filterAgent,  setFilterAgent]  = useState('')
  const [expandedSquad, setExpandedSquad] = useState<Record<string, boolean>>({})

  /* ── Lazy-load agent names after player/loan search ── */
  useEffect(() => {
    if (tab === 'club' || tmResults.length === 0) return
    setAgentMap({})
    setAgentLoading(true)
    const players = tmResults as TmPlayer[]
    let cancelled = false
    Promise.all(
      players.map(async p => {
        const agent = await fetchTmPlayerAgent(p.id)
        if (!cancelled) setAgentMap(prev => ({ ...prev, [p.id]: agent }))
      })
    ).finally(() => { if (!cancelled) setAgentLoading(false) })
    return () => { cancelled = true }
  }, [tmResults, tab])

  /* ── Load Firebase ── */
  const loadFirebase = useCallback(async () => {
    try {
      const [ns, ms, cs] = await Promise.all([
        get(ref(db, '/needs')),
        get(ref(db, '/mandates')),
        get(ref(db, '/clubs')),
      ])
      const needsArr: FbNeed[] = []
      if (ns.exists()) ns.forEach(c => {
        const v = c.val()
        if (v && v.status !== 'closed' && !v.archived) needsArr.push({ id: c.key!, ...v })
      })
      const mandatesArr: FbMandate[] = []
      if (ms.exists()) ms.forEach(c => {
        const v = c.val()
        if (v && !v.archived) mandatesArr.push({ id: c.key!, ...v })
      })
      const clubsArr: FbClub[] = []
      if (cs.exists()) cs.forEach(c => {
        const v = c.val()
        if (v && v.name) clubsArr.push({ id: c.key!, name: v.name, league: v.league, country: v.country })
      })
      setNeeds(needsArr)
      setMandates(mandatesArr)
      setFbClubs(clubsArr)
      setLastSync(new Date())
    } catch (e) {
      console.error('Firebase load error:', e)
    } finally {
      setFbLoading(false)
    }
  }, [])

  useEffect(() => {
    loadFirebase()
    refreshTimer.current = setInterval(loadFirebase, REFRESH_MS)
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current) }
  }, [loadFirebase])

  /* Reset on tab change */
  useEffect(() => {
    setTmResults([]); setTmError(null); setSearched(false); setQuery('')
    setFilterLeagues([]); setFilterPos('')
    setFilterAgeMin(''); setFilterAgeMax(''); setFilterMvMin(''); setFilterMvMax('')
    setOpenSaveId(null); setSelectedLinkId(''); setLinkSearch('')
    setAgentMap({}); setFilterAgent(''); setExpandedSquad({})
    setFbNeedClubs([])
    if (tab === 'loan') setTimeout(() => setFilterAgeMax('24'), 0)
  }, [tab])

  /* ── TM Search ── */
  const runSearch = useCallback(async () => {
    // Club tab: name optional (search Firebase needs by profile if no name)
    if (tab === 'club' && !query.trim() && !filterPos && !filterMvMin && !filterMvMax) return
    setSearching(true); setTmError(null); setTmResults([]); setFbNeedClubs([]); setSearched(true)
    setOpenSaveId(null); setSelectedLinkId(''); setLinkSearch('')
    try {
      if (tab === 'club') {
        if (query.trim()) {
          // TM name search — find this specific club
          setTmResults(await searchTmClubs(query))
        } else {
          // Firebase needs search — find clubs that want this player profile
          const posFilter = filterPos.toLowerCase()
          const mvMin = filterMvMin ? parseFloat(filterMvMin) : null
          const mvMax = filterMvMax ? parseFloat(filterMvMax) : null

          // Group matching needs by club name
          const clubMap = new Map<string, { needs: FbNeed[]; budMins: number[]; budMaxs: number[] }>()

          for (const need of needs) {
            const clubName = (need.club || need.club_name || '').trim()
            if (!clubName) continue

            // Position match
            if (posFilter) {
              const needPos = [...(need.positions ?? []), need.pos ?? ''].map(p => p.toLowerCase())
              if (!needPos.some(p => p.includes(posFilter) || posFilter.includes(p))) continue
            }

            // Budget vs player MV overlap
            const bMin = parseFloat(String(need.budMin ?? 0)) || 0
            const bMax = parseFloat(String(need.budMax ?? 999)) || 999
            if (mvMin !== null && mvMin > bMax * 1.6) continue
            if (mvMax !== null && mvMax < bMin * 0.5) continue

            if (!clubMap.has(clubName)) clubMap.set(clubName, { needs: [], budMins: [], budMaxs: [] })
            const entry = clubMap.get(clubName)!
            entry.needs.push(need)
            entry.budMins.push(bMin)
            entry.budMaxs.push(bMax)
          }

          // Build FbNeedClub[]
          const results: FbNeedClub[] = []
          for (const [name, { needs: cn, budMins, budMaxs }] of clubMap) {
            // Try to find this club in CRM
            const fbClub = fbClubs.find(c => {
              const a = (c.name || '').toLowerCase()
              const b = name.toLowerCase()
              return a === b || a.includes(b) || b.includes(a)
            })
            const league = fbClub?.league || cn[0]?.league || ''
            const country = fbClub?.country || ''

            // League filter
            if (filterLeagues.length > 0 && league) {
              if (!filterLeagues.some(l => leagueMatches(league, l))) continue
            }

            const bMin = Math.min(...budMins)
            const bMax = Math.max(...budMaxs)
            const midMv = mvMin !== null && mvMax !== null ? (mvMin + mvMax) / 2 : mvMin ?? mvMax ?? null
            const fit = budgetFit(midMv, bMin, bMax)
            const score = Math.round(cn.length * 40 + fit * 60)

            results.push({ id: fbClub?.id || name, name, league, country, activeNeeds: cn, budMin: bMin, budMax: bMax, needScore: score, fbClubId: fbClub?.id })
          }

          results.sort((a, b) => b.needScore - a.needScore)
          setFbNeedClubs(results)
        }
      } else {
        // Use embedded CNF dataset — no proxy required
        const results = searchLocalPlayers({
          name: query.trim() || undefined,
          leagueNames: filterLeagues.length > 0 ? filterLeagues : undefined,
          position: filterPos || undefined,
          ageMin:  filterAgeMin  ? parseInt(filterAgeMin)   : undefined,
          ageMax:  filterAgeMax  ? parseInt(filterAgeMax)   : undefined,
          mvMin:   filterMvMin   ? parseFloat(filterMvMin)  : undefined,
          mvMax:   filterMvMax   ? parseFloat(filterMvMax)  : undefined,
          limit: tab === 'loan' ? 500 : 500,
        })
        setTmResults(results)
      }
    } catch (e) {
      setTmError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setSearching(false)
    }
  }, [query, tab, filterLeagues, filterPos, filterAgeMin, filterAgeMax, filterMvMin, filterMvMax, needs, fbClubs])

  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') runSearch() }

  /* ── Panel helpers ── */
  function openPanel(id: string) {
    setOpenSaveId(prev => (prev === id ? null : id))
    setSelectedLinkId('')
    setLinkSearch('')
  }
  function closePanel() {
    setOpenSaveId(null)
    setSelectedLinkId('')
    setLinkSearch('')
  }

  /* ── Filtered results ── */
  const displayResults = (() => {
    if (tab === 'club') {
      let clubs = tmResults as TmClub[]
      if (filterLeagues.length > 0) {
        clubs = clubs.filter(club =>
          filterLeagues.some(l => leagueMatches(club.league || '', l))
        )
      }
      return clubs
    }

    let players = filterTmPlayers(tmResults as TmPlayer[], {
      position: filterPos || undefined,
      ageMin:   filterAgeMin ? parseInt(filterAgeMin) : undefined,
      ageMax:   filterAgeMax ? parseInt(filterAgeMax) : undefined,
      mvMin:    filterMvMin  ? parseFloat(filterMvMin) : undefined,
      mvMax:    filterMvMax  ? parseFloat(filterMvMax) : undefined,
    })

    if (filterAgent.trim()) {
      const fa = filterAgent.toLowerCase()
      players = players.filter(p => (agentMap[p.id] || '').toLowerCase().includes(fa))
    }

    if (filterLeagues.length > 0) {
      players = players.filter(player => {
        const playerClub = (player.club || '').toLowerCase().trim()
        if (!playerClub) return true
        const fbMatch = fbClubs.find(fc => {
          const fcName = (fc.name || '').toLowerCase()
          return fcName && (fcName.includes(playerClub) || playerClub.includes(fcName))
        })
        if (!fbMatch) return true
        return filterLeagues.some(l => leagueMatches(fbMatch.league || '', l))
      })
    }

    return players
  })()

  /* ── Save club to Firebase ── */
  async function saveClub(club: TmClub, linkedMandateKey?: string, linkedMandateName?: string) {
    setSavingId(club.id)
    try {
      const newRef = push(ref(db, 'clubs'))
      const payload: Record<string, unknown> = {
        name:            club.name,
        league:          club.league  || '',
        country:         club.country || '',
        status:          'Active',
        tm_id:           club.id,
        tm_market_value: club.marketValue || '',
        tm_squad_size:   club.squadSize  || '',
        tm_avg_age:      club.avgAge     || '',
        tm_logo_url:     club.logoUrl    || '',
        tm_profile_url:  club.profileUrl || '',
        tm_search_pos:   filterPos    || '',
        tm_search_age:   filterAgeMin && filterAgeMax ? `${filterAgeMin}–${filterAgeMax}` : '',
        tm_search_mv:    filterMvMin  && filterMvMax  ? `€${filterMvMin}–${filterMvMax}M` : '',
        tm_search_leagues: filterLeagues.length > 0 ? filterLeagues.join(', ') : '',
        savedAt:         Date.now(),
      }
      if (linkedMandateKey) {
        payload.linked_mandate_key  = linkedMandateKey
        payload.linked_mandate_name = linkedMandateName || ''
      }
      await set(newRef, payload)
      setSavedMap(prev => ({ ...prev, [club.id]: { key: newRef.key!, type: 'club' } }))
      await loadFirebase()
    } catch (e) {
      console.error('Save club error:', e)
    } finally {
      setSavingId(null)
    }
  }

  /* ── Save player to Firebase ── */
  async function savePlayer(player: TmPlayer, linkedClubKey?: string, linkedClubName?: string) {
    setSavingId(player.id)
    try {
      const newRef = push(ref(db, 'mandates'))
      const payload: Record<string, unknown> = {
        name:              player.name,
        pos:               player.position  || '',
        age:               player.age       || '',
        nationality:       player.nationality || '',
        club:              player.club      || '',
        value:             player.marketValue || '',
        tm_id:             player.id,
        tm_profile_url:    player.profileUrl || '',
        tm_image_url:      player.imageUrl  || '',
        source:            'tm_scout',
        savedAt:           Date.now(),
        statusText:        'Active Mandate',
      }
      if (linkedClubKey) {
        payload.linked_club_key  = linkedClubKey
        payload.linked_club_name = linkedClubName || ''
      }
      await set(newRef, payload)
      setSavedMap(prev => ({ ...prev, [player.id]: { key: newRef.key!, type: 'mandate' } }))
      await loadFirebase()
    } catch (e) {
      console.error('Save player error:', e)
    } finally {
      setSavingId(null)
    }
  }

  /* ── Demo rows (always visible — no proxy needed) ── */
  const DEMO_CLUB: TmClub = {
    id: '__demo_club__',
    name: 'FC Example United',
    league: 'Bundesliga',
    country: 'Germany',
    logoUrl: '',
    squadSize: '26',
    avgAge: '25.2',
    marketValue: '€180m',
    profileUrl: '',
  }
  const DEMO_PLAYER: TmPlayer = {
    id: '__demo_player__',
    name: 'Demo Player (ST)',
    position: 'ST',
    age: '24',
    nationality: 'German',
    club: 'FC Example United',
    marketValue: '€8m',
    imageUrl: '',
    profileUrl: '',
  }
  const DEMO_LOAN: TmPlayer = {
    id: '__demo_loan__',
    name: 'Demo Loan Player (LW)',
    position: 'LW',
    age: '21',
    nationality: 'Spanish',
    club: 'Example FC B',
    marketValue: '€3m',
    imageUrl: '',
    profileUrl: '',
  }

  /* ── Squad depth toggle ── */
  function toggleSquad(id: string) {
    setExpandedSquad(prev => ({ ...prev, [id]: !prev[id] }))
  }

  /* ── Link options ── */
  const mandateOptions: SavePanelItem[] = mandates
    .filter(m => !m.archived && m.name)
    .map(m => ({ id: m.id, name: m.name!, sub: m.pos }))

  const clubOptions: SavePanelItem[] = fbClubs
    .filter(c => c.name)
    .map(c => ({ id: c.id, name: c.name!, sub: c.league }))

  /* ── Header sub ── */
  const sub = fbLoading
    ? 'Loading…'
    : `${needs.length} active needs · ${mandates.length} mandates${
        lastSync ? ` · synced ${lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''
      }`

  /* ── Render ── */
  return (
    <div className={styles.page}>
      <style>{`@keyframes tm-spin { to { transform: rotate(360deg) } }`}</style>

      <PageHeader
        title="TM Scout"
        sub={sub}
        actions={
          <button className={styles.refreshBtn} onClick={loadFirebase} title="Sync Firebase data">
            <RefreshIcon size={13} /> Sync
          </button>
        }
      />

      {/* ── Tabs ── */}
      <div className={styles.tabBar}>
        {([
          { id: 'club',   label: '⚽ Find a Club' },
          { id: 'player', label: '👤 Find a Player' },
          { id: 'loan',   label: '🔄 Find a Loan Player' },
        ] as { id: Tab; label: string }[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Search panel ── */}
      <div className={styles.searchPanel}>
        <div className={styles.searchRow}>
          <input
            className={styles.searchInput}
            type="search" value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder={
              tab === 'club' ? 'Club name (optional — set profile below to find buyers)…'
              : tab === 'player' ? 'Filter by name (optional)…'
              : 'Filter loan player by name (optional)…'
            }
          />
          <button className={styles.searchBtn} onClick={runSearch}
            disabled={searching || (tab === 'club' && !query.trim() && !filterPos && !filterMvMin && !filterMvMax)}>
            {searching ? <Spinner white /> : <SearchIcon size={14} />}
            {searching ? 'Searching…'
              : tab === 'club' && query.trim() ? 'Search TM'
              : tab === 'club' ? 'Find Buyers'
              : 'Search'}
          </button>
        </div>

        {/* ── Filters — league on ALL tabs ── */}
        <div className={styles.filterRow}>
          <MultiLeagueSelect selected={filterLeagues} onChange={setFilterLeagues} />
          <div className={styles.filterDivider} />

          {tab === 'club' && (
            <>
              <span className={styles.filterGroupLabel}>Player profile:</span>
              <FilterSelect label="Position" value={filterPos} onChange={setFilterPos} options={POSITIONS} placeholder="Any" />
              <RangeFilter label="Age" min={filterAgeMin} max={filterAgeMax} onMin={setFilterAgeMin} onMax={setFilterAgeMax} />
              <RangeFilter label="MV (€M)" min={filterMvMin} max={filterMvMax} onMin={setFilterMvMin} onMax={setFilterMvMax} />
            </>
          )}

          {(tab === 'player' || tab === 'loan') && (
            <>
              <FilterSelect label="Position" value={filterPos} onChange={setFilterPos} options={POSITIONS} placeholder="All positions" />
              <RangeFilter label="Age" min={filterAgeMin} max={filterAgeMax} onMin={setFilterAgeMin} onMax={setFilterAgeMax} />
              <RangeFilter label="MV (€M)" min={filterMvMin} max={filterMvMax} onMin={setFilterMvMin} onMax={setFilterMvMax} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>Agency</span>
                <input
                  type="text"
                  value={filterAgent}
                  onChange={e => setFilterAgent(e.target.value)}
                  placeholder="e.g. Stellar…"
                  style={{ height: 30, padding: '0 8px', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12, width: 120 }}
                />
              </div>
            </>
          )}
        </div>

        {/* League chips */}
        {filterLeagues.length > 0 && (
          <div className={styles.leagueChips}>
            {filterLeagues.map(l => (
              <span key={l} className={styles.leagueChip}>
                {l}
                <button
                  type="button"
                  className={styles.leagueChipRemove}
                  onClick={() => setFilterLeagues(filterLeagues.filter(x => x !== l))}
                  aria-label={`Remove ${l}`}
                >×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Error ── */}
      {tmError && (
        <div className={styles.errorCard}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div>
            <div className={styles.errorTitle}>TM Proxy Unavailable</div>
            <div className={styles.errorMsg}>{tmError}</div>
            <div className={styles.errorHint}>
              TM club name search requires a working Netlify deployment. "Find Buyers" (no name) uses your Firebase needs data and always works.
            </div>
          </div>
        </div>
      )}

      {/* No results */}
      {!tmError && searched && !searching && displayResults.length === 0 && fbNeedClubs.length === 0 && (
        <div className={styles.empty}>
          {tab === 'club' && !query.trim()
            ? filterPos
              ? `No clubs in your active needs match a ${filterPos}${filterMvMin || filterMvMax ? ` at that MV range` : ''}.`
              : 'Set a position (and optionally MV range) then click Find Buyers to see potential buyer clubs.'
            : filterLeagues.length > 0
              ? `No results in selected league${filterLeagues.length > 1 ? 's' : ''} — try different leagues or clear the filter.`
              : 'No results found — try a different search term.'}
        </div>
      )}

      {/* ── Club results — Firebase needs mode (no TM name search) ── */}
      {tab === 'club' && !tmError && fbNeedClubs.length > 0 && tmResults.length === 0 && (
        <div className={styles.tableWrap}>
          <div className={styles.contextBar}>
            <strong>{fbNeedClubs.length} potential buyer{fbNeedClubs.length !== 1 ? 's' : ''}</strong> from your active needs
            {filterPos ? <> · need a <strong>{filterPos}</strong></> : null}
            {(filterMvMin || filterMvMax) ? <> · player MV €{filterMvMin||'0'}–{filterMvMax||'∞'}M</> : null}
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Club</th>
                <th className={styles.th}>League</th>
                <th className={styles.th}>Open Need(s)</th>
                <th className={`${styles.th} ${styles.thNum}`}>Budget</th>
                <th className={`${styles.th} ${styles.thNum}`}>Fit</th>
                <th className={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {fbNeedClubs.map((club) => {
                const mvMid = filterMvMin && filterMvMax
                  ? (parseFloat(filterMvMin) + parseFloat(filterMvMax)) / 2
                  : filterMvMin ? parseFloat(filterMvMin) : filterMvMax ? parseFloat(filterMvMax) : null
                const fit = budgetFit(mvMid, club.budMin, club.budMax)
                const fitPct = Math.round(fit * 100)
                const fitColor = fit >= 0.8 ? 'var(--accent)' : fit >= 0.5 ? '#d97706' : 'var(--text-3)'
                // Collect unique position tags from all needs
                const allPos = Array.from(new Set(
                  club.activeNeeds.flatMap(n => [...(n.positions ?? []), n.pos ?? ''].filter(Boolean))
                ))
                return (
                  <tr key={club.id} className={styles.tr}>
                    <td className={styles.td}>
                      <div className={styles.entityCell}>
                        <Avatar imageUrl="" name={club.name} size={24} />
                        <span className={styles.entityName}>{club.name}</span>
                      </div>
                    </td>
                    <td className={styles.td}>
                      <span className={styles.meta}>{club.league || '—'}</span>
                    </td>
                    <td className={styles.td}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {allPos.map(p => (
                          <span key={p} className={styles.posBadge} style={{ fontSize: 10 }}>{p}</span>
                        ))}
                        {allPos.length === 0 && <span className={styles.meta}>—</span>}
                      </div>
                    </td>
                    <td className={`${styles.td} ${styles.tdNum}`}>
                      <span className={styles.meta} style={{ fontSize: 11 }}>
                        {budgetLabel(club.budMin, club.budMax)}
                      </span>
                    </td>
                    <td className={`${styles.td} ${styles.tdNum}`}>
                      {mvMid !== null
                        ? <span style={{ fontSize: 12, fontWeight: 700, color: fitColor }}>{fitPct}%</span>
                        : <span className={styles.meta}>—</span>}
                    </td>
                    <td className={styles.td}>
                      <div className={styles.rowActions}>
                        {club.fbClubId ? (
                          <button className={styles.savedBtn} onClick={() => nav(`/clubs/${club.fbClubId}`)}>
                            View Profile
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Club results — TM name search ── */}
      {tab === 'club' && !tmError && displayResults.length > 0 && (
        <div className={styles.tableWrap}>
          {filterPos && (
            <div className={styles.contextBar}>
              Looking for: <strong>{filterPos}</strong>
              {filterAgeMin || filterAgeMax ? ` · Age ${filterAgeMin || '?'}–${filterAgeMax || '?'}` : ''}
              {filterMvMin || filterMvMax ? ` · €${filterMvMin || '0'}–${filterMvMax || '∞'}M` : ''}
              {filterLeagues.length > 0 ? ` · ${filterLeagues.join(', ')}` : ''}
            </div>
          )}
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Club</th>
                <th className={styles.th}>League / Country</th>
                <th className={`${styles.th} ${styles.thNum}`}>Squad</th>
                <th className={`${styles.th} ${styles.thNum}`}>Avg Age</th>
                <th className={`${styles.th} ${styles.thNum}`}>Market Value</th>
                <th className={`${styles.th} ${styles.thNum}`} title="Cross-ref with your active needs">Need Score</th>
                <th className={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {(displayResults as TmClub[]).map((club, i) => {
                const score   = needScore(club, needs, filterPos)
                const saved   = savedMap[club.id]
                const isOpen  = openSaveId === club.id
                const isSaving = savingId === club.id
                const squadKey = `club-${club.id}`
                const squadOpen = expandedSquad[squadKey]
                const clubCtx = filterPos ? getSquadContext(club.name, filterPos) : null
                return (
                  <Fragment key={club.id || i}>
                    <tr className={`${styles.tr} ${isOpen ? styles.trOpen : ''}`}>
                      <td className={styles.td}>
                        <div className={styles.entityCell}>
                          <Avatar imageUrl={club.logoUrl} name={club.name} size={24} />
                          <span className={styles.entityName}>{club.name}</span>
                        </div>
                      </td>
                      <td className={styles.td}>
                        <div className={styles.metaStack}>
                          <span className={styles.meta}>{club.league || '—'}</span>
                          {club.country && <span className={styles.metaSub}>{club.country}</span>}
                        </div>
                      </td>
                      <td className={`${styles.td} ${styles.tdNum}`}><span className={styles.num}>{club.squadSize || '—'}</span></td>
                      <td className={`${styles.td} ${styles.tdNum}`}><span className={styles.num}>{club.avgAge || '—'}</span></td>
                      <td className={`${styles.td} ${styles.tdNum}`}><span className={styles.mv}>{club.marketValue || '—'}</span></td>
                      <td className={`${styles.td} ${styles.tdNum}`}><ScoreBadge score={score} /></td>
                      <td className={styles.td}>
                        <div className={styles.rowActions}>
                          {clubCtx && (
                            <button
                              onClick={() => toggleSquad(squadKey)}
                              style={{
                                fontSize: 11, fontWeight: 600, padding: '2px 7px', height: 26,
                                borderRadius: 'var(--r-md)', cursor: 'pointer',
                                background: squadOpen ? 'var(--accent-dim)' : 'var(--surface-2)',
                                color: squadOpen ? 'var(--accent)' : 'var(--text-2)',
                                border: '1px solid var(--border)',
                              }}
                              title={`${filterPos} depth at this club`}
                            >
                              {squadOpen ? '▲' : '▼'} {filterPos} ({clubCtx.depth})
                            </button>
                          )}
                          {club.profileUrl && (
                            <a href={club.profileUrl} target="_blank" rel="noopener noreferrer"
                              className={styles.tmLink} title="View on Transfermarkt">
                              TM ↗
                            </a>
                          )}
                          {saved ? (
                            <button className={styles.savedBtn} onClick={() => nav(`/clubs/${saved.key}`)}>
                              ✓ View Profile
                            </button>
                          ) : (
                            <button
                              className={`${styles.saveBtn} ${isOpen ? styles.saveBtnOpen : ''}`}
                              onClick={() => openPanel(club.id)}
                              disabled={isSaving}
                            >
                              {isSaving ? <Spinner /> : null}
                              {isSaving ? 'Saving…' : isOpen ? '▲ Close' : '+ Save'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {squadOpen && clubCtx && (
                      <SquadDepthContent ctx={clubCtx} colSpan={7} />
                    )}
                    {isOpen && (
                      <tr className={styles.savePanelRow}>
                        <td colSpan={7} className={styles.savePanelCell}>
                          <SavePanel
                            title={`Save "${club.name}" to CRM`}
                            listLabel="Link to a player mandate — which player are you scouting this club for?"
                            items={mandateOptions}
                            onSelect={setSelectedLinkId}
                            selectedId={selectedLinkId}
                            linkSearch={linkSearch}
                            onSearchChange={setLinkSearch}
                            onCancel={closePanel}
                            saving={!!isSaving}
                            onConfirm={() => {
                              const linked = mandates.find(m => m.id === selectedLinkId)
                              saveClub(club, linked?.id, linked?.name)
                              closePanel()
                            }}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Player / Loan results ── */}
      {(tab === 'player' || tab === 'loan') && !tmError && displayResults.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Player</th>
                <th className={styles.th}>Position</th>
                <th className={`${styles.th} ${styles.thNum}`}>Age</th>
                <th className={styles.th}>Nationality</th>
                <th className={styles.th}>Current Club</th>
                <th className={`${styles.th} ${styles.thNum}`}>Market Value</th>
                <th className={`${styles.th} ${styles.thNum}`} title="Active club needs this player fits">Needs Match</th>
                <th className={styles.th}>Agent / Agency</th>
                <th className={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {(displayResults as TmPlayer[]).map((player, i) => {
                const matches  = mandateMatchCount(player, needs)
                const saved    = savedMap[player.id]
                const isOpen   = openSaveId === player.id
                const isSaving = savingId === player.id
                const squadOpen = expandedSquad[player.id]
                const playerMv = parseTmValue(player.marketValue)
                const playerCtx = player.club && player.position
                  ? getSquadContext(player.club, player.position, playerMv)
                  : null
                return (
                  <Fragment key={player.id || i}>
                    <tr className={`${styles.tr} ${isOpen ? styles.trOpen : ''}`}>
                      <td className={styles.td}>
                        <div className={styles.entityCell}>
                          <Avatar imageUrl={player.imageUrl} name={player.name} size={28} round />
                          <span className={styles.entityName}>{player.name}</span>
                        </div>
                      </td>
                      <td className={styles.td}>
                        {player.position
                          ? <span className={styles.posBadge}>{player.position}</span>
                          : <span className={styles.meta}>—</span>}
                      </td>
                      <td className={`${styles.td} ${styles.tdNum}`}><span className={styles.num}>{player.age || '—'}</span></td>
                      <td className={styles.td}><span className={styles.meta}>{player.nationality || '—'}</span></td>
                      <td className={styles.td}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span className={styles.meta}>{player.club || '—'}</span>
                          {playerCtx && (
                            <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
                              {playerCtx.depth}× {player.position}
                              {playerCtx.sellSignal ? ' 🔴' : playerCtx.buySignal ? ' 🟢' : ''}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={`${styles.td} ${styles.tdNum}`}><span className={styles.mv}>{player.marketValue || '—'}</span></td>
                      <td className={`${styles.td} ${styles.tdNum}`}><MatchBadge count={matches} /></td>
                      <td className={styles.td}>
                        <span className={styles.meta} style={{ maxWidth: 130, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={agentMap[player.id] || ''}>
                          {agentMap[player.id] === undefined
                            ? (agentLoading ? '…' : '—')
                            : agentMap[player.id] || '—'}
                        </span>
                      </td>
                      <td className={styles.td}>
                        <div className={styles.rowActions}>
                          {playerCtx && (
                            <button
                              onClick={() => toggleSquad(player.id)}
                              style={{
                                fontSize: 11, fontWeight: 600, padding: '2px 7px', height: 26,
                                borderRadius: 'var(--r-md)', cursor: 'pointer',
                                background: squadOpen ? 'var(--accent-dim)' : 'var(--surface-2)',
                                color: squadOpen ? 'var(--accent)' : 'var(--text-2)',
                                border: '1px solid var(--border)',
                              }}
                              title="Squad depth at current club"
                            >
                              {squadOpen ? '▲' : '▼'} Depth
                            </button>
                          )}
                          {player.profileUrl && (
                            <a href={player.profileUrl} target="_blank" rel="noopener noreferrer"
                              className={styles.tmLink} title="View on Transfermarkt">
                              TM ↗
                            </a>
                          )}
                          {saved ? (
                            <button className={styles.savedBtn} onClick={() => nav(`/mandates/${saved.key}`)}>
                              ✓ View Profile
                            </button>
                          ) : (
                            <button
                              className={`${styles.saveBtn} ${isOpen ? styles.saveBtnOpen : ''}`}
                              onClick={() => openPanel(player.id)}
                              disabled={isSaving}
                            >
                              {isSaving ? <Spinner /> : null}
                              {isSaving ? 'Saving…' : isOpen ? '▲ Close' : '+ Save'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {squadOpen && playerCtx && (
                      <SquadDepthContent ctx={playerCtx} playerMv={playerMv} colSpan={9} />
                    )}
                    {isOpen && (
                      <tr className={styles.savePanelRow}>
                        <td colSpan={9} className={styles.savePanelCell}>
                          <SavePanel
                            title={`Save "${player.name}" to CRM${tab === 'loan' ? ' (Loan)' : ''}`}
                            listLabel="Link to a club in CRM — which club needs this player?"
                            items={clubOptions}
                            onSelect={setSelectedLinkId}
                            selectedId={selectedLinkId}
                            linkSearch={linkSearch}
                            onSearchChange={setLinkSearch}
                            onCancel={closePanel}
                            saving={!!isSaving}
                            onConfirm={() => {
                              const linked = fbClubs.find(c => c.id === selectedLinkId)
                              savePlayer(player, linked?.id, linked?.name)
                              closePanel()
                            }}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
          {tab === 'loan' && (
            <div className={styles.loanNote}>
              🔄 Showing players ≤ {filterAgeMax || '24'} — typical loan profile
            </div>
          )}
        </div>
      )}

      {/* ── Demo section — always visible to test save panel ── */}
      {tab === 'club' && (() => {
        const club = DEMO_CLUB
        const score = needScore(club, needs, filterPos)
        const isOpen = openSaveId === club.id
        const isSaving = savingId === club.id
        return (
          <div className={styles.demoWrap}>
            <div className={styles.demoBanner}>
              <span className={styles.demoBadge}>DEMO</span>
              Example row — click <strong>+ Save</strong> to try the save panel (no proxy needed)
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>Club</th>
                    <th className={styles.th}>League / Country</th>
                    <th className={`${styles.th} ${styles.thNum}`}>Squad</th>
                    <th className={`${styles.th} ${styles.thNum}`}>Avg Age</th>
                    <th className={`${styles.th} ${styles.thNum}`}>Market Value</th>
                    <th className={`${styles.th} ${styles.thNum}`}>Need Score</th>
                    <th className={styles.th}></th>
                  </tr>
                </thead>
                <tbody>
                  <Fragment key={club.id}>
                    <tr className={`${styles.tr} ${isOpen ? styles.trOpen : ''}`}>
                      <td className={styles.td}>
                        <div className={styles.entityCell}>
                          <Avatar imageUrl="" name={club.name} size={24} />
                          <span className={styles.entityName}>{club.name}</span>
                        </div>
                      </td>
                      <td className={styles.td}>
                        <div className={styles.metaStack}>
                          <span className={styles.meta}>{club.league}</span>
                          <span className={styles.metaSub}>{club.country}</span>
                        </div>
                      </td>
                      <td className={`${styles.td} ${styles.tdNum}`}><span className={styles.num}>{club.squadSize}</span></td>
                      <td className={`${styles.td} ${styles.tdNum}`}><span className={styles.num}>{club.avgAge}</span></td>
                      <td className={`${styles.td} ${styles.tdNum}`}><span className={styles.mv}>{club.marketValue}</span></td>
                      <td className={`${styles.td} ${styles.tdNum}`}><ScoreBadge score={score} /></td>
                      <td className={styles.td}>
                        <div className={styles.rowActions}>
                          <button
                            className={`${styles.saveBtn} ${isOpen ? styles.saveBtnOpen : ''}`}
                            onClick={() => openPanel(club.id)}
                            disabled={!!isSaving}
                          >
                            {isSaving ? <Spinner /> : null}
                            {isSaving ? 'Saving…' : isOpen ? '▲ Close' : '+ Save'}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className={styles.savePanelRow}>
                        <td colSpan={7} className={styles.savePanelCell}>
                          <SavePanel
                            title={`Save "${club.name}" to CRM`}
                            listLabel="Link to a player mandate — which player are you scouting this club for?"
                            items={mandateOptions}
                            onSelect={setSelectedLinkId}
                            selectedId={selectedLinkId}
                            linkSearch={linkSearch}
                            onSearchChange={setLinkSearch}
                            onCancel={closePanel}
                            saving={!!isSaving}
                            onConfirm={() => {
                              const linked = mandates.find(m => m.id === selectedLinkId)
                              saveClub(club, linked?.id, linked?.name)
                              closePanel()
                            }}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                </tbody>
              </table>
            </div>
          </div>
        )
      })()}

      {(tab === 'player' || tab === 'loan') && (() => {
        const player = tab === 'loan' ? DEMO_LOAN : DEMO_PLAYER
        const matches = mandateMatchCount(player, needs)
        const isOpen = openSaveId === player.id
        const isSaving = savingId === player.id
        return (
          <div className={styles.demoWrap}>
            <div className={styles.demoBanner}>
              <span className={styles.demoBadge}>DEMO</span>
              Example row — click <strong>+ Save</strong> to try the save panel (no proxy needed)
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>Player</th>
                    <th className={styles.th}>Position</th>
                    <th className={`${styles.th} ${styles.thNum}`}>Age</th>
                    <th className={styles.th}>Nationality</th>
                    <th className={styles.th}>Current Club</th>
                    <th className={`${styles.th} ${styles.thNum}`}>Market Value</th>
                    <th className={`${styles.th} ${styles.thNum}`}>Needs Match</th>
                    <th className={styles.th}>Agent / Agency</th>
                    <th className={styles.th}></th>
                  </tr>
                </thead>
                <tbody>
                  <Fragment key={player.id}>
                    <tr className={`${styles.tr} ${isOpen ? styles.trOpen : ''}`}>
                      <td className={styles.td}>
                        <div className={styles.entityCell}>
                          <Avatar imageUrl="" name={player.name} size={28} round />
                          <span className={styles.entityName}>{player.name}</span>
                        </div>
                      </td>
                      <td className={styles.td}>
                        <span className={styles.posBadge}>{player.position}</span>
                      </td>
                      <td className={`${styles.td} ${styles.tdNum}`}><span className={styles.num}>{player.age}</span></td>
                      <td className={styles.td}><span className={styles.meta}>{player.nationality}</span></td>
                      <td className={styles.td}><span className={styles.meta}>{player.club}</span></td>
                      <td className={`${styles.td} ${styles.tdNum}`}><span className={styles.mv}>{player.marketValue}</span></td>
                      <td className={`${styles.td} ${styles.tdNum}`}><MatchBadge count={matches} /></td>
                      <td className={styles.td}>
                        <span className={styles.meta}>—</span>
                      </td>
                      <td className={styles.td}>
                        <div className={styles.rowActions}>
                          <button
                            className={`${styles.saveBtn} ${isOpen ? styles.saveBtnOpen : ''}`}
                            onClick={() => openPanel(player.id)}
                            disabled={!!isSaving}
                          >
                            {isSaving ? <Spinner /> : null}
                            {isSaving ? 'Saving…' : isOpen ? '▲ Close' : '+ Save'}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className={styles.savePanelRow}>
                        <td colSpan={9} className={styles.savePanelCell}>
                          <SavePanel
                            title={`Save "${player.name}" to CRM${tab === 'loan' ? ' (Loan)' : ''}`}
                            listLabel="Link to a club in CRM — which club needs this player?"
                            items={clubOptions}
                            onSelect={setSelectedLinkId}
                            selectedId={selectedLinkId}
                            linkSearch={linkSearch}
                            onSearchChange={setLinkSearch}
                            onCancel={closePanel}
                            saving={!!isSaving}
                            onConfirm={() => {
                              const linked = fbClubs.find(c => c.id === selectedLinkId)
                              savePlayer(player, linked?.id, linked?.name)
                              closePanel()
                            }}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                </tbody>
              </table>
            </div>
          </div>
        )
      })()}

      {/* ── Pre-search prompt ── */}
      {!tmError && !searched && !searching && (
        <div className={styles.promptCard}>
          <div style={{ fontSize: 36 }}>
            {tab === 'club' ? '⚽' : tab === 'player' ? '👤' : '🔄'}
          </div>
          <div className={styles.promptTitle}>
            {tab === 'club' ? 'Search for a club on Transfermarkt'
              : tab === 'player' ? 'Search for a player on Transfermarkt'
              : 'Search for a loan candidate on Transfermarkt'}
          </div>
          <div className={styles.promptSub}>
            {tab === 'club'
              ? `Set a player profile to calculate Need Score against your ${needs.length} active needs`
              : `Filter by league, position and age — results matched against your ${needs.length} active club needs`}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Icons ─────────────────────────────────────────────────────────────── */
function SearchIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
      <circle cx="7" cy="7" r="4.5"/><line x1="10.5" y1="10.5" x2="14" y2="14"/>
    </svg>
  )
}
function RefreshIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 8a6 6 0 0 1 6-6 6 6 0 0 1 4.24 1.76L14 6"/><path d="M14 2v4h-4"/>
      <path d="M14 8a6 6 0 0 1-6 6 6 6 0 0 1-4.24-1.76L2 10"/><path d="M2 14v-4h4"/>
    </svg>
  )
}
