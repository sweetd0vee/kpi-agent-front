import styles from './PageStub.module.css'

export function DashboardsPage() {
  return (
    <div className={styles.page}>
      <h2 className={styles.heading}>Дашборды и графики</h2>
      <p className={styles.description}>
        Визуализация каскадирования целей (руководитель → подразделения): фильтры, дерево целей,
        графики KPI, таблица целей.
      </p>
      <div className={styles.placeholder}>
        Фильтры, дерево целей и графики — заглушка
      </div>
    </div>
  )
}
