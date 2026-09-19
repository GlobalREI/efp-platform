/**
 * TmScoutView — Transfermarkt Scout
 *
 * Three tabs:
 *   1. Find a Club   — search TM clubs + cross-ref our Firebase needs/mandates
 *   2. Find a Player — search TM players + match against our club needs
 *   3. Find a Loan Player — same as player tab, pre-filtered for loan candidates
 *
 * Firebase data auto-refreshes every 5 minutes in the background.
 * TM search runs on explicit user action (search button / Enter).
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { ref, get } from 'firebase/database'
import { db } from '../data/firebase'
import { PageHeader } from '../components/PageHeader'
import {
  searchTmPlayers,
  searchTmClubs,
  filterTmPlayers,
  parseTmValue,
  formatTmValue,
  type TmPlayer,
  type TmClub,
} from '../data/tmApi'
import styles from './TmScoutView.module.css'

/* ── Constants ─────────────────────────────────────────────────────────── */
const REFRESH_MS = 5 * 60 * 1000  // 5 min Firebase auto-refresh
const POSITIONS   = ['GK', 'CB', 'RB', 'LB', 'CDM', 'CM', 'CAM', 'RW', 'LW', 'CF', 'ST']

const LEAGUES = [
  'Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'Ligue 1',
  'Eredivisie', 'Primeira Liga', 'Championship', '2. Bundesliga',
  'Serie B', 'Süper Lig', 'Belgian Pro League', 'Scottish Premiership',
]

type Tab = 'club' | 'player' | 'loan'

/* ── Firebase types ─────────────────────────────────────────────────────── */
interface FbNeed {
  id: string
  club?: string
  club_name?: string
  pos?: string
  positions?: string[]
  budMin?: number | string
  budMax?: number | string
  status?: string
  league?: string
}
interface FbMandate {
  id: string
  name?: string
  pos?: string
  age?: number | string
  value?: number | string
  status?: string
}

/* ── Need Score ─────────────────────────────────────────────────────────── */
function needScore(club: TmClub, needs: FbNeed[]): number {
  // How many of our active needs belong to this club?
  const name = club.name.toLowerCase()
  const directNeeds = needs.filter(n => {
    const clubName = (n.club || n.club_name || '').toLowerCase()
    return clubName && (clubName.includes(name) || name.includes(clubName))
  })
  // Bonus: league match with our existing needs
  const leagueMatches = needs.filter(n => {
    const nl = (n.league || '').toLowerCase()
    const cl = club.league.toLowerCase()
    return nl && cl && (nl.includes(cl) || cl.includes(nl))
  })
  return Math.min(100, directNeeds.length * 40 + leagueMatches.length * 10)
}

/* ── Mandate Match ──────────────────────────────────────────────────────── */
function mandateMatch(player: TmPlayer, needs: FbNeed[]): number {
  // How many of our active club needs could this player satisfy?
  const pos = player.position.toLowerCase()
  const age = parseInt(player.age, 10)
  const mv  = parseTmValue(player.marketValue)

  return needs.filter(n => {
    const needPos = [...(n.positions ?? []), n.pos ?? ''].map(p => p.toLowerCase()).filter(Boolean)
    const posMatch = needPos.length === 0 || needPos.some(p => pos.includes(p) || p.includes(pos))
    if (!posMatch) return false

    // Budget check
    const budMin = parseFloat(String(n.budMin ?? 0))
    const budMax = parseFloat(String(n.budMax ?? 999))
    if (mv !== null && (mv < budMin * 0.6 || mv > budMax * 1.6)) return false

    return true
  }).length
}

/* ── Helpers ────────────────────────────────────────────────────────────── */
function ScoreBadge({ score }: { score: number }) {
  const color = score >= 60 ? 'var(--accent)' : score >= 30 ? 'var(--amber)' : 'var(--text-3)'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 36, height: 22, borderRadius: 'var(--r-full)',
      background: score >= 60 ? 'var(--accent-dim)' : score >= 30 ? 'var(--amber-dim)' : 'var(--surface-2)',
      color, fontSize: 11, fontWeight: 700,
    }}>
      {score}
    </span>
  )
}

function TmBadge({ count }: { count: number }) {
  if (count === 0) return <span style={{ color: 'var(--text-3)', fontSize: 12 }}>—</span>
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 28, height: 20, borderRadius: 'var(--r-full)',
      background: 'var(--accent-dim)', color: 'var(--accent)', fontSize: 11, fontWeight: 700,
    }}>
      {count}
    </span>
  )
}

function PlayerAvatar({ imageUrl, name }: { imageUrl: string; name: string }) {
  const [errored, setErrored] = useState(false)
  if (!imageUrl || errored) {
    return (
      <div className={styles.avatar}>
        {name.slice(0, 2).toUpperCase()}
      </div>
    )
  }
  return (
    <img
      src={imageUrl}
      alt={name}
      className={styles.avatarImg}
      onError={() => setErrored(true)}
    />
  )
}

