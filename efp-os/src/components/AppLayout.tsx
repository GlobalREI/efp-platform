/**
 * AppLayout — universal chrome: sidebar + topbar + <Outlet />
 */
import React, { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import styles from './AppLayout.module.css'

const NAV = [
  { to: '/',          label: 'Dashboard',  icon: '📊' },
  { to: '/players',   label: 'Players',    icon: '⚽' },
  { to: '/clubs',     label: 'Clubs',      icon: '🏟' },
  { to: '/contacts',  label: 'Contacts',   icon: '👤' },
  { to: '/needs',     label: 'Needs',      icon: '🎯' },
  { to: '/pitches',   label: 'Pitches',    icon: '📤' },
  { to: '/tasks',     label: 'Tasks',      icon: '✅' },
]

export function AppLayout() {
  const [search, setSearch] = useState('')
  const nav = useNavigate()

  function handleSearch(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && search.trim()) {
      nav(`/search?q=${encodeURIComponent(search.trim())}`)
      setSearch('')
    }
  }

  return (
    <div className={styles.shell}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <span className={styles.logoMark}>EFP</span>
          <span className={styles.logoSub}>OS</span>
        </div>

        <nav className={styles.nav}>
          {NAV.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.active : ''}`
              }
            >
              <span className={styles.navIcon}>{icon}</span>
              <span className={styles.navLabel}>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className={styles.sidebarBottom}>
          <NavLink to="/settings" className={styles.navItem}>
            <span className={styles.navIcon}>⚙️</span>
            <span className={styles.navLabel}>Settings</span>
          </NavLink>
        </div>
      </aside>

      {/* Main column */}
      <div className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              className={styles.searchInput}
              type="search"
              placeholder="Search players, clubs, contacts…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleSearch}
            />
          </div>
          <div className={styles.topbarRight}>
            <button className={styles.avatarBtn} title="Account">T</button>
          </div>
        </header>

        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
