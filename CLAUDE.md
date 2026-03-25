# TheBrandingStudio CRM — CLAUDE.md

Proyecto CRM interno para agencia de marketing. Stack full-stack con frontend React y backend Express/PostgreSQL. Dos interfaces: admin (gestión completa) y cliente (portal con plan, aprobaciones, métricas, ideas, todos, documentos).

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

> **IMPORTANTE**: El backend NO hace hot-reload automático. Después de cambios en `backend/src/`, reiniciar el server manualmente.

## Arquitectura

```
CRM/
  src/                              # Frontend React
    App.tsx                         # Router principal (AuthGuard, AdminGuard)
    main.tsx
    components/
      layout/
        Layout.tsx                  # Shell compartido: Sidebar + Header + Outlet (admin Y cliente)
        Sidebar.tsx                 # Nav condicional: adminNav[] o clientNav[] según rol
        Header.tsx                  # Barra superior con búsqueda, notificaciones (polling 10s), tema
      Logo.tsx                      # LogoMark, LogoFull, LogoLogin (SVG diamante crimson)
      NotesPanel.tsx                # Panel de conversación reutilizable (chat-style notes)
    pages/
      Login.tsx                     # Pantalla de entrada pública
      Dashboard.tsx                 # / (admin)
      Prospectos.tsx                # /prospectos — kanban por status
      Clientes.tsx                  # /clientes — grid cards + drawer
      Ideas.tsx                     # /ideas — board kanban 4 columnas + notas + sharing
      TodoSemanal.tsx               # /todo — lista semanal con progress bar + notas + sharing
      Aprobaciones.tsx              # /aprobaciones — aprobación de posts (admin + cliente)
      PlanMarketing.tsx             # /plan — timeline de hitos por cliente
      Metricas.tsx                  # /metricas — dashboard multi-plataforma
      Usuarios.tsx                  # /usuarios — gestión de usuarios
      Calendario.tsx                # /calendario — eventos con Google Calendar sync
      Documentos.tsx                # /documentos — gestor de archivos con sharing
      client/                       # Páginas exclusivas del portal cliente
        ClientDashboard.tsx         # /portal — hero + quick stats
        ClientPlan.tsx              # /portal/plan — plan estratégico read-only
        ClientPosts.tsx             # /portal/aprobaciones — aprobar/rechazar posts
        ClientActividad.tsx         # /portal/actividad — timeline eventos + Google Cal
        ClientMetricas.tsx          # /portal/metricas — métricas multi-plataforma
        ClientDocumentos.tsx        # /portal/documentos — docs con toggle compartir
        ClientTodos.tsx             # /portal/todo — tareas con sharing + notas
        ClientIdeas.tsx             # /portal/ideas — kanban con sharing + notas
    store/
      useAuthStore.ts               # Zustand auth (token JWT, rol, clientId)
      useThemeStore.ts              # Zustand tema (dark/light)
      useStore.ts                   # Zustand store (clients, sidebarCollapsed) — pendiente refactor
    lib/
      api.ts                        # Axios instance + mappers + funciones API
      utils.ts                      # Helpers, config de colores por status/prioridad/plataforma
      documentHelpers.ts            # getFileIcon, formatFileSize, formatDocDate (compartido)
    types/
      index.ts                      # Tipos TS: Prospect, Client, TodoItem, Idea, Post, etc.
    index.css                       # Clases custom: glass-card, btn-primary, input-dark, thin-scrollbar

  backend/
    src/
      server.ts                     # Express app, CORS, rutas, OAuth, arranque
      db.ts                         # PostgreSQL pool (pg), initDB(), seedDB(), migraciones
      middleware/
        auth.ts                     # JWT verify, requireAdmin, AuthRequest, signToken
        apiKey.ts                   # Middleware API keys
      routes/
        auth.ts                     # POST /api/auth/login, /logout
        clients.ts                  # CRUD /api/clients + notas + actividad
        prospects.ts                # CRUD /api/prospects + conversión a cliente
        todos.ts                    # CRUD /api/todos + GET/POST /:id/notes (sharing bidireccional)
        ideas.ts                    # CRUD /api/ideas + GET/POST /:id/notes (sharing bidireccional)
        posts.ts                    # CRUD /api/posts + PATCH status + media upload
        plans.ts                    # CRUD /api/plans + milestones + KPIs
        metrics.ts                  # CRUD /api/metrics + sync trigger
        calendar.ts                 # Eventos + participantes + Google Calendar OAuth
        documents.ts                # Upload/download/delete docs (multer, sharing)
        templates.ts                # Templates de posts
        users.ts                    # CRUD usuarios + toggle active + reset password
        notifications.ts            # GET notificaciones + unread count + mark read
        apiKeys.ts                  # CRUD API keys
        publicApi.ts                # API pública con API key auth
        activity.ts                 # Activity log
        reports.ts                  # Reportes
      services/
        emailService.ts             # Nodemailer: invites, post approval, notes, weekly metrics
        activityLogger.ts           # Log de actividad en DB
        linkedin.service.ts         # OAuth + API LinkedIn
        meta.service.ts             # OAuth + API Meta (FB + IG)
        tiktok.service.ts           # OAuth + API TikTok
        ga4.service.ts              # OAuth + API Google Analytics 4
        googleCalendarService.ts    # Google Calendar sync
      workers/
        metrics.worker.ts           # Cron cada 6h: sincronizar métricas
    uploads/                        # Archivos subidos (documents, media)

  tailwind.config.js                # Tema crimson/ink personalizado
  vite.config.ts                    # Proxy /api y /uploads → :3001
  package.json
```

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19 + TypeScript + Vite |
| Estilos | Tailwind CSS v3 + clases custom en index.css |
| Animaciones | Framer Motion |
| Routing | React Router DOM v7 |
| Estado global | Zustand v5 + persist |
| HTTP client | Axios |
| Iconos | Lucide React |
| Gráficas | Recharts |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable |
| Fechas | date-fns |
| Backend | Express + TypeScript (tsx) |
| Base de datos | PostgreSQL via pg (Pool) |
| Auth | JWT (7 días) + bcrypt 10 rounds |
| Email | Nodemailer (SMTP) |
| Upload | Multer |
| Cron | node-cron |

