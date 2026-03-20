# TheBrandingStudio CRM — Product Requirements Document

**Versión**: 1.0
**Fecha**: Marzo 2026
**Estado**: En desarrollo activo

---

## 1. Visión del Producto

TheBrandingStudio CRM es una herramienta interna para una agencia de marketing que centraliza la gestión de prospectos, clientes, contenido, métricas y tareas en una sola plataforma. El objetivo es eliminar el uso de herramientas dispersas (hojas de cálculo, Notion, Drive, apps de terceros) y reemplazarlas con un sistema unificado, elegante y adaptado al flujo de trabajo real de la agencia.

### Principios de diseño

- **Dark & elegante**: Estética premium con crimson + ink. Framer Motion en todo.
- **Simple pero completo**: Sin over-engineering. Cada feature resuelve un problema real.
- **Admin-first, cliente-friendly**: El admin tiene control total; el cliente tiene visibilidad sin fricción.

---

## 2. Usuarios

### Admin (equipo interno)
- Gestiona prospectos, clientes, contenido y tareas
- Ve métricas de rendimiento de todas las plataformas
- Crea y aprueba planes de marketing
- Acceso completo a todo el sistema

### Cliente
- Ve su plan de marketing
- Aprueba o rechaza posts antes de publicar
- Consulta sus métricas de redes sociales
- Acceso limitado al portal `/portal` y `/aprobaciones`

---

## 3. Estado Actual del Producto

### 3.1 Módulos funcionales (producción-ready)

| Módulo | Ruta | Estado | Descripción |
|--------|------|--------|-------------|
| Login | `/login` | ✅ Completo | Auth JWT con redirect automático |
| Dashboard | `/` | ✅ Completo | KPIs, clientes activos, quick links |
| Prospectos | `/prospectos` | ✅ Completo | Kanban 6 stages, CRUD completo, integrado con backend |
| Clientes | `/clientes` | ✅ Completo | Grid + drawer, upload avatar, MRR chart |
| Aprobaciones | `/aprobaciones` | ✅ Completo | Vista admin/cliente, feedback, upload imágenes |
| Plan de Marketing | `/plan` | ✅ Completo | Timeline de hitos, KPIs con progreso, multi-step create |
| Portal Cliente | `/portal` | ✅ Completo | Plan + posts + métricas para el cliente |

### 3.2 Módulos parciales (frontend sin backend)

| Módulo | Ruta | Estado | Gap |
|--------|------|--------|-----|
| Ideas | `/ideas` | ⚠️ Parcial | Kanban solo local (Zustand), datos no persisten |
| To-Do Semanal | `/todo` | ⚠️ Parcial | Lista solo local (Zustand), datos no persisten |
| Métricas | `/metricas` | ⚠️ Parcial | OAuth skeleton, servicios sin implementar, datos mockeados |

### 3.3 Stack técnico actual

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19 + TypeScript + Vite |
| Estilos | Tailwind CSS v3 + clases custom |
| Animaciones | Framer Motion |
| Routing | React Router DOM v7 |
| Estado global | Zustand v5 + persist |
| HTTP | Axios (proxy Vite → :3001) |
| Iconos | Lucide React |
| Gráficas | Recharts |
| Drag & Drop | @dnd-kit |
| Backend | Express + TypeScript (tsx) |
| Base de datos | PostgreSQL (pg pool) |
| Auth | JWT 7 días + bcrypt |
| Archivos | Multer → `backend/uploads/` |

---

## 4. Roadmap

### Fase 1 — Completar MVP (Prioridad inmediata)

Objetivo: cerrar los gaps del estado actual para que el producto sea 100% funcional y todos los datos persistan en la base de datos.

#### F1-1: Integrar Ideas con backend
- Ideas se guardan en PostgreSQL (ya hay tabla `ideas`)
- CRUD real: crear, editar, mover columna kanban, eliminar
- Reemplazar `useStore` local por llamadas a `/api/ideas`
- Tags y emoji se guardan en DB

#### F1-2: Integrar To-Do con backend
- Todos se guardan en PostgreSQL (ya hay tabla `todos`)
- CRUD real: crear, editar, toggle done, eliminar
- Reemplazar `useStore` local por llamadas a `/api/todos`
- Filtro semanal (`week_of`) funciona con datos reales

#### F1-3: Implementar métricas reales (al menos LinkedIn)
- OAuth flow completo para LinkedIn (el más usado por la agencia)
- Guardar access/refresh tokens en `platform_connections`
- Pull real de: followers, impressions, engagement rate
- Worker cron cada 6h (ya mencionado, no implementado)
- Trigger manual POST `/api/metrics/sync`
- Meta (Facebook + Instagram) como segunda prioridad

#### F1-4: Activity feed real en Dashboard
- Reemplazar hardcode con datos reales
- Registrar eventos: nuevo prospecto, cliente actualizado, post aprobado, hito completado
- Tabla `activity_log` (id, type, actor, description, entity_type, entity_id, created_at)
- Últimas 10 actividades en el dashboard

#### F1-5: Gestión de usuarios (Admin Panel)
- Pantalla `/usuarios` solo para admin
- Crear usuarios (nombre, email, password, rol, cliente asignado)
- Activar/desactivar usuarios
- Reset de contraseña manual por admin
- Ver último login

---

### Fase 2 — Features de agencia (Nice-to-have)

Objetivo: agregar las features que diferencian este CRM de uno genérico y lo adaptan 100% al flujo de una agencia de marketing.

#### F2-1: Calendario de contenido
- Vista `/calendario` con grid mensual
- Posts del módulo de aprobaciones mapeados al calendario por `scheduled_date`
- Filtro por cliente
- Drag & drop para reprogramar
- Color coding por plataforma (LinkedIn azul, Instagram gradiente, Facebook, TikTok)
- Vista mensual y semanal

