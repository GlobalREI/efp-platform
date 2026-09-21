/**
 * TaskList — internal EFP task list
 *
 * Reads: /allTasks  →  [{ id, text, meta, prio, bucket, dueDate, done, overdue, assignedTo, createdAt }]
 * prio:   'h' | 'm' | 'l'
 * bucket: 'today' | 'week' | 'later' | 'someday'
 */
import { useEffect, useState, useMemo } from 'react'
import { ref, onValue, off, set } from 'firebase/database'
import { db } from '../data/firebase'
import { PageHeader } from '../components/PageHeader'
import styles from './TaskList.module.css'

interface Task {
  id: number | string
  text: string
  meta?: string
  prio?: 'h' | 'm' | 'l'
  bucket?: string
  dueDate?: string
  done?: boolean
  overdue?: boolean
  daysOverdue?: number
  assignedTo?: string
  createdAt?: string
  source?: string
}

const BUCKETS = [
  { key: 'today', label: 'Today' },
  { key: 'week',  label: 'This Week' },
  { key: 'later', label: 'Later' },
  { key: 'someday', label: 'Someday' },
]

const PRIO_LABEL: Record<string, string> = { h: 'High', m: 'Medium', l: 'Low' }
const PRIO_COLOR: Record<string, string> = {
  h: '#EF4444',
  m: '#F59E0B',
  l: '#94A3B8',
}

