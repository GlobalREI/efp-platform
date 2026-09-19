/**
 * PageHeader — standard list-page header
 *
 * Usage:
 *   <PageHeader
 *     title="Mandates"
 *     sub="12 active · Winter 2027 window"
 *     search={{ value, onChange, placeholder }}
 *     actions={<Button variant="primary" size="sm">+ New Mandate</Button>}
 *   >
 *     <FilterSelect … />   ← optional extra filter slots
 *   </PageHeader>
 */
import React from 'react'
import styles from './PageHeader.module.css'

interface SearchProps {
  value: string
  onChange: (val: string) => void
  placeholder?: string
}

interface PageHeaderProps {
  title: string
  sub?: string
  search?: SearchProps
  actions?: React.ReactNode
  /** Extra filter controls shown between search and primary actions */
  filters?: React.ReactNode
  children?: React.ReactNode
}

export function PageHeader({
  title,
  sub,
  search,
  actions,
  filters,
  children,
}: PageHeaderProps) {
  return (
    <div className={styles.header}>
      <div className={styles.titleBlock}>
        <h1 className={styles.title}>{title}</h1>
        {sub && <p className={styles.sub}>{sub}</p>}
      </div>

      <div className={styles.controls}>
        {search && (
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              className={styles.searchInput}
              type="search"
              value={search.value}
              onChange={e => search.onChange(e.target.value)}
              placeholder={search.placeholder ?? 'Search…'}
            />
          </div>
        )}
        {filters}
        {children}
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </div>
  )
}
