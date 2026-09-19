/**
 * TmScoutView — Transfermarkt Scout
 *
 * Three tabs:
 *   1. Find a Club   — search TM clubs, define the player profile you're placing,
 *                      cross-ref with Firebase needs/mandates → Need Score
 *   2. Find a Player — search TM players, match against active club needs
 *   3. Find a Loan Player — same as player, pre-set age ≤ 24
 *
 * "Save" on any row writes to Firebase (/clubs or /mandates) and the record
 * immediately appears on that club's / player's profile page.
 *
 * Firebase data auto-refreshes every 5 min in the background.
 * TM search runs on explicit user action (Enter / Search TM button).
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { ref, get, push, set } from 'firebase/database'
import { db } from '../data/firebase'
import { PageHeader } from '../components/PageHeader'
import {
  searchTmPlayers,
  searchTmClubs,
  filterTmPlayers,
  parseTmValue,
  type TmPlayer,
  type TmClub,
} from '../data/tmApi'
import { useNavigate } from 'react-router-dom'
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
  status?: string
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
  const leagueMatches = needs.filter(n => {
    const nl = (n.league || '').toLowerCase()
    const cl = club.league.toLowerCase()
    return nl && cl && (nl.includes(cl) || cl.includes(nl))
  })
  return Math.min(100,
    posDirectNeeds.length * 50 +
    (directNeeds.length - posDirectNeeds.length) * 20 +
    leagueMatches.length * 10
  )
}

function mandateMatchCount(player: TmPlayer, needs: FbNeed[]): number {
  const pos = player.position.toLowerCase()
  const age = parseInt(player.age, 10)
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

/* ══════════════════════════════════════════════════════════════════════════
   Main Component
══════════════════════════════════════════════════════════════════════════ */
export function TmScoutView() {
  const nav = useNavigate()
  const [tab, setTab] = useState<Tab>('club')

  /* Firebase */
  const [needs,     setNeeds]     = useState<FbNeed[]>([])
  const [mandates,  setMandates]  = useState<FbMandate[]>([])
  const [fbLoading, setFbLoading] = useState(true)
  const [lastSync,  setLastSync]  = useState<Date | null>(null)
  const refreshTimer = useRef<ReturnType<typeof setInterval>>()

  /* TM search */
  const [query,     setQuery]     = useState('')
  const [tmResults, setTmResults] = useState<(TmPlayer | TmClub)[]>([])
  const [searching, setSearching] = useState(false)
  const [tmError,   setTmError]   = useState<string | null>(null)
  const [searched,  setSearched]  = useState(false)

  /* Filters — shared state, reset on tab change */
  const [filterLeague, setFilterLeague] = useState('')
  const [filterPos,    setFilterPos]    = useState('')
  const [filterAgeMin, setFilterAgeMin] = useState('')
  const [filterAgeMax, setFilterAgeMax] = useState('')
  const [filterMvMin,  setFilterMvMin]  = useState('')
  const [filterMvMax,  setFilterMvMax]  = useState('')

  /* Save state: tmId → { firebaseKey, type } */
  const [savedMap,  setSavedMap]  = useState<Record<string, { key: string; type: 'club' | 'mandate' }>>({})
  const [savingId,  setSavingId]  = useState<string | null>(null)

  /* ── Load Firebase ── */
  const loadFirebase = useCallback(async () => {
    try {
      const [ns, ms] = await Promise.all([
        get(ref(db, '/needs')),
        get(ref(db, '/mandates')),
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
      setNeeds(needsArr)
      setMandates(mandatesArr)
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
    setFilterLeague(''); setFilterPos(''); setFilterAgeMin(''); setFilterAgeMax(''); setFilterMvMin(''); setFilterMvMax('')
    if (tab === 'loan') { setTimeout(() => setFilterAgeMax('24'), 0) }
  }, [tab])

  /* ── TM Search ── */
  const runSearch = useCallback(async () => {
    if (!query.trim()) return
    setSearching(true); setTmError(null); setTmResults([]); setSearched(true)
    try {
      if (tab === 'club') {
        setTmResults(await searchTmClubs(query))
      } else {
        setTmResults(await searchTmPlayers(query))
      }
    } catch (e) {
      setTmError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setSearching(false)
    }
  }, [query, tab])

  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') runSearch() }

  /* ── Filtered results ── */
  const displayResults = (() => {
    if (tab === 'club') return tmResults as TmClub[]
    return filterTmPlayers(tmResults as TmPlayer[], {
      position: filterPos || undefined,
      ageMin:   filterAgeMin ? parseInt(filterAgeMin) : undefined,
      ageMax:   filterAgeMax ? parseInt(filterAgeMax) : undefined,
      mvMin:    filterMvMin  ? parseFloat(filterMvMin) : undefined,
      mvMax:    filterMvMax  ? parseFloat(filterMvMax) : undefined,
    })
  })()

  /* ── Save club to Firebase ── */
  async function saveClub(club: TmClub) {
    setSavingId(club.id)
    try {
      const newRef = push(ref(db, 'clubs'))
      await set(newRef, {
        name:             club.name,
        league:           club.league  || '',
        country:          club.country || '',
        status:           'Active',
        tm_id:            club.id,
        tm_market_value:  club.marketValue || '',
        tm_squad_size:    club.squadSize  || '',
        tm_avg_age:       club.avgAge     || '',
        tm_logo_url:      club.logoUrl    || '',
        tm_profile_url:   club.profileUrl || '',
        // Saved search context — what player profile were we targeting here?
        tm_search_pos:    filterPos    || '',
        tm_search_age:    filterAgeMin && filterAgeMax ? `${filterAgeMin}–${filterAgeMax}` : '',
        tm_search_mv:     filterMvMin  && filterMvMax  ? `€${filterMvMin}–${filterMvMax}M` : '',
        savedAt:          Date.now(),
      })
      setSavedMap(prev => ({ ...prev, [club.id]: { key: newRef.key!, type: 'club' } }))
    } catch (e) {
      console.error('Save club error:', e)
    } finally {
      setSavingId(null)
    }
  }

  /* ── Save player to Firebase ── */
  async function savePlayer(player: TmPlayer) {
    setSavingId(player.id)
    try {
      const newRef = push(ref(db, 'mandates'))
      await set(newRef, {
        name:           player.name,
        pos:            player.position  || '',
        age:            player.age       || '',
        nationality:    player.nationality || '',
        club:           player.club      || '',
        value:          player.marketValue || '',
        tm_id:          player.id,
        tm_profile_url: player.profileUrl || '',
        tm_image_url:   player.imageUrl  || '',
        source:         'tm_scout',
        savedAt:        Date.now(),
        statusText:     'Active Mandate',
      })
      setSavedMap(prev => ({ ...prev, [player.id]: { key: newRef.key!, type: 'mandate' } }))
    } catch (e) {
      console.error('Save player error:', e)
    } finally {
      setSavingId(null)
    }
  }

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
              tab === 'club' ? 'Search club name on Transfermarkt…'
              : tab === 'player' ? 'Search player name on Transfermarkt…'
              : 'Search loan player on Transfermarkt…'
            }
          />
          <button className={styles.searchBtn} onClick={runSearch} disabled={searching || !query.trim()}>
            {searching ? <Spinner white /> : <SearchIcon size={14} />}
            {searching ? 'Searching…' : 'Search TM'}
          </button>
        </div>

        {/* ── Filters ── */}
        <div className={styles.filterRow}>
          {tab === 'club' && (
            <>
              <FilterSelect label="League" value={filterLeague} onChange={setFilterLeague} options={LEAGUES} placeholder="All leagues" />
              <div className={styles.filterDivider} />
              {/* Player profile you're trying to place at this club */}
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
            </>
          )}
        </div>
      </div>

      {/* ── Error ── */}
      {tmError && (
        <div className={styles.errorCard}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div>
            <div className={styles.errorTitle}>TM Proxy Unavailable</div>
            <div className={styles.errorMsg}>{tmError}</div>
            <div className={styles.errorHint}>
              Run <code>npm run dev</code> in the <code>efp-ops</code> folder (port 3000) to enable Transfermarkt search.
            </div>
          </div>
        </div>
      )}

      {/* No results */}
      {!tmError && searched && !searching && displayResults.length === 0 && (
        <div className={styles.empty}>No results found — try a different search term.</div>
      )}

      {/* ── Club results ── */}
      {tab === 'club' && !tmError && displayResults.length > 0 && (
        <div className={styles.tableWrap}>
          {filterPos && (
            <div className={styles.contextBar}>
              Looking for: <strong>{filterPos}</strong>
              {filterAgeMin || filterAgeMax ? ` · Age ${filterAgeMin || '?'}–${filterAgeMax || '?'}` : ''}
              {filterMvMin || filterMvMax ? ` · €${filterMvMin || '0'}–${filterMvMax || '∞'}M` : ''}
            </div>
          )}
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Club</th>
                <th className={styles.th}>League / Country</th>
                <th className={styles.th + ' ' + styles.thNum}>Squad</th>
                <th className={styles.th + ' ' + styles.thNum}>Avg Age</th>
                <th className={styles.th + ' ' + styles.thNum}>Market Value</th>
                <th className={styles.th + ' ' + styles.thNum} title="Cross-ref with your active needs">Need Score</th>
                <th className={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {(displayResults as TmClub[]).map((club, i) => {
                const score    = needScore(club, needs, filterPos)
                const saved    = savedMap[club.id]
                const isSaving = savingId === club.id
                return (
                  <tr key={club.id || i} className={styles.tr}>
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
                    <td className={styles.td + ' ' + styles.tdNum}><span className={styles.num}>{club.squadSize || '—'}</span></td>
                    <td className={styles.td + ' ' + styles.tdNum}><span className={styles.num}>{club.avgAge || '—'}</span></td>
                    <td className={styles.td + ' ' + styles.tdNum}><span className={styles.mv}>{club.marketValue || '—'}</span></td>
                    <td className={styles.td + ' ' + styles.tdNum}><ScoreBadge score={score} /></td>
                    <td className={styles.td}>
                      <div className={styles.rowActions}>
                        {club.profileUrl && (
                          <a href={club.profileUrl} target="_blank" rel="noopener noreferrer"
                            className={styles.tmLink} title="View on Transfermarkt">
                            <ExternalLinkIcon size={13} />
                          </a>
                        )}
                        {saved ? (
                          <button className={styles.savedBtn}
                            onClick={() => nav(`/clubs/${saved.key}`)}>
                            ✓ View Profile
                          </button>
                        ) : (
                          <button className={styles.saveBtn}
                            onClick={() => saveClub(club)} disabled={isSaving}>
                            {isSaving ? <Spinner /> : null}
                            {isSaving ? 'Saving…' : '+ Save'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
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
                <th className={styles.th + ' ' + styles.thNum}>Age</th>
                <th className={styles.th}>Nationality</th>
                <th className={styles.th}>Current Club</th>
                <th className={styles.th + ' ' + styles.thNum}>Market Value</th>
                <th className={styles.th + ' ' + styles.thNum} title="Active club needs this player fits">Needs Match</th>
                <th className={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {(displayResults as TmPlayer[]).map((player, i) => {
                const matches  = mandateMatchCount(player, needs)
                const saved    = savedMap[player.id]
                const isSaving = savingId === player.id
                return (
                  <tr key={player.id || i} className={styles.tr}>
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
                    <td className={styles.td + ' ' + styles.tdNum}><span className={styles.num}>{player.age || '—'}</span></td>
                    <td className={styles.td}><span className={styles.meta}>{player.nationality || '—'}</span></td>
                    <td className={styles.td}><span className={styles.meta}>{player.club || '—'}</span></td>
                    <td className={styles.td + ' ' + styles.tdNum}><span className={styles.mv}>{player.marketValue || '—'}</span></td>
                    <td className={styles.td + ' ' + styles.tdNum}><MatchBadge count={matches} /></td>
                    <td className={styles.td}>
                      <div className={styles.rowActions}>
                        {player.profileUrl && (
                          <a href={player.profileUrl} target="_blank" rel="noopener noreferrer"
                            className={styles.tmLink} title="View on Transfermarkt">
                            <ExternalLinkIcon size={13} />
                          </a>
                        )}
                        {saved ? (
                          <button className={styles.savedBtn}
                            onClick={() => nav(`/mandates/${saved.key}`)}>
                            ✓ View Profile
                          </button>
                        ) : (
                          <button className={styles.saveBtn}
                            onClick={() => savePlayer(player)} disabled={isSaving}>
                            {isSaving ? <Spinner /> : null}
                            {isSaving ? 'Saving…' : '+ Save'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
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
              : `Results matched against your ${needs.length} active club needs`}
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
function ExternalLinkIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V9"/><path d="M10 2h4v4"/><line x1="14" y1="2" x2="7" y2="9"/>
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
