import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './LoginPage.module.css'

export function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!login.trim() || !password.trim()) {
      setError('Введите логин и пароль.')
      return
    }
    setError(null)
    onLogin()
    navigate('/strategy-goals', { replace: true })
  }

  return (
    <div className={styles.page}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <h1 className={styles.title}>AI KPI</h1>
        {error && <div className={styles.error}>{error}</div>}
        <label className={styles.field}>
          Логин
          <input
            type="text"
            className={styles.input}
            placeholder="Введите логин"
            value={login}
            onChange={(e) => {
              setLogin(e.target.value)
              if (error) setError(null)
            }}
            autoComplete="username"
            autoFocus
          />
        </label>
        <label className={styles.field}>
          Пароль
          <input
            type="password"
            className={styles.input}
            placeholder="Введите пароль"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (error) setError(null)
            }}
            autoComplete="current-password"
          />
        </label>
        <button type="submit" className={styles.submit}>
          Войти
        </button>
      </form>
    </div>
  )
}
