/**
 * AppLayout — universal chrome: dark sidebar + sticky topbar + <Outlet />
 * Every route in the app renders inside this shell.
 */
import React, { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import styles from './AppLayout.module.css'

const NAV_MAIN = [
  { to: '/',           label: 'Dashboard',  icon: '📊' },
  { to: '/mandates',   label: 'Mandates',   icon: '⚽' },
  { to: '/clubs',      label: 'Clubs',      icon: '🏟' },
  { to: '/contacts',   label: 'Contacts',   icon: '👤' },
  { to: '/needs',      label: 'Club Needs', icon: '🎯' },
  { to: '/pitches',    label: 'Pitches',    icon: '📤' },
  { to: '/scout',      label: 'Scout',      icon: '🔍' },
  { to: '/activities', label: 'Activities', icon: '📋' },
]

const NAV_BOTTOM = [
  { to: '/settings', label: 'Settings', icon: '⚙️' },
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
      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <span className={styles.logoMark}>EFP</span>
          <span className={styles.logoSub}>OS</span>
        </div>

        <nav className={styles.nav}>
          {NAV_MAIN.map(({ to, label, icon }) => (
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
          {NAV_BOTTOM.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.active : ''}`
              }
            >
              <span className={styles.navIcon}>{icon}</span>
              <span className={styles.navLabel}>{label}</span>
            </NavLink>
          ))}
          <div className={styles.sidebarUser}>
            <div className={styles.sidebarAvatar}>TB</div>
            <div className={styles.sidebarUserInfo}>
              <div className={styles.sidebarUserName}>Timo Braasch</div>
              <div className={styles.sidebarUserRole}>Partner · EFP</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main column ── */}
      <div className={styles.main}>
        {/* Sticky topbar */}
        <header className={styles.topbar}>
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              className={styles.searchInput}
              type="search"
              placeholder="Search mandates, clubs, contacts…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleSearch}
            />
            <kbd className={styles.searchKbd}>↵</kbd>
          </div>
          <div className={styles.topbarRight}>
            <button className={styles.topbarAction} title="Notifications">🔔</button>
            <div className={styles.topbarDivider} />
            <button className={styles.avatarBtn} title="Account">T</button>
          </div>
        </header>

        {/* Scrollable content */}
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
