import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Layout } from '@/components/Layout'

test('expands goals navigation when on goals route', async () => {
  render(
    <MemoryRouter initialEntries={['/kpi']}>
      <Layout>
        <div>content</div>
      </Layout>
    </MemoryRouter>
  )

  const toggle = screen.getByRole('button', { name: 'Цели' })
  expect(toggle).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByRole('link', { name: 'КПЭ' })).toBeInTheDocument()

  await userEvent.click(toggle)
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('link', { name: 'КПЭ' })).not.toBeInTheDocument()
})
