const AUTH_KEY = 'kpi-cascading-auth'

export function isAuthenticated(): boolean {
  try {
    return localStorage.getItem(AUTH_KEY) === '1'
  } catch {
    return false
  }
}

export function setAuthenticated(): void {
  try {
    localStorage.setItem(AUTH_KEY, '1')
  } catch {
    // ignore storage errors
  }
}

export function clearAuthenticated(): void {
  try {
    localStorage.removeItem(AUTH_KEY)
  } catch {
    // ignore storage errors
  }
}
