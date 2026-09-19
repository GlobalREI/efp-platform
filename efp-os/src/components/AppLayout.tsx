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

// ── Nav structure with sections ───────────────────────────────────────────────
const NAV = [
  {
    section: 'Overview',
    items: [
      { to: '/',       label: 'Dashboard',   Icon: IconDashboard },
    ],
  },
  {
    section: 'Players',
    items: [
      { to: '/mandates', label: 'Players',      Icon: IconMandates },
      { to: '/scout',    label: 'AI Matches',   Icon: IconScout    },
    ],
  },
  {
    section: 'CRM',
    items: [
      { to: '/clubs',    label: 'Clubs',        Icon: IconClubs    },
      { to: '/contacts', label: 'Contacts',     Icon: IconContacts },
      { to: '/needs',    label: 'Club Needs',   Icon: IconNeeds    },
    ],
  },
  {
    section: 'Pipeline',
    items: [
      { to: '/pitches',  label: 'Pitches',      Icon: IconPitches     },
    ],
  },
  {
    section: 'Workspace',
    items: [
      { to: '/tasks',      label: 'Tasks',      Icon: IconActivities  },
      { to: '/activities', label: 'Activity',   Icon: IconActivities  },
    ],
  },
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
          {NAV.map(({ section, items }) => (
            <div key={section} className={styles.navSection}>
              <div className={styles.navSectionLabel}>{section}</div>
              {items.map(({ to, label, Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `${styles.navItem} ${isActive ? styles.active : ''}`
                  }
                >
                  <span className={styles.navIcon}><Icon size={14} /></span>
                  <span className={styles.navLabel}>{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className={styles.sidebarBottom}>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.active : ''}`
            }
          >
            <span className={styles.navIcon}><IconSettings size={14} /></span>
            <span className={styles.navLabel}>Settings</span>
          </NavLink>
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
        <header className={styles.topbar}>
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon}><IconSearch size={13} /></span>
            <input
              className={styles.searchInput}
              type="search"
              placeholder="Search players, clubs, contacts…"
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

        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