## Auth y Roles

- Token en localStorage: `tbs_token`, user: `tbs_user`
- `useAuthStore.ts`: `isAuthenticated()`, `isAdmin()`, `restoreSession()`
- Proxy Vite: `/api` → `localhost:3001`, `/uploads` → `localhost:3001`

| Rol | Acceso | Rutas |
|-----|--------|-------|
| Admin | Layout con adminNav (11 secciones) | `/` y sub-rutas |
| Client | Layout con clientNav (7 secciones) | `/portal/*` |

Ambos roles usan el mismo Layout (Sidebar + Header + Outlet). El Sidebar muestra nav items diferentes según `user.role`.

### Credenciales de prueba

| Rol | Email | Password |
|-----|-------|----------|
| Admin | admin@thebrandingstudio.com | TBS@Admin2025! |
| Client | hola@technova.com | TechNova@2025! |

## Modelo de Sharing Bidireccional

Todos, Ideas y Documentos tienen columnas `shared` (INTEGER 0/1) y `created_by` (TEXT):

- **Admin** crea item → puede asignar `client_id` → automáticamente `shared=1` → cliente lo ve
- **Cliente** crea item → toggle "Compartir con administrador" → si `shared=1` admin lo ve
- **Ownership**: Solo el `created_by` puede editar/eliminar. La otra parte solo puede dejar notas.
- **GET filters**: Admin ve propios + shared de clientes. Cliente ve propios + shared del admin para su client_id.

## Sistema de Notas (Conversación)

Tabla `item_notes` para chat bidireccional en todos e ideas:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | TEXT PK | UUID |
| item_type | TEXT | 'todo' o 'idea' |
| item_id | TEXT | FK al todo/idea |
| author_id | TEXT | userId del autor |
| author_name | TEXT | Nombre del autor |
| content | TEXT | Contenido de la nota |
| created_at | TIMESTAMPTZ | Timestamp |

- Endpoints: `GET/POST /api/todos/:id/notes` y `GET/POST /api/ideas/:id/notes`
- `notes_count` en GET de todos/ideas cuenta notas de OTROS (no propias) — badge muestra mensajes recibidos
- Al crear nota: se inserta notificación + se envía email via `sendNoteNotification`
- UI: botón "Notas" siempre visible → abre `NotesPanel` (componente compartido en `src/components/`)

