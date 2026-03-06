# TheBrandingStudio CRM — CLAUDE.md

Proyecto CRM interno para agencia de marketing. Stack full-stack con frontend React y backend Express/SQLite.

## Comandos

```bash
# Correr todo (frontend :5173 + backend :3001)
npm run dev:all

# Solo frontend
npm run dev

# Solo backend
cd backend && npx tsx src/server.ts

# Build
npm run build
```

## Arquitectura

```
CRM/
  src/                        # Frontend React
    App.tsx                   # Router principal (AuthGuard, AdminGuard)
    main.tsx
    components/
      layout/
        Layout.tsx            # Shell admin con Sidebar + Header + Outlet
        Sidebar.tsx
        Header.tsx
      Logo.tsx                # LogoMark, LogoFull, LogoLogin (SVG diamante crimson)
    pages/
      Login.tsx               # Pantalla de entrada publica
      Dashboard.tsx           # / (admin)
      Prospectos.tsx          # /prospectos — kanban por status
      Clientes.tsx            # /clientes — grid cards + drawer
      Ideas.tsx               # /ideas — board kanban 4 columnas
      TodoSemanal.tsx         # /todo — lista semanal con progress bar
      Aprobaciones.tsx        # /aprobaciones — aprobacion de posts
      PlanMarketing.tsx       # /plan — timeline de hitos por cliente
      Metricas.tsx            # /metricas — dashboard LinkedIn admin
      ClientPortal.tsx        # /portal — portal cliente (plan/posts/metricas)
    store/
      useAuthStore.ts         # Zustand auth (token JWT, rol)
      useStore.ts             # Zustand store con datos de muestra
    lib/
      api.ts                  # Axios instance apuntando a :3001
      utils.ts                # Helpers, config de colores por status
    types/
      index.ts                # Tipos TS: Prospect, Client, Todo, Idea, Post, MarketingPlan
    index.css                 # Clases custom: glass-card, btn-primary, nav-item, input-dark

  backend/
    src/
      server.ts               # Express app, CORS, rutas, arranque
      db.ts                   # better-sqlite3, initDB(), seedDB()
      middleware/
        auth.ts               # Verificacion JWT
      routes/
        auth.ts               # POST /api/auth/login, /logout
        clients.ts            # CRUD /api/clients
        prospects.ts          # CRUD /api/prospects
        todos.ts              # CRUD /api/todos
        ideas.ts              # CRUD /api/ideas
        posts.ts              # CRUD /api/posts
        plans.ts              # CRUD /api/plans
        metrics.ts            # CRUD /api/metrics
    data/crm.db               # SQLite database
    uploads/                  # Archivos subidos

  tailwind.config.js          # Tema crimson/ink personalizado
  vite.config.ts              # Proxy /api y /uploads → :3001
  package.json
```

## Stack

| Capa | Tecnologia |
|------|-----------|
| Frontend | React 19 + TypeScript + Vite |
| Estilos | Tailwind CSS v3 + clases custom en index.css |
| Animaciones | Framer Motion |
| Routing | React Router DOM v7 |
| Estado global | Zustand v5 + persist (`tbs-crm-store`) |
| HTTP client | Axios |
| Iconos | Lucide React |
| Graficas | Recharts |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable |
| Fechas | date-fns |
| Backend | Express + TypeScript (tsx) |
| Base de datos | SQLite via better-sqlite3 |
| Auth | JWT (7 dias) + bcrypt 10 rounds |

## Auth

- Token en localStorage: `tbs_token`, user: `tbs_user`
- `useAuthStore.ts`: `isAuthenticated()`, `isAdmin()`, `restoreSession()`
- Admin → acceso a todas las rutas bajo `/`
- Client → solo `/portal` y `/aprobaciones`
- Proxy Vite: `/api` → `localhost:3001`, `/uploads` → `localhost:3001`

### Credenciales de prueba

| Rol | Email | Password |
|-----|-------|----------|
| Admin | admin@thebrandingstudio.com | TBS@Admin2025! |
| Client | hola@technova.com | TechNova@2025! |

## Paleta y diseno

- **Crimson**: `#DC143C` — clase Tailwind `crimson-700` (color primario)
- **Ink/Negro**: `#0a0a0a` bg, `#111111` cards, escala `ink-*`
- **Glassmorphism**: clases `glass-card`, `glass-card-hover` en `index.css`
- Estetica: dark, moderna, elegante — Framer Motion en todo

## API Endpoints

```
POST   /api/auth/login
POST   /api/auth/logout

GET/POST        /api/clients
GET/PUT/DELETE  /api/clients/:id

GET/POST        /api/prospects
GET/PUT/DELETE  /api/prospects/:id

GET/POST        /api/todos
GET/PUT/DELETE  /api/todos/:id

GET/POST        /api/ideas
GET/PUT/DELETE  /api/ideas/:id

GET/POST        /api/posts
GET/PUT/DELETE  /api/posts/:id

GET/POST        /api/plans
GET/PUT/DELETE  /api/plans/:id

GET/POST        /api/metrics
GET/PUT/DELETE  /api/metrics/:id

GET             /api/health
```

## Datos de muestra (seed)

- 3 clientes: TechNova, Bloom Wellness, Urban Bites
- 4 prospectos en distintos stages
- 5 tareas, 3 ideas, 3 posts
- 1 plan de marketing completo (TechNova Q2 2025)

## Preferencias del usuario

- Animaciones abundantes con Framer Motion
- Estetica dark: crimson + negro + blanco
- UI muy moderna y elegante
- Simple pero completo
- No sobre-ingenierizar: cambios minimos y directos
