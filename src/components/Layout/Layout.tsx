import { Outlet, NavLink } from 'react-router-dom'
import styles from './Layout.module.css'

const navItems = [
  { to: '/goals', label: 'Цели' },
  { to: '/knowledge', label: 'База знаний' },
  { to: '/chat', label: 'Чат с моделью' },
  { to: '/dashboards', label: 'Дашборды' },
] as const

export function Layout({ children }: { children?: React.ReactNode }) {
  return (
    <div className={styles.root}>
      <aside className={styles.sidebar}>
        <h1 className={styles.title}>AI KPI</h1>
        <nav className={styles.nav}>
          {navItems.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                [styles.navLink, isActive ? styles.navLinkActive : ''].filter(Boolean).join(' ')
              }
            >
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
