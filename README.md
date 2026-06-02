Felix Microfinance - Starter Scaffold

Overview:

- React + Vite frontend with Tailwind CSS
- Minimal Express backend with API stubs

Getting started:

1. Install dependencies

```bash
npm install
```

2. Create an `.env` file from `.env.example` and configure values (Postgres connection, JWT secret, MPesa credentials)

3. Run database migrations (Postgres must be accessible):

```bash
npm run migrate
```

4. Run frontend and backend in separate terminals

```bash
npm run dev:frontend
npm run dev:backend
```

Frontend: http://localhost:5173
Backend API: http://localhost:4000

Notes / Next steps:

- Backend now uses Postgres + JWT auth; register/login endpoints added in `server/index.js`.
- MPesa Daraja helper lives in `server/services/mpesa.js` and uses env credentials.
- Migrations are in `db/migrations/` and run via `npm run migrate`.
- Tests run with `npm test`; CI workflow runs migrations and tests in GitHub Actions.
