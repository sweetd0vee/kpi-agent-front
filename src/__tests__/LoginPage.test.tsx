import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'
import { LoginPage } from '@/pages/LoginPage'

test('requires credentials and navigates on success', async () => {
  const onLogin = vi.fn()
  render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage onLogin={onLogin} />} />
        <Route path="/kpi" element={<div>kpi-page</div>} />
      </Routes>
    </MemoryRouter>
  )

  await userEvent.click(screen.getByRole('button', { name: /войти/i }))
  expect(screen.getByText('Введите логин и пароль.')).toBeInTheDocument()

  await userEvent.type(screen.getByLabelText('Логин'), 'user')
  await userEvent.type(screen.getByLabelText('Пароль'), 'pass')
  await userEvent.click(screen.getByRole('button', { name: /войти/i }))

  expect(onLogin).toHaveBeenCalledTimes(1)
  expect(await screen.findByText('kpi-page')).toBeInTheDocument()
})
