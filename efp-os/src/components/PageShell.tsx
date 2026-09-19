/**
 * PageShell — universal profile page template
 *
 * Usage:
 *   <PageShell
 *     breadcrumbs={[{ label: 'Players', to: '/players' }]}
 *     avatar="MU"
 *     name="Moses Usor"
 *     sub="Centre-Forward · LASK"
 *     chips={['⚽ CF', '🎂 24', '🏟 LASK', '💰 €6.000.000']}
 *     badges={<><PriorityBadge priority="P1" /><StatusPill status="Active" /></>}
 *     actions={<Button variant="primary" size="sm">Save</Button>}
 *     rail={<PitchRail pitches={...} />}
 *   >
 *     <Card title="Player Details">…</Card>
 *   </PageShell>
 */
import React from 'react'
import { Link } from 'react-router-dom'
import styles from './PageShell.module.css'
import { Button } from './Button'

/* ── Breadcrumb item ── */
export interface Crumb {
  label: string
  to?: string
  onClick?: () => void
}

/* ── Main props ── */
interface PageShellProps {
  breadcrumbs?: Crumb[]
  /** Two-letter initials string OR a full image URL */
  avatar?: string
  name: string
  sub?: string
  chips?: string[]
  badges?: React.ReactNode
  actions?: React.ReactNode
  /** Right rail content (related objects, pitches, etc.) */
  rail?: React.ReactNode
  /** Whether the page is in edit mode (controls edit toggle) */
  editMode?: boolean
  onEditToggle?: (on: boolean) => void
  children: React.ReactNode
}

export function PageShell({
  breadcrumbs,
  avatar,
  name,
  sub,
  chips,
  badges,
  actions,
  rail,
  editMode = false,
  onEditToggle,
  children,
}: PageShellProps) {
  const isUrl = avatar?.startsWith('http') || avatar?.startsWith('/')
  const initials = avatar && !isUrl ? avatar : name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className={styles.pageWrap}>
      {/* Breadcrumb */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className={styles.breadcrumb} aria-label="breadcrumb">
          {breadcrumbs.map((crumb, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span>/</span>}
              {crumb.to ? (
                <Link to={crumb.to}>{crumb.label}</Link>
              ) : crumb.onClick ? (
                <button onClick={crumb.onClick}>{crumb.label}</button>
              ) : (
                <span style={{ color: 'var(--text-2)' }}>{crumb.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      {/* Hero */}
      <div className={styles.hero}>
        {isUrl ? (
          <img className={styles.avatarImg} src={avatar} alt={name} />
        ) : (
          <div className={styles.avatar}>{initials}</div>
        )}

        <div className={styles.heroInfo}>
          <h1 className={styles.heroName}>{name}</h1>
          {sub && <p className={styles.heroSub}>{sub}</p>}

          {chips && chips.length > 0 && (
            <div className={styles.heroChips}>
              {chips.map((c, i) => (
                <span key={i} className={styles.heroChip}>{c}</span>
              ))}
            </div>
          )}

          {badges && <div className={styles.heroBadges}>{badges}</div>}
        </div>

        {/* Right side: edit toggle + custom actions */}
        <div className={styles.heroActions}>
          {onEditToggle && (
            <div className={styles.editToggleWrap}>
              <span className={styles.editModeLabel}>{editMode ? 'Editing' : 'View'}</span>
              <Button
                size="sm"
                variant={editMode ? 'primary' : 'secondary'}
                onClick={() => onEditToggle(!editMode)}
                style={{ fontSize: '12px' }}
              >
                {editMode ? 'Save' : '✏ Edit'}
              </Button>
            </div>
          )}
          {actions}
        </div>
      </div>

      {/* Body: main + rail */}
      <div className={styles.body}>
        <div className={styles.mainCol}>{children}</div>
        {rail && <div className={styles.rail}>{rail}</div>}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   Sub-components — import and compose inside any profile view
───────────────────────────────────────────────────────────────────────────── */

/** Card with optional header title + actions */
interface CardProps {
  title?: string
  titleIcon?: string
  headerRight?: React.ReactNode
  children: React.ReactNode
  noPad?: boolean
}
export function Card({ title, titleIcon, headerRight, children, noPad }: CardProps) {
  return (
    <div className={styles.card}>
      {title && (
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>
            {titleIcon && <span className={styles.cardTitleIcon}>{titleIcon}</span>}
            {title}
          </span>
          {headerRight}
        </div>
      )}
      <div className={noPad ? undefined : styles.cardBody}>{children}</div>
    </div>
  )
}

/** Two-column field grid */
interface FieldGridProps {
  children: React.ReactNode
}
export function FieldGrid({ children }: FieldGridProps) {
  return <div className={styles.fieldGrid}>{children}</div>
}

/** Single label + value field */
interface FieldProps {
  label: string
  value?: React.ReactNode
  full?: boolean
}
export function Field({ label, value, full }: FieldProps) {
  return (
    <div className={`${styles.field} ${full ? styles.fieldGridFull : ''}`}>
      <div className={styles.fieldLabel}>{label}</div>
      <div className={`${styles.fieldValue} ${!value || value === '—' ? styles.fieldEmpty : ''}`}>
        {value || '—'}
      </div>
    </div>
  )
}

/** Rail item — a clickable record row inside the right rail */
interface RailItemProps {
  initials?: string
  name: string
  sub?: string
  right?: React.ReactNode
  onClick?: () => void
}
export function RailItem({ initials, name, sub, right, onClick }: RailItemProps) {
  const ini = initials || name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className={styles.railItem} onClick={onClick}>
      <div className={styles.railAvatar}>{ini}</div>
      <div className={styles.railItemInfo}>
        <div className={styles.railItemName}>{name}</div>
        {sub && <div className={styles.railItemSub}>{sub}</div>}
      </div>
      {right}
    </div>
  )
}

/** Empty state inside rail */
export function RailEmpty({ message }: { message: string }) {
  return <div className={styles.railEmpty}>{message}</div>
}
