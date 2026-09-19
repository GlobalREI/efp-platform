/**
 * AppLayout — universal chrome: dark green sidebar + sticky topbar + <Outlet />
 * Every route in the app renders inside this shell.
 */
import React, { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import styles from './AppLayout.module.css'
import {
  IconDashboard, IconMandates, IconClubs, IconContacts,
  IconNeeds, IconPitches, IconScout, IconActivities,
  IconSettings, IconBell, IconSearch
} from './Icons'

const NAV_MAIN = [
  { to: '/',           label: 'Dashboard',  Icon: IconDashboard  },
  { to: '/mandates',   label: 'Mandates',   Icon: IconMandates   },
  { to: '/clubs',      label: 'Clubs',      Icon: IconClubs      },
  { to: '/contacts',   label: 'Contacts',   Icon: IconContacts   },
  { to: '/needs',      label: 'Club Needs', Icon: IconNeeds      },
  { to: '/pitches',    label: 'Pitches',    Icon: IconPitches    },
  { to: '/scout',      label: 'Scout',      Icon: IconScout      },
  { to: '/activities', label: 'Activities', Icon: IconActivities },
]

const NAV_BOTTOM = [
  { to: '/settings', label: 'Settings', Icon: IconSettings },
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
          <div className={styles.logoMark}>E</div>
          <span className={styles.logoText}>EFP OS</span>
        </div>

        <nav className={styles.nav}>
          {NAV_MAIN.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.active : ''}`
              }
            >
              <span className={styles.navIcon}><Icon size={15} /></span>
              <span className={styles.navLabel}>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className={styles.sidebarBottom}>
          {NAV_BOTTOM.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.active : ''}`
              }
            >
              <span className={styles.navIcon}><Icon size={15} /></span>
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
            <span className={styles.searchIcon}><IconSearch size={13} /></span>
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
            <button className={styles.topbarAction} title="Notifications">
              <IconBell size={15} />
            </button>
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
