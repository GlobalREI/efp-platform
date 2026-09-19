/**
 * Shared formatting utilities
 * MoneyFormat: €2.000.000 (European style, dots as thousands separators)
 * DateFormat:  dd MMM yyyy  → "17 Sep 2026"
 */

export function formatMoney(
  value: number | string | null | undefined,
  currency = '€'
): string {
  if (value == null || value === '') return '—'
  const n = typeof value === 'string' ? parseFloat(value.replace(/[^\d.-]/g, '')) : value
  if (isNaN(n)) return '—'
  const formatted = new Intl.NumberFormat('de-DE', {
    maximumFractionDigits: 0,
  }).format(Math.round(n))
  return `${currency}${formatted}`
}

export function formatDate(
  value: Date | string | number | { toDate(): Date } | null | undefined
): string {
  if (value == null) return '—'
  let d: Date
  if (typeof value === 'object' && 'toDate' in value) {
    d = (value as { toDate(): Date }).toDate()
  } else if (value instanceof Date) {
    d = value
  } else {
    d = new Date(value as string | number)
  }
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function timeAgo(
  value: Date | string | number | { toDate(): Date } | null | undefined
): string {
  if (value == null) return '—'
  let d: Date
  if (typeof value === 'object' && 'toDate' in value) {
    d = (value as { toDate(): Date }).toDate()
  } else if (value instanceof Date) {
    d = value
  } else {
    d = new Date(value as string | number)
  }
  if (isNaN(d.getTime())) return '—'
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const diff = d.getTime() - Date.now()
  const secs = diff / 1000
  const mins = secs / 60
  const hours = mins / 60
  const days = hours / 24
  const weeks = days / 7
  const months = days / 30.44
  const years = days / 365.25
  if (Math.abs(secs) < 60) return 'just now'
  if (Math.abs(mins) < 60) return rtf.format(Math.round(mins), 'minute')
  if (Math.abs(hours) < 24) return rtf.format(Math.round(hours), 'hour')
  if (Math.abs(days) < 7) return rtf.format(Math.round(days), 'day')
  if (Math.abs(weeks) < 5) return rtf.format(Math.round(weeks), 'week')
  if (Math.abs(months) < 12) return rtf.format(Math.round(months), 'month')
  return rtf.format(Math.round(years), 'year')
}
