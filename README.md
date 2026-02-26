# KPI Cascading Agent — Frontend

React SPA (Vite + TypeScript + React Router) для инструмента каскадирования KPI.

## Запуск

```bash
npm install
npm run dev
```

Приложение откроется на http://localhost:5173

## Сборка

```bash
npm run build
npm run preview   # просмотр production-сборки
```

## Структура

- `src/App.tsx` — роуты и обёртка в Layout
- `src/components/Layout` — шапка и навигация по разделам
- `src/pages/` — заглушки страниц:
  - **ImportPage** — импорт документов банка
  - **ChatPage** — чат с LLM и вложения
  - **DashboardsPage** — дашборды и графики по целям

Детальный план проекта: [../docs/PROJECT_PLAN.md](../docs/PROJECT_PLAN.md).
