import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { DashboardsPage } from '@/pages/DashboardsPage'

vi.mock('@/api/goals', () => ({
  getKpiRows: vi.fn(),
  getPprRows: vi.fn(),
}))

import { getKpiRows, getPprRows } from '@/api/goals'

const kpiRows = [
  {
    id: '1',
    lastName: 'Иванов',
    goal: '',
    metricGoals: 'Goal A',
    weightQ: '',
    weightYear: '50%',
    q1: '',
    q2: '',
    q3: '',
    q4: '',
    year: '2024',
    reportYear: '2024',
  },
  {
    id: '2',
    lastName: 'Петров',
    goal: '',
    metricGoals: 'Goal B',
    weightQ: '',
    weightYear: '',
    q1: '',
    q2: '',
    q3: '',
    q4: '',
    year: '',
    reportYear: '2024',
  },
]

const pprRows = [
  {
    id: '3',
    lastName: 'Сидоров',
    goal: '',
    metricGoals: 'Goal C',
    weightQ: '',
    weightYear: '20',
    q1: '',
    q2: '',
    q3: '',
    q4: '',
    year: '2025',
    reportYear: '2025',
  },
]

test('renders KPI and PPR stats', async () => {
  vi.mocked(getKpiRows).mockResolvedValue(kpiRows)
  vi.mocked(getPprRows).mockResolvedValue(pprRows)

  render(<DashboardsPage />)

  await waitFor(() => expect(getKpiRows).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(getPprRows).toHaveBeenCalledTimes(1))

  const totalLabel = screen.getByText('целей (строк)')
  expect(totalLabel.previousElementSibling!).toHaveTextContent('2')
  const employeesLabel = screen.getByText('сотрудников (ФИО)')
  expect(employeesLabel.previousElementSibling!).toHaveTextContent('2')
  const weightLabel = screen.getByText('с весом года (%)')
  expect(weightLabel.previousElementSibling!).toHaveTextContent('1')

  await userEvent.click(screen.getByRole('tab', { name: 'ППР' }))
  expect(totalLabel.previousElementSibling!).toHaveTextContent('1')
})