#### F2-2: Reportes exportables
- Botón "Exportar" en `/metricas` → genera PDF
- Reporte mensual por cliente: métricas + posts aprobados + hitos del plan
- Template con branding TBS (logo crimson)
- Librería: `react-pdf` o `puppeteer` en backend

#### F2-3: Probabilidad en pipeline de prospectos
- Campo `probability` (0-100%) por etapa del kanban
- Valor calculado de pipeline por status (presupuesto × probabilidad)
- Resumen en dashboard: "Pipeline estimado: $X"
- Gráfico de conversión por fuente (referido, LinkedIn, web, etc.)

#### F2-4: Conversión prospecto → cliente
- Botón "Convertir a cliente" en el kanban cuando status = "won"
- Pre-rellena formulario de nuevo cliente con datos del prospecto
- Registra en activity log

#### F2-5: Historial y notas de cliente
- Timeline de actividad por cliente en su drawer
- Agregar notas internas (no visibles al cliente)
- Registro automático: primer contacto, propuesta enviada, conversión, plan creado

#### F2-6: Notificaciones in-app
- Badge en el header con contador
- Tipos de notificación:
  - Post enviado para aprobación
  - Post aprobado/rechazado por cliente
  - Hito de plan próximo (3 días antes)
  - Prospecto sin actividad (> 7 días)
- Centro de notificaciones con historial
- Marcar como leídas

---

### Fase 3 — Escalabilidad y automatización (Futuro)

Objetivo: convertir el CRM en un sistema más autónomo que reduzca trabajo manual del equipo.

#### F3-1: Email notifications
- Integración con Resend o SendGrid
- Email al cliente cuando hay posts para aprobar
- Email al admin cuando cliente rechaza un post
- Email de resumen semanal de métricas para clientes

#### F3-2: Templates de contenido
- Biblioteca de plantillas de posts por industria/tipo
- Reutilizar estructura de posts anteriores
- Variables dinámicas: `{{cliente}}`, `{{fecha}}`, `{{producto}}`

#### F3-3: Multi-usuario admin
- Asignar tareas a miembros del equipo
- Ver workload por persona
- Comentarios y menciones en tareas

#### F3-4: Facturación básica
- Registro de MRR por cliente (ya existe el campo)
- Historial de pagos (fecha, monto, estado)
- Alertas de renovación / vencimiento de contrato
- No gateway de pago — solo tracking manual


#### F3-5: API pública para integraciones
- Webhook de salida: nuevo cliente, post aprobado, plan creado
- Integración básica con Zapier/Make
- API key por cliente para integraciones custom


### Fase 4: Almacenamineto de documentos
- Debe haber una seccion donde se podran almacenar documentos (pdfs, word, powerpoint e incluso bases de datos sql)
- Se debe poder añadir documentos y borrarlos 
- El tamaño visual de esta seccion debe de ser mediano, estilo carpeta de windows o finder
- Todo documento que se almacene aqui debe de ser guardado en la base de datos junto con su path y todas sus caracteristicas

---

## 5. Deuda técnica a resolver (transversal)

Estos issues no son features pero bloquean la estabilidad y deben resolverse durante la Fase 1:

### Base de datos
- [ ] Agregar `updated_at` a todas las tablas que no lo tienen
- [ ] Soft deletes (`deleted_at`) en lugar de DELETE duro — al menos en `clients` y `posts`
- [ ] Indexes en columnas de filtro frecuente (`client_id`, `status`, `week_of`)

### Seguridad
- [ ] Rate limiting en endpoints de auth (`express-rate-limit`)
- [ ] Refresh token endpoint (el JWT de 7 días no se puede revocar actualmente)
- [ ] Validación de inputs en backend (Zod o Joi)

### Frontend
- [ ] Eliminar `useStore.ts` local para Ideas y Todos una vez integrado con backend
- [ ] Manejo de errores consistente (toast de error cuando falla una API call)
- [ ] Loading states en todas las operaciones async

### Backend
- [ ] Error handler centralizado en Express
- [ ] Logs estructurados (al menos `morgan` para requests)
- [ ] Variables de entorno documentadas en `.env.example`

---

## 6. Métricas de éxito del producto

| Métrica | Target |
|---------|--------|
| Módulos con datos en DB | 8/8 (actualmente 6/8) |
| Tiempo de carga inicial | < 2 segundos |
| Cobertura OAuth plataformas | LinkedIn + Meta (Fase 1), TikTok + GA4 (Fase 2) |
| Features cliente-facing funcionales | 100% |
| Datos sincronizados sin acción manual | Métricas cada 6h via cron |

---

## 7. Fuera del alcance (no construir)

- App mobile nativa
- Chat en tiempo real entre admin y cliente
- Integración con CRMs externos (Hubspot, Salesforce)
- Publicación directa a redes sociales (solo gestión/aprobación)
- Sistema de contratos/firmas digitales
- Módulo de RRHH o nómina

---

## 8. Dependencias y riesgos

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| APIs OAuth cambian sus permisos (LinkedIn, Meta) | Alto | Usar OAuth 2.0 estándar, mantener tokens con refresh |
| Datos de Ideas/Todos perdidos en localStorage si el usuario limpia | Medio | Prioridad F1: integrar con backend |
| Cron de métricas no arranca si el servidor se reinicia | Medio | Inicializar cron en `server.ts` y agregar health check |
| Token JWT no revocable en 7 días | Bajo | Agregar refresh token + blacklist en Fase 1 |

---

*Documento generado en base al estado real del codebase — Marzo 2026.*
