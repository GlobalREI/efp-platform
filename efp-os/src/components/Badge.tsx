/**
 * PriorityBadge — P1 / P2 / P3
 * StatusPill    — Sent / Interest / Offer / Done / Declined / Open / Archived
 * Both are display-only. Use the same component everywhere so formatting is consistent.
 */
import styles from './Badge.module.css'

export type Priority = 'P1' | 'P2' | 'P3' | null | undefined

interface PriorityBadgeProps {
  priority: Priority
  size?: 'sm' | 'md'
}

const PRIO_LABELS: Record<string, string> = {
  P1: 'P1',
  P2: 'P2',
  P3: 'P3',
}

export function PriorityBadge({ priority, size = 'md' }: PriorityBadgeProps) {
  if (!priority) return null
  return (
    <span className={`${styles.badge} ${styles[`prio${priority}`]} ${styles[size]}`}>
      {PRIO_LABELS[priority] ?? priority}
    </span>
  )
}

export type PitchStatus = 'Sent' | 'Interest' | 'Offer' | 'Done' | 'Declined' | 'Open' | 'Archived' | 'Active'

interface StatusPillProps {
  status: PitchStatus | string
  size?: 'sm' | 'md'
}

const STATUS_CLASS: Record<string, string> = {
  Sent:      'sent',
  Interest:  'interest',
  Offer:     'offer',
  Done:      'done',
  Declined:  'declined',
  Open:      'open',
  Active:    'open',
  Archived:  'archived',
}

export function StatusPill({ status, size = 'md' }: StatusPillProps) {
  const cls = STATUS_CLASS[status] ?? 'default'
  return (
    <span className={`${styles.pill} ${styles[cls]} ${styles[size]}`}>
      {status}
    </span>
  )
}