function ClubLogo({ logoUrl, name }: { logoUrl: string; name: string }) {
  const [errored, setErrored] = useState(false)
  if (!logoUrl || errored) {
    return (
      <div className={styles.clubLogoFallback}>
        {name.slice(0, 2).toUpperCase()}
      </div>
    )
  }
  return (
    <img
      src={logoUrl}
      alt={name}
      className={styles.clubLogo}
      onError={() => setErrored(true)}
    />
  )
}

function Spinner() {
  return <div className={styles.spinner} />
}

/* ══════════════════════════════════════════════════════════════════════════
   Main Component
══════════════════════════════════════════════════════════════════════════ */
export function TmScoutView() {
  const [tab, setTab] = useState<Tab>('club')

  /* Firebase state */
  const [needs,     setNeeds]     = useState<FbNeed[]>([])
  const [mandates,  setMandates]  = useState<FbMandate[]>([])
  const [fbLoading, setFbLoading] = useState(true)
  const [lastSync,  setLastSync]  = useState<Date | null>(null)
  const refreshTimer = useRef<ReturnType<typeof setInterval>>()

  /* TM search state — shared across tabs */
  const [query,      setQuery]      = useState('')
  const [tmResults,  setTmResults]  = useState<(TmPlayer | TmClub)[]>([])
  const [searching,  setSearching]  = useState(false)
  const [tmError,    setTmError]    = useState<string | null>(null)
  const [searched,   setSearched]   = useState(false)

  /* Filters */
  const [filterPos,    setFilterPos]    = useState('')
  const [filterLeague, setFilterLeague] = useState('')
  const [filterAgeMin, setFilterAgeMin] = useState('')
  const [filterAgeMax, setFilterAgeMax] = useState('')
  const [filterMvMin,  setFilterMvMin]  = useState('')
  const [filterMvMax,  setFilterMvMax]  = useState('')

  /* ── Load Firebase data ── */
  const loadFirebase = useCallback(async () => {
    try {
      const [needsSnap, mandatesSnap] = await Promise.all([
        get(ref(db, '/needs')),
        get(ref(db, '/mandates')),
      ])

      const needsArr: FbNeed[] = []
      if (needsSnap.exists()) {
        needsSnap.forEach(child => {
          const v = child.val()
          if (v && v.status !== 'closed' && !v.archived) {
            needsArr.push({ id: child.key!, ...v })
          }
        })
      }

      const mandatesArr: FbMandate[] = []
      if (mandatesSnap.exists()) {
        mandatesSnap.forEach(child => {
          const v = child.val()
          if (v && !v.archived) {
            mandatesArr.push({ id: child.key!, ...v })
          }
        })
      }

      setNeeds(needsArr)
      setMandates(mandatesArr)
      setLastSync(new Date())
    } catch (err) {
      console.error('Firebase load error:', err)
    } finally {
      setFbLoading(false)
    }
  }, [])

  useEffect(() => {
    loadFirebase()
    refreshTimer.current = setInterval(loadFirebase, REFRESH_MS)
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current)
    }
  }, [loadFirebase])

  /* ── Reset TM results when tab changes ── */
  useEffect(() => {
    setTmResults([])
    setTmError(null)
    setSearched(false)
    setQuery('')
    setFilterPos('')
    setFilterLeague('')
    setFilterAgeMin('')
    setFilterAgeMax('')
    setFilterMvMin('')
    setFilterMvMax('')
  }, [tab])

  /* ── Run TM search ── */
  const runSearch = useCallback(async () => {
    if (!query.trim()) return
    setSearching(true)
    setTmError(null)
    setTmResults([])
    setSearched(true)
    try {
      if (tab === 'club') {
        const clubs = await searchTmClubs(query)
        setTmResults(clubs)
      } else {
        const players = await searchTmPlayers(query)
        setTmResults(players)
      }
    } catch (err) {
      setTmError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSearching(false)
    }
  }, [query, tab])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') runSearch()
  }

  /* ── Filtered results ── */
  const displayResults = (() => {
    if (tab === 'club') return tmResults as TmClub[]
    const players = tmResults as TmPlayer[]
    return filterTmPlayers(players, {
      position: filterPos || undefined,
      ageMin:   filterAgeMin ? parseInt(filterAgeMin) : undefined,
      ageMax:   filterAgeMax ? parseInt(filterAgeMax) : undefined,
      mvMin:    filterMvMin  ? parseFloat(filterMvMin) : undefined,
      mvMax:    filterMvMax  ? parseFloat(filterMvMax) : undefined,
    })
  })()

  /* ── Loan pre-filter: set age max when switching to loan tab ── */
  useEffect(() => {
    if (tab === 'loan') {
      setFilterAgeMax('24')
    }
  }, [tab])

  /* ── Sub count labels ── */
  const sub = fbLoading
    ? 'Loading…'
    : `${needs.length} active needs · ${mandates.length} mandates${
        lastSync ? ` · synced ${lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''
      }`

  return (
    <div className={styles.page}>
      <PageHeader
        title="TM Scout"
        sub={sub}
        actions={
          <button
            className={styles.refreshBtn}
            onClick={loadFirebase}
            title="Refresh Firebase data"
          >
            <RefreshIcon size={13} />
            Sync
          </button>
        }
      />

      {/* ── Tab bar ── */}
      <div className={styles.tabBar}>
        {([
          { id: 'club',   label: '⚽ Find a Club'        },
          { id: 'player', label: '👤 Find a Player'      },
          { id: 'loan',   label: '🔄 Find a Loan Player' },
        ] as { id: Tab; label: string }[]).map(t => (
          <button
            key={t.id}
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Search bar + filters ── */}
      <div className={styles.searchPanel}>
        <div className={styles.searchRow}>
          <input
            className={styles.searchInput}
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              tab === 'club'
                ? 'Search club name on Transfermarkt…'
                : tab === 'player'
                ? 'Search player name on Transfermarkt…'
                : 'Search loan player on Transfermarkt…'
            }
          />
          <button
            className={styles.searchBtn}
            onClick={runSearch}
            disabled={searching || !query.trim()}
          >
            {searching ? <Spinner /> : <SearchIcon size={14} />}
            {searching ? 'Searching…' : 'Search TM'}
          </button>
        </div>

        {/* ── Filters ── */}
        <div className={styles.filterRow}>
          {tab === 'club' && (
            <>
              <FilterSelect
                label="League"
                value={filterLeague}
                onChange={setFilterLeague}
                options={LEAGUES}
                placeholder="All leagues"
              />
            </>
          )}
          {(tab === 'player' || tab === 'loan') && (
            <>
              <FilterSelect
                label="Position"
                value={filterPos}
                onChange={setFilterPos}
                options={POSITIONS}
                placeholder="All positions"
              />
              <div className={styles.filterGroup}>
                <span className={styles.filterLabel}>Age</span>
                <input
                  className={styles.filterInput}
                  type="number"
                  min="14" max="45"
                  placeholder="Min"
                  value={filterAgeMin}
                  onChange={e => setFilterAgeMin(e.target.value)}
                />
                <span className={styles.filterSep}>–</span>
                <input
                  className={styles.filterInput}
                  type="number"
                  min="14" max="45"
                  placeholder="Max"
                  value={filterAgeMax}
                  onChange={e => setFilterAgeMax(e.target.value)}
                />
              </div>
              <div className={styles.filterGroup}>
                <span className={styles.filterLabel}>MV (€M)</span>
                <input
                  className={styles.filterInput}
                  type="number"
                  min="0"
                  placeholder="Min"
                  value={filterMvMin}
                  onChange={e => setFilterMvMin(e.target.value)}
                />
                <span className={styles.filterSep}>–</span>
                <input
                  className={styles.filterInput}
                  type="number"
                  min="0"
                  placeholder="Max"
                  value={filterMvMax}
                  onChange={e => setFilterMvMax(e.target.value)}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Results area ── */}
      {tmError && (
        <div className={styles.errorCard}>
          <span className={styles.errorIcon}>⚠️</span>
          <div>
            <div className={styles.errorTitle}>TM Proxy Unavailable</div>
            <div className={styles.errorMsg}>{tmError}</div>
            <div className={styles.errorHint}>
              Run <code>npm run dev</code> in the <code>efp-ops</code> folder (port 3000) to enable Transfermarkt search.
            </div>
          </div>
        </div>
      )}

      {!tmError && searched && !searching && displayResults.length === 0 && (
        <div className={styles.empty}>No results found. Try a different search term.</div>
      )}

      {/* ── Club results table ── */}
      {tab === 'club' && !tmError && displayResults.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Club</th>
                <th className={styles.th}>League</th>
                <th className={styles.th}>Country</th>
                <th className={styles.th + ' ' + styles.thNum}>Squad</th>
                <th className={styles.th + ' ' + styles.thNum}>Avg Age</th>
                <th className={styles.th + ' ' + styles.thNum}>Market Value</th>
                <th className={styles.th + ' ' + styles.thNum} title="How many of our active needs match this club">Need Score</th>
                <th className={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {(displayResults as TmClub[]).map((club, i) => {
                const score = needScore(club, needs)
                return (
                  <tr key={club.id || i} className={styles.tr}>
                    <td className={styles.td}>
                      <div className={styles.clubCell}>
                        <ClubLogo logoUrl={club.logoUrl} name={club.name} />
                        <span className={styles.clubName}>{club.name}</span>
                      </div>
                    </td>
                    <td className={styles.td}>
                      <span className={styles.meta}>{club.league || '—'}</span>
                    </td>
                    <td className={styles.td}>
                      <span className={styles.meta}>{club.country || '—'}</span>
                    </td>
                    <td className={styles.td + ' ' + styles.tdNum}>{club.squadSize || '—'}</td>
                    <td className={styles.td + ' ' + styles.tdNum}>{club.avgAge || '—'}</td>
                    <td className={styles.td + ' ' + styles.tdNum}>
                      <span className={styles.mv}>{club.marketValue || '—'}</span>
                    </td>
                    <td className={styles.td + ' ' + styles.tdNum}>
                      <ScoreBadge score={score} />
                    </td>
                    <td className={styles.td}>
                      {club.profileUrl && (
                        <a
                          href={club.profileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.tmLink}
                          title="View on Transfermarkt"
                        >
                          <ExternalLinkIcon size={13} />
                        </a>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Player / Loan results table ── */}
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
                <th className={styles.th + ' ' + styles.thNum} title="Club needs this player could satisfy">Needs Match</th>
                <th className={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {(displayResults as TmPlayer[]).map((player, i) => {
                const matches = mandateMatch(player, needs)
                return (
                  <tr key={player.id || i} className={styles.tr}>
                    <td className={styles.td}>
                      <div className={styles.playerCell}>
                        <PlayerAvatar imageUrl={player.imageUrl} name={player.name} />
                        <span className={styles.playerName}>{player.name}</span>
                      </div>
                    </td>
                    <td className={styles.td}>
                      {player.position
                        ? <span className={styles.posBadge}>{player.position}</span>
                        : <span className={styles.meta}>—</span>
                      }
                    </td>
                    <td className={styles.td + ' ' + styles.tdNum}>{player.age || '—'}</td>
                    <td className={styles.td}>
                      <span className={styles.meta}>{player.nationality || '—'}</span>
                    </td>
                    <td className={styles.td}>
                      <span className={styles.meta}>{player.club || '—'}</span>
                    </td>
                    <td className={styles.td + ' ' + styles.tdNum}>
                      <span className={styles.mv}>{player.marketValue || '—'}</span>
                    </td>
                    <td className={styles.td + ' ' + styles.tdNum}>
                      <TmBadge count={matches} />
                    </td>
                    <td className={styles.td}>
                      {player.profileUrl && (
                        <a
                          href={player.profileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.tmLink}
                          title="View on Transfermarkt"
                        >
                          <ExternalLinkIcon size={13} />
                        </a>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {tab === 'loan' && displayResults.length > 0 && (
            <div className={styles.loanNote}>
              🔄 Showing players ≤ {filterAgeMax || '24'} years old — typical loan profile
            </div>
          )}
        </div>
      )}

      {/* ── Empty state before first search ── */}
      {!tmError && !searched && !searching && (
        <div className={styles.promptCard}>
          <div className={styles.promptIcon}>
            {tab === 'club' ? '⚽' : tab === 'player' ? '👤' : '🔄'}
          </div>
          <div className={styles.promptTitle}>
            {tab === 'club'
              ? 'Search for a club on Transfermarkt'
              : tab === 'player'
              ? 'Search for a player on Transfermarkt'
              : 'Search for a loan candidate on Transfermarkt'}
          </div>
          <div className={styles.promptSub}>
            {tab === 'club'
              ? `Results cross-referenced with your ${needs.length} active club needs`
              : `Results matched against your ${needs.length} active club needs`}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Inline icons (no external dep needed) ───────────────────────────── */
function SearchIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
      <circle cx="7" cy="7" r="4.5" />
      <line x1="10.5" y1="10.5" x2="14" y2="14" />
    </svg>
  )
}

function ExternalLinkIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V9" />
      <path d="M10 2h4v4" />
      <line x1="14" y1="2" x2="7" y2="9" />
    </svg>
  )
}

function RefreshIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 8a6 6 0 0 1 6-6 6 6 0 0 1 4.24 1.76L14 6" />
      <path d="M14 2v4h-4" />
      <path d="M14 8a6 6 0 0 1-6 6 6 6 0 0 1-4.24-1.76L2 10" />
      <path d="M2 14v-4h4" />
    </svg>
  )
}

/* ── FilterSelect helper ─────────────────────────────────────────────── */
function FilterSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{label}</span>
      <select
        style={{
          height: 32, padding: '0 8px',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)',
          background: 'var(--surface)',
          color: 'var(--text)',
          fontSize: 12,
          cursor: 'pointer',
        }}
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">{placeholder ?? 'All'}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}
