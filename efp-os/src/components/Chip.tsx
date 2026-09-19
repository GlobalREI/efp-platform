/**
 * Chip — compact object pill linking to a record
 * Usage: <PlayerChip name="Moses Usor" id="..." />
 *        <ClubChip name="FC Köln" id="..." />
 *        <ContactChip name="Alex Kroes" id="..." />
 */
import { useNavigate } from 'react-router-dom'
import styles from './Chip.module.css'

interface ChipProps {
  name: string
  id?: string
  onClick?: () => void
  size?: 'sm' | 'md'
}

export function PlayerChip({ name, id, onClick, size = 'md' }: ChipProps) {
  const nav = useNavigate()
  const initials = name.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const handle = onClick ?? (id ? () => nav(`/players/${id}`) : undefined)
  return (
    <span
      className={`${styles.chip} ${styles.player} ${styles[size]} ${handle ? styles.clickable : ''}`}
      onClick={handle}
      title={name}
    >
      <span className={styles.av}>{initials}</span>
      {name}
    </span>
  )
}

export function ClubChip({ name, id, onClick, size = 'md' }: ChipProps) {
  const nav = useNavigate()
  const handle = onClick ?? (id ? () => nav(`/clubs/${id}`) : undefined)
  return (
    <span
      className={`${styles.chip} ${styles.club} ${styles[size]} ${handle ? styles.clickable : ''}`}
      onClick={handle}
      title={name}
    >
      <span className={styles.icon}>🏟</span>
      {name}
    </span>
  )
}

export function ContactChip({ name, id, onClick, size = 'md' }: ChipProps) {
  const nav = useNavigate()
  const initials = name.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const handle = onClick ?? (id ? () => nav(`/contacts/${id}`) : undefined)
  return (
    <span
      className={`${styles.chip} ${styles.contact} ${styles[size]} ${handle ? styles.clickable : ''}`}
      onClick={handle}
      title={name}
    >
      <span className={styles.av} style={{ background: '#7C3AED' }}>{initials}</span>
      {name}
    </span>
  )
}