## Paleta y Diseño

- **Crimson**: `#DC143C` — clase Tailwind `crimson-700` (color primario)
- **Ink/Negro**: `#0a0a0a` bg, `#111111` cards, escala `ink-*`
- **Glassmorphism**: clases `glass-card`, `glass-card-hover` en `index.css`
- **Scrollbar visible**: clase `thin-scrollbar` (6px, ink-500 thumb)
- Estética: dark, moderna, elegante — Framer Motion en todo
- Soporte dark/light theme via `useThemeStore` + `data-theme` attribute

## API Endpoints

```
POST   /api/auth/login
POST   /api/auth/logout

GET/POST        /api/clients
GET/PUT/DELETE  /api/clients/:id
GET/POST/DELETE /api/clients/:id/notes
GET             /api/clients/:id/activity

GET/POST        /api/prospects
GET/PUT/DELETE  /api/prospects/:id
POST            /api/prospects/:id/convert

GET/POST        /api/todos                    # Filtrado por rol + sharing
GET/PUT/DELETE  /api/todos/:id                # Ownership check
PATCH           /api/todos/:id/toggle
GET/POST        /api/todos/:id/notes          # Conversación

GET/POST        /api/ideas                    # Filtrado por rol + sharing
GET/PUT/DELETE  /api/ideas/:id                # Ownership check
GET/POST        /api/ideas/:id/notes          # Conversación

GET/POST        /api/posts
GET/PUT/DELETE  /api/posts/:id
PATCH           /api/posts/:id/status

GET/POST        /api/plans
GET/PUT/DELETE  /api/plans/:id
GET             /api/plans/milestones/all
POST/PUT/DELETE /api/plans/:planId/milestones
PATCH           /api/plans/:planId/milestones/:id/toggle
POST/PUT/DELETE /api/plans/:planId/kpis

GET/POST        /api/metrics
POST            /api/metrics/sync

GET/POST        /api/documents                # Upload con multer, sharing
GET             /api/documents/:id/download
DELETE          /api/documents/:id

GET/POST/PUT/DELETE  /api/calendar/events
PATCH           /api/calendar/events/:id/client-note
POST/DELETE     /api/calendar/events/:id/participants
GET             /api/calendar/google/status
GET             /api/calendar/google/connect
DELETE          /api/calendar/google/disconnect
POST            /api/calendar/google/sync

GET/POST        /api/users
GET/PUT/DELETE  /api/users/:id
PATCH           /api/users/:id/toggle-active
PATCH           /api/users/:id/reset-password

GET             /api/notifications
GET             /api/notifications/unread
PATCH           /api/notifications/:id/read
PATCH           /api/notifications/read-all

GET             /api/activity
GET/POST/PUT/DELETE /api/templates
POST            /api/templates/:id/use
GET/POST        /api/api-keys
PATCH/DELETE    /api/api-keys/:id

GET             /api/oauth/:platform/connect/:clientId
```

## Convenciones UI

- **Etiquetas de origen**: "Del equipo" (badge azul) en items del contrario. "de {NombreCliente}" (badge crimson) en items de cliente para vista admin. Nunca etiquetar items propios.
- **Toggle de compartir** (cliente): Estilo de ClientDocumentos — ink-700 bg, emerald-500 activo, Share2 icon.
- **Scrollbar**: `thin-scrollbar` + `max-h-[360px]` para todos, `max-h-[520px]` para ideas kanban.
- **Edición**: Abre el mismo modal de creación pre-poblado. Título cambia a "Editar", botón a "Guardar cambios".
- **Notas badge**: Pill crimson-500 con conteo de notas recibidas. Se resetea a 0 al abrir panel.
- **Notificaciones**: Polling cada 10s en Header.tsx.

## Datos de muestra (seed)

- 3 clientes: TechNova, Bloom Wellness, Urban Bites
- 4 prospectos en distintos stages
- 5 tareas, 3 ideas, 3 posts
- 1 plan de marketing completo (TechNova Q2 2025)
- 2 usuarios: admin + cliente TechNova

## Preferencias del usuario

- Animaciones abundantes con Framer Motion
- Estética dark: crimson + negro + blanco
- UI muy moderna y elegante
- Simple pero completo
- No sobre-ingenierizar: cambios mínimos y directos
