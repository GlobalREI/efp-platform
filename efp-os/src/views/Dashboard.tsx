/**
 * Dashboard — operations overview for EFP OS
 * Sections:
 *   1. Hero KPIs  — Active Pitches | Players | Open Tasks
 *   2. Pipeline   — pitch stage funnel with per-stage bars
 *   3. Stats grid — Clubs · Contacts · Club Needs
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ref, onValue, off } from 'firebase/database'
import { db } from '../data/firebase'
import styles from './Dashboard.module.css'
import {
  IconPitches, IconMandates, IconActivities,
  IconClubs, IconContacts, IconNeeds,
} from '../components/Icons'

// ── Pitch pipeline stages (matches PitchList.tsx) ─────────────────────────
const STAGES = [
  { key: 'sent',         label: 'Sent',           color: '#94A3B8' },
  { key: 'awaiting',     label: 'Awaiting',        color: '#F59E0B' },
  { key: 'feedback',     label: 'Feedback',        color: '#8B5CF6' },
  { key: 'interest',     label: 'Active Interest', color: '#3B82F6' },
  { key: 'negotiations', label: 'Negotiating',     color: '#F97316' },
  { key: 'done',         label: 'Deal Done',       color: '#10B981' },
  { key: 'rejected',     label: 'No Interest',     color: '#EF4444' },
]
const ACTIVE_STAGES = ['sent','awaiting','feedback','interest','negotiations']

interface DashStats {
  players:      number
  clubs:        number
  contacts:     number
  needs:        number
  pitchStages:  Record<string, number>
  activePitches:number
  totalPitches: number
  openTasks:    number
  overdueTasks: number
}

const EMPTY: DashStats = {
  players: 0, clubs: 0, contacts: 0, needs: 0,
  pitchStages: {}, activePitches: 0, totalPitches: 0,
  openTasks: 0, overdueTasks: 0,
}

// ── Mini SVG donut for a single metric ────────────────────────────────────
function DonutRing({ value, max, color }: { value: number; max: number; color: string }) {
  const r = 20
  const circ = 2 * Math.PI * r
  const pct  = max > 0 ? Math.min(value / max, 1) : 0
  const dash = pct * circ
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true">
      <circle cx="26" cy="26" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="6" />
      <circle
        cx="26" cy="26" r={r} fill="none"
        stroke={color} strokeWidth="6"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 26 26)"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
    </svg>
  )
}

// ── Horizontal stage bar ──────────────────────────────────────────────────
function PipelineBar({ stages, total }: { stages: Record<string, number>; total: number }) {
  if (total === 0) return (
    <div className={styles.pipelineEmpty}>No pitches yet</div>
  )
  return (
    <div className={styles.pipelineBar} role="img" aria-label="Pitch pipeline breakdown">
      {STAGES.map(s => {
        const n   = stages[s.key] || 0
        const pct = (n / total) * 100
        if (pct < 1) return null
        return (
          <div
            key={s.key}
            className={styles.pipelineSegment}
            style={{ width: `${pct}%`, background: s.color }}
            title={`${s.label}: ${n}`}
          />
        )
      })}
    </div>
  )
}

export function Dashboard() {
  const nav                    = useNavigate()
  const [stats, setStats]      = useState<DashStats>(EMPTY)
  const [loading, setLoading]  = useState(true)
  const [syncCount, setSyncCount] = useState(0)
  const [bannerDismissed, setBannerDismissed] = useState(false)

  useEffect(() => {
    const acc: Partial<DashStats> & { pitchStages: Record<string,number> } = { ...EMPTY }
    let resolved = 0
    const NEEDED = 5 // mandates, clubs, contacts, needs, pitches+tasks combo
    const unsubs: (() => void)[] = []

    function maybeFinish() {
      resolved++
      if (resolved >= NEEDED) {
        setStats({ ...acc } as DashStats)
        setLoading(false)
      }
    }

    // Simple counts
    ;[
      { path: 'mandates', key: 'players'  as const },
      { path: 'clubs',    key: 'clubs'    as const },
      { path: 'contacts', key: 'contacts' as const },
      { path: 'needs',    key: 'needs'    as const },
    ].forEach(({ path, key }) => {
      const r = ref(db, path)
      const h = (snap: any) => {
        acc[key] = snap.exists() ? Object.keys(snap.val()).length : 0
        maybeFinish()
      }
      onValue(r, h)
      unsubs.push(() => off(r, 'value', h))
    })

    // Pitches — stage breakdown
    const pitchRef = ref(db, 'pitches')
    const pitchH = (snap: any) => {
      if (!snap.exists()) { acc.pitchStages = {}; acc.activePitches = 0; acc.totalPitches = 0 }
      else {
        const list = Object.values(snap.val()) as any[]
        const stageMap: Record<string, number> = {}
        STAGES.forEach(s => { stageMap[s.key] = 0 })
        list.forEach(p => {
          const s = (p as any).stage || 'sent'
          stageMap[s] = (stageMap[s] || 0) + 1
        })
        acc.pitchStages   = stageMap
        acc.activePitches = ACTIVE_STAGES.reduce((sum, k) => sum + (stageMap[k] || 0), 0)
        acc.totalPitches  = list.length
      }
      maybeFinish()
    }
    onValue(pitchRef, pitchH)
    unsubs.push(() => off(pitchRef, 'value', pitchH))

    // Tasks — open + overdue
    const taskRef = ref(db, 'allTasks')
    const taskH = (snap: any) => {
      if (!snap.exists()) { acc.openTasks = 0; acc.overdueTasks = 0 }
      else {
        const list = (Array.isArray(snap.val()) ? snap.val() : Object.values(snap.val())) as any[]
        const open = list.filter((t: any) => !t.done)
        acc.openTasks    = open.length
        acc.overdueTasks = open.filter((t: any) => t.overdue).length
      }
    }
    onValue(taskRef, taskH)
    unsubs.push(() => off(taskRef, 'value', taskH))

    // Sync log
    const syncRef = ref(db, 'syncLog')
    const syncH = (snap: any) => {
      if (!snap.exists()) return
      const log  = snap.val()
      const runs = ['morning','midday','evening'].map((k: string) => log[k]).filter(Boolean)
      if (!runs.length) return
      const latest = runs.sort((a: any, b: any) => (b.runAt||'').localeCompare(a.runAt||''))[0]
      if (!latest?.items) return
      const dismissed = JSON.parse(localStorage.getItem('efp-sync-dismissed-' + latest.runAt) || '[]')
      setSyncCount((latest.items as any[]).filter((i: any) => !dismissed.includes(i.id)).length)
    }
    onValue(syncRef, syncH)
    unsubs.push(() => off(syncRef))

    return () => unsubs.forEach(u => u())
  }, [])

  const activePct = stats.totalPitches > 0
    ? Math.round((stats.activePitches / stats.totalPitches) * 100)
    : 0

  return (
    <div className={styles.page}>

      {/* ── Sync banner ── */}
      {syncCount > 0 && !bannerDismissed && (
        <div className={styles.banner}>
          <span className={styles.bannerDot} />
          <span className={styles.bannerText}>
            <strong>{syncCount} item{syncCount !== 1 ? 's' : ''}</strong> from latest sync ready to review
          </span>
          <button className={styles.bannerCta} onClick={() => nav('/pitches')}>Review →</button>
          <button className={styles.bannerX} onClick={() => setBannerDismissed(true)} aria-label="Dismiss">✕</button>
        </div>
      )}

      {/* ── Page header ── */}
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.sub}>EFP Transfer Intelligence · Summer 2026</p>
        </div>
      </header>

      {/* ══ Section 1 — Hero KPIs ══════════════════════════════════════════ */}
      <div className={styles.heroRow}>

        {/* Active Pitches */}
        <button className={`${styles.heroCard} ${styles.heroPrimary}`} onClick={() => nav('/pitches')}>
          <div className={styles.heroCardInner}>
            <div className={styles.heroMeta}>
              <span className={styles.heroIcon} style={{ color: '#3B82F6' }}>
                <IconPitches size={18} />
              </span>
              <span className={styles.heroLabel}>Active Pitches</span>
            </div>
            <div className={styles.heroVal}>
              {loading ? <span className={styles.skel} /> : stats.activePitches}
            </div>
            <div className={styles.heroSub}>
              {loading ? null : `${activePct}% of ${stats.totalPitches} total`}
            </div>
          </div>
          <DonutRing value={stats.activePitches} max={stats.totalPitches} color="#3B82F6" />
        </button>

        {/* Players */}
        <button className={styles.heroCard} onClick={() => nav('/mandates')}>
          <div className={styles.heroCardInner}>
            <div className={styles.heroMeta}>
              <span className={styles.heroIcon} style={{ color: '#3A8B4A' }}>
                <IconMandates size={18} />
              </span>
              <span className={styles.heroLabel}>Players</span>
            </div>
            <div className={styles.heroVal}>
              {loading ? <span className={styles.skel} /> : stats.players}
            </div>
            <div className={styles.heroSub}>On mandate</div>
          </div>
          <DonutRing value={stats.players} max={Math.max(stats.players, 20)} color="#3A8B4A" />
        </button>

        {/* Open Tasks */}
        <button
          className={`${styles.heroCard} ${stats.overdueTasks > 0 ? styles.heroAlert : ''}`}
          onClick={() => nav('/tasks')}
        >
          <div className={styles.heroCardInner}>
            <div className={styles.heroMeta}>
              <span className={styles.heroIcon} style={{ color: stats.overdueTasks > 0 ? '#EF4444' : '#52735A' }}>
                <IconActivities size={18} />
              </span>
              <span className={styles.heroLabel}>Open Tasks</span>
            </div>
            <div className={styles.heroVal}>
              {loading ? <span className={styles.skel} /> : stats.openTasks}
            </div>
            <div className={styles.heroSub}>
              {loading ? null : stats.overdueTasks > 0
                ? <span className={styles.overdueTag}>{stats.overdueTasks} overdue</span>
                : 'All on track'
              }
            </div>
          </div>
          <DonutRing
            value={Math.max(0, (stats.openTasks - stats.overdueTasks))}
            max={Math.max(stats.openTasks, 1)}
            color={stats.overdueTasks > 0 ? '#EF4444' : '#10B981'}
          />
        </button>

      </div>

      {/* ══ Section 2 — Pipeline funnel ════════════════════════════════════ */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Pitch Pipeline</h2>
          <button className={styles.sectionLink} onClick={() => nav('/pitches')}>View board →</button>
        </div>

        <div className={styles.pipelineCard}>
          <PipelineBar stages={stats.pitchStages} total={stats.totalPitches} />

          <div className={styles.stageGrid}>
            {STAGES.map(s => {
              const n = stats.pitchStages[s.key] || 0
              if (!loading && n === 0 && s.key !== 'sent') return null
              return (
                <div key={s.key} className={styles.stageCell}>
                  <span className={styles.stageDot} style={{ background: s.color }} />
                  <span className={styles.stageName}>{s.label}</span>
                  <span className={styles.stageCount}>
                    {loading ? '—' : n}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ══ Section 3 — CRM stats ══════════════════════════════════════════ */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Database</h2>
        </div>
        <div className={styles.statGrid}>
          {[
            { label: 'Clubs',      count: stats.clubs,    to: '/clubs',    Icon: IconClubs,    color: '#3A8B4A' },
            { label: 'Contacts',   count: stats.contacts, to: '/contacts', Icon: IconContacts, color: '#8B5CF6' },
            { label: 'Club Needs', count: stats.needs,    to: '/needs',    Icon: IconNeeds,    color: '#F59E0B' },
          ].map(({ label, count, to, Icon, color }) => (
            <button key={label} className={styles.statCard} onClick={() => nav(to)}>
              <span className={styles.statAccent} style={{ background: color }} />
              <span className={styles.statIcon} style={{ color }}>
                <Icon size={15} />
              </span>
              <span className={styles.statCount}>
                {loading ? <span className={styles.skel} /> : count}
              </span>
              <span className={styles.statLabel}>{label}</span>
              <span className={styles.statArrow}>→</span>
            </button>
          ))}
        </div>
      </section>

    </div>
  )
}
