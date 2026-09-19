/**
 * Dashboard — summary stats + sync notification banner (only appears here)
 * Numbers are pulled live from Firebase so they always match the lists they link to.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ref, onValue, off } from 'firebase/database'
import { db } from '../data/firebase'
import styles from './Dashboard.module.css'

interface Stats {
  players: number
  clubs: number
  contacts: number
  needs: number
  pitches: number
  tasks: number
}

interface SyncItem {
  id: string
  label: string
  detail?: string
}

export function Dashboard() {
  const nav = useNavigate()
  const [stats, setStats]         = useState<Stats>({ players: 0, clubs: 0, contacts: 0, needs: 0, pitches: 0, tasks: 0 })
  const [syncItems, setSyncItems] = useState<SyncItem[]>([])
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    const refs = [
      { path: 'mandates',    key: 'players'  },
      { path: 'clubs',       key: 'clubs'    },
      { path: 'contacts',    key: 'contacts' },
      { path: 'needs',       key: 'needs'    },
      { path: 'pitches',     key: 'pitches'  },
      { path: 'tasks',       key: 'tasks'    },
    ] as const

    const unsubs: (() => void)[] = []
    const counts: Record<string, number> = {}
    let resolved = 0

    refs.forEach(({ path, key }) => {
      const r = ref(db, path)
      const handler = (snap: any) => {
        counts[key] = snap.exists() ? Object.keys(snap.val()).length : 0
        resolved++
        if (resolved >= refs.length) {
          setStats(counts as unknown as Stats)
          setLoading(false)
        }
      }
      onValue(r, handler)
      unsubs.push(() => off(r, 'value', handler))
    })

    // Check sync log for pending items
    const syncRef = ref(db, 'syncLog')
    onValue(syncRef, (snap) => {
      if (!snap.exists()) return
      const log = snap.val()
      const runs = ['morning', 'midday', 'evening'].map((k: string) => log[k]).filter(Boolean)
      if (!runs.length) return
      const latest = runs.sort((a: any, b: any) => (b.runAt || '').localeCompare(a.runAt || ''))[0]
      if (!latest?.items) return
      const dismissed = JSON.parse(localStorage.getItem('efp-sync-dismissed-' + latest.runAt) || '[]')
      const pending = (latest.items as SyncItem[]).filter((i: SyncItem) => !dismissed.includes(i.id))
      setSyncItems(pending)
    })
    unsubs.push(() => off(syncRef))

    return () => unsubs.forEach(u => u())
  }, [])

  function dismissBanner() {
    setBannerDismissed(true)
    setSyncItems([])
  }

  const CARDS = [
    { label: 'Players',  count: stats.players,  to: '/mandates',  icon: '⚽', color: '#2563EB' },
    { label: 'Clubs',    count: stats.clubs,    to: '/clubs',    icon: '🏟', color: '#15803D' },
    { label: 'Contacts', count: stats.contacts, to: '/contacts', icon: '👤', color: '#7C3AED' },
    { label: 'Needs',    count: stats.needs,    to: '/needs',    icon: '🎯', color: '#EA580C' },
    { label: 'Pitches',  count: stats.pitches,  to: '/pitches',  icon: '📤', color: '#0891B2' },
    { label: 'Tasks',    count: stats.tasks,    to: '/tasks',    icon: '✅', color: '#16A34A' },
  ]

  return (
    <div className={styles.page}>
      {/* Sync intelligence banner — Dashboard only */}
      {syncItems.length > 0 && !bannerDismissed && (
        <div className={styles.banner}>
          <span className={styles.bannerIcon}>🔔</span>
          <span className={styles.bannerText}>
            <strong>{syncItems.length} items to review</strong> — add to your database or dismiss
          </span>
          <button className={styles.bannerReview} onClick={() => nav('/pitches')}>
            Review →
          </button>
          <button className={styles.bannerDismiss} onClick={dismissBanner}>
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.sub}>European Football Partners — Transfer Intelligence</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className={styles.grid}>
        {CARDS.map(({ label, count, to, icon, color }) => (
          <button
            key={label}
            className={styles.statCard}
            onClick={() => nav(to)}
          >
            <div className={styles.statIcon} style={{ background: color + '18', color }}>
              {icon}
            </div>
            <div className={styles.statBody}>
              <div className={styles.statCount}>
                {loading ? <span className={styles.skeleton} /> : count}
              </div>
              <div className={styles.statLabel}>{label}</div>
            </div>
            <div className={styles.statArrow}>→</div>
          </button>
        ))}
      </div>
    </div>
  )
}
