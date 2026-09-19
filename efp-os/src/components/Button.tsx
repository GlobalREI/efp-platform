/**
 * Button — primary / secondary / ghost / danger variants
 */
import React from 'react'
import styles from './Button.module.css'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size    = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: React.ReactNode
  loading?: boolean
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  loading = false,
  children,
  disabled,
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`${styles.btn} ${styles[variant]} ${styles[size]} ${loading ? styles.loading : ''} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <span className={styles.spinner} />}
      {!loading && icon && <span className={styles.icon}>{icon}</span>}
      {children && <span>{children}</span>}
    </button>
  )
}

export function IconButton({ variant = 'ghost', size = 'md', children, className = '', ...rest }: ButtonProps) {
  return (
    <button
      className={`${styles.btn} ${styles.iconOnly} ${styles[variant]} ${styles[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
