/**
 * Format — inline display components for money and dates
 *
 * MoneyFormat: renders €2.000.000 (European style, dots as thousands separators)
 * DateFormat:  renders "17 Sep 2026"
 * TimeAgo:     renders "3 days ago"
 *
 * All fall back to "—" for null / undefined / empty.
 */
import { formatMoney, formatDate, timeAgo } from '../utils/format'

interface MoneyProps {
  value: number | string | null | undefined
  currency?: string
  /** If true wraps in a <strong> */
  bold?: boolean
}

export function MoneyFormat({ value, currency = '€', bold = false }: MoneyProps) {
  const str = formatMoney(value, currency)
  return bold
    ? <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{str}</strong>
    : <span   style={{ fontVariantNumeric: 'tabular-nums' }}>{str}</span>
}

interface DateProps {
  value: Date | string | number | { toDate(): Date } | null | undefined
  /** If true also shows relative hint in parentheses */
  relative?: boolean
}

export function DateFormat({ value, relative = false }: DateProps) {
  const str = formatDate(value)
  if (str === '—') return <span style={{ color: 'var(--text-3)' }}>—</span>
  if (relative) {
    const rel = timeAgo(value)
    return (
      <span title={str}>
        {str} <span style={{ color: 'var(--text-3)', fontSize: '0.9em' }}>({rel})</span>
      </span>
    )
  }
  return <span>{str}</span>
}

interface TimeAgoProps {
  value: Date | string | number | { toDate(): Date } | null | undefined
  /** Fallback full date shown in title tooltip */
  showTitle?: boolean
}

export function TimeAgo({ value, showTitle = true }: TimeAgoProps) {
  const rel = timeAgo(value)
  const full = formatDate(value)
  return (
    <span title={showTitle ? full : undefined} style={{ color: 'var(--text-3)' }}>
      {rel}
    </span>
  )
}
