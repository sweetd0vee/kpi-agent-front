import { useEffect, useState } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import styles from './Layout.module.css'

const iconSize = 20

const icons = {
  kpi: (
    <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  ),
  goals: (
    <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  knowledge: (
    <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M8 7h8" />
      <path d="M8 11h8" />
    </svg>
  ),
  chat: (
    <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  dashboards: (
    <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  ),
  settings: (
    <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
}

const goalsItems = [
  { to: '/kpi', label: 'КПЭ' },
  { to: '/ppr', label: 'ППР' },
] as const

const navItems = [
  { to: '/knowledge', label: 'База знаний', icon: icons.knowledge },
  { to: '/chat', label: 'Чат с моделью', icon: icons.chat },
  { to: '/dashboards', label: 'Дашборды', icon: icons.dashboards },
  { to: '/settings', label: 'Настройки', icon: icons.settings },
] as const

const goalsSubnavId = 'sidebar-goals-links'

const isPathActive = (pathname: string, target: string) => pathname === target || pathname.startsWith(`${target}/`)

export function Layout({ children }: { children?: React.ReactNode }) {
  const location = useLocation()
  const isGoalsActive = goalsItems.some((item) => isPathActive(location.pathname, item.to))
  const [goalsOpen, setGoalsOpen] = useState(isGoalsActive)

  useEffect(() => {
    if (isGoalsActive) setGoalsOpen(true)
  }, [isGoalsActive])

  return (
    <div className={styles.root}>
      <aside className={styles.sidebar}>
        <h1 className={styles.title}>AI KPI</h1>
        <nav className={styles.nav}>
          <div className={styles.navGroup}>
            <button
              type="button"
              className={[
                styles.navLink,
                styles.navGroupButton,
                isGoalsActive ? styles.navLinkActive : '',
                goalsOpen ? styles.navGroupOpen : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setGoalsOpen((prev) => !prev)}
              aria-expanded={goalsOpen}
              aria-controls={goalsSubnavId}
            >
              <span className={styles.navIcon}>{icons.goals}</span>
              <span className={styles.navGroupLabel}>Цели</span>
              <span className={styles.navCaret} aria-hidden />
            </button>
            {goalsOpen && (
              <div className={styles.navSubnav} id={goalsSubnavId}>
                {goalsItems.map(({ to, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      [styles.navLink, styles.navSubLink, isActive ? styles.navLinkActive : ''].filter(Boolean).join(' ')
                    }
                  >
                    {label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
          {navItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                [styles.navLink, isActive ? styles.navLinkActive : ''].filter(Boolean).join(' ')
              }
            >
              <span className={styles.navIcon}>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className={styles.main}>
        {children ?? <Outlet />}
      </main>
    </div>
  )
}