export function TaskList() {
  const [tasks,       setTasks]       = useState<Task[]>([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [filter,      setFilter]      = useState('open')      // open | done | all
  const [activeBucket, setActiveBucket] = useState('today')

  /* Add task form */
  const [newText,   setNewText]   = useState('')
  const [newPrio,   setNewPrio]   = useState<'h' | 'm' | 'l'>('m')
  const [newBucket, setNewBucket] = useState<string>('today')
  const [adding,    setAdding]    = useState(false)

  useEffect(() => {
    const r = ref(db, 'allTasks')
    const h = (snap: any) => {
      if (!snap.exists()) { setTasks([]); setLoading(false); return }
      const raw = snap.val()
      const rows: Task[] = Array.isArray(raw)
        ? raw
        : Object.values(raw)
      setTasks(rows)
      setLoading(false)
    }
    onValue(r, h)
    return () => off(r, 'value', h)
  }, [])

  async function toggleDone(task: Task) {
    const updated = tasks.map(t =>
      t.id === task.id ? { ...t, done: !t.done } : t
    )
    setTasks(updated)
    await set(ref(db, 'allTasks'), updated)
  }

  async function addTask() {
    const text = newText.trim()
    if (!text) return
    const newTask: Task = {
      id: Date.now(),
      text,
      prio: newPrio,
      bucket: newBucket,
      done: false,
      createdAt: new Date().toISOString().split('T')[0],
    }
    const updated = [...tasks, newTask]
    setTasks(updated)
    setNewText('')
    await set(ref(db, 'allTasks'), updated)
  }

  const rows = useMemo(() => tasks.filter(t => {
    if (filter === 'open' && t.done) return false
    if (filter === 'done' && !t.done) return false
    if (activeBucket !== 'all' && t.bucket !== activeBucket) return false
    if (search) {
      const q = search.toLowerCase()
      return t.text?.toLowerCase().includes(q) || t.meta?.toLowerCase().includes(q)
    }
    return true
  }), [tasks, filter, activeBucket, search])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    BUCKETS.forEach(b => {
      c[b.key] = tasks.filter(t => t.bucket === b.key && !t.done).length
    })
    return c
  }, [tasks])

  const openCount = tasks.filter(t => !t.done).length

  const filters = (
    <div className={styles.filters}>
      <select className={styles.sel} value={filter} onChange={e => setFilter(e.target.value)}>
        <option value="open">Open</option>
        <option value="done">Done</option>
        <option value="all">All</option>
      </select>
    </div>
  )

  if (loading) {
    return (
      <div className={styles.page}>
        <PageHeader title="Tasks" sub="Loading…" />
        <div className={styles.skeletonWrap}>
          {[...Array(5)].map((_, i) => <div key={i} className={styles.skeleton} />)}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="Tasks"
        sub={`${openCount} open`}
        search={{ value: search, onChange: setSearch, placeholder: 'Search tasks…' }}
        filters={filters}
      />

      {/* Bucket tabs */}
      <div className={styles.buckets}>
        {BUCKETS.map(b => (
          <button
            key={b.key}
            className={`${styles.bucketTab} ${activeBucket === b.key ? styles.bucketTabActive : ''}`}
            onClick={() => setActiveBucket(b.key)}
          >
            {b.label}
            {counts[b.key] > 0 && (
              <span className={styles.bucketCount}>{counts[b.key]}</span>
            )}
          </button>
        ))}
        <button
          className={`${styles.bucketTab} ${activeBucket === 'all' ? styles.bucketTabActive : ''}`}
          onClick={() => setActiveBucket('all')}
        >
          All
        </button>
      </div>

      {/* ── Add task bar ── */}
      {adding ? (
        <div className={styles.addBar}>
          <input
            className={styles.addInput}
            autoFocus
            type="text"
            placeholder="Task description…"
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { addTask(); setAdding(false) } if (e.key === 'Escape') { setAdding(false); setNewText('') } }}
          />
          <select className={styles.addSel} value={newPrio} onChange={e => setNewPrio(e.target.value as 'h' | 'm' | 'l')}>
            <option value="h">High</option>
            <option value="m">Medium</option>
            <option value="l">Low</option>
          </select>
          <select className={styles.addSel} value={newBucket} onChange={e => setNewBucket(e.target.value)}>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="later">Later</option>
            <option value="someday">Someday</option>
          </select>
          <button className={styles.addConfirmBtn} onClick={() => { addTask(); setAdding(false) }}>Add</button>
          <button className={styles.addCancelBtn} onClick={() => { setAdding(false); setNewText('') }}>Cancel</button>
        </div>
      ) : (
        <button className={styles.addTaskBtn} onClick={() => { setAdding(true); setNewBucket(activeBucket === 'all' ? 'today' : activeBucket) }}>
          + Add Task
        </button>
      )}

      {/* Task list */}
      {rows.length === 0 ? (
        <div className={styles.empty}>
          {search ? 'No tasks match.' : filter === 'done' ? 'No completed tasks.' : 'No open tasks in this bucket.'}
        </div>
      ) : (
        <div className={styles.list}>
          {rows.map(t => {
            const prioColor = PRIO_COLOR[t.prio || 'l']
            return (
              <div
                key={t.id}
                className={`${styles.taskRow} ${t.done ? styles.taskDone : ''} ${t.overdue && !t.done ? styles.taskOverdue : ''}`}
              >
                {/* Checkbox */}
                <button
                  className={`${styles.checkbox} ${t.done ? styles.checkboxDone : ''}`}
                  onClick={() => toggleDone(t)}
                  title={t.done ? 'Mark open' : 'Mark done'}
                >
                  {t.done && <span className={styles.checkmark}>✓</span>}
                </button>

                {/* Priority dot */}
                <span
                  className={styles.prioDot}
                  style={{ background: prioColor }}
                  title={PRIO_LABEL[t.prio || 'l']}
                />

                {/* Content */}
                <div className={styles.taskContent}>
                  <div className={styles.taskText}>{t.text}</div>
                  {t.meta && <div className={styles.taskMeta}>{t.meta}</div>}
                </div>

                {/* Right: overdue badge or due date */}
                <div className={styles.taskRight}>
                  {t.overdue && !t.done && (
                    <span className={styles.overdueBadge}>
                      {t.daysOverdue ? `${t.daysOverdue}d overdue` : 'Overdue'}
                    </span>
                  )}
                  {t.assignedTo && t.assignedTo !== 'both' && (
                    <span className={styles.assignee}>{t.assignedTo}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
