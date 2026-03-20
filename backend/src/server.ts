import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { pool, initDB, seedDB } from './db'
import { verifyToken, requireAdmin, AuthRequest } from './middleware/auth'
import { startMetricsWorker } from './workers/metrics.worker'
import { LinkedInService } from './services/linkedin.service'
import { MetaService } from './services/meta.service'
import { TikTokService } from './services/tiktok.service'
import { GA4Service } from './services/ga4.service'

import authRoutes    from './routes/auth'
import clientRoutes  from './routes/clients'
import prospectRoutes from './routes/prospects'
import todoRoutes    from './routes/todos'
import ideaRoutes    from './routes/ideas'
import postRoutes    from './routes/posts'
import planRoutes    from './routes/plans'
import metricRoutes  from './routes/metrics'
import reportRoutes  from './routes/reports'
import activityRoutes from './routes/activity'
import userRoutes     from './routes/users'
import notificationRoutes from './routes/notifications'
import calendarRoutes from './routes/calendar'

import { v4 as uuid } from 'uuid'

const app = express()
const PORT = parseInt(process.env.PORT || '3001', 10)
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

app.use(cors({
  origin: [FRONTEND_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

const uploadsDir = path.resolve(__dirname, '../../uploads')
app.use('/uploads', express.static(uploadsDir))

// ─── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes)
app.use('/api/clients',   clientRoutes)
app.use('/api/prospects', prospectRoutes)
app.use('/api/todos',     todoRoutes)
app.use('/api/ideas',     ideaRoutes)
app.use('/api/posts',     postRoutes)
app.use('/api/plans',     planRoutes)
app.use('/api/metrics',   metricRoutes)
app.use('/api/reports',   reportRoutes)
app.use('/api/activity',  activityRoutes)
app.use('/api/users',     userRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/calendar', calendarRoutes)

// ─── OAuth Initiation ──────────────────────────────────────────────────────────
// GET /api/oauth/:platform/connect/:clientId — redirige al proveedor OAuth
app.get('/api/oauth/:platform/connect/:clientId',
  (req, res, next) => verifyToken(req as AuthRequest, res, next),
  (req, res, next) => requireAdmin(req as AuthRequest, res, next),
  (req, res) => {
    const { platform, clientId } = req.params
    let url = ''
    switch (platform) {
      case 'linkedin': url = LinkedInService.getOAuthUrl(clientId); break
      case 'meta':     url = MetaService.getOAuthUrl(clientId);     break
      case 'tiktok':   url = TikTokService.getOAuthUrl(clientId);   break
      case 'ga4':      url = GA4Service.getOAuthUrl(clientId);      break
      default:         res.status(400).json({ error: 'Plataforma no soportada' }); return
    }
    res.redirect(url)
  }
)

// ─── OAuth Callbacks ───────────────────────────────────────────────────────────
// GET /api/oauth/:platform/callback — intercambia code por tokens y guarda en DB
app.get('/api/oauth/:platform/callback', async (req, res) => {
  const { platform } = req.params
  const { code, state: clientId, error, error_description } = req.query as Record<string, string>

  if (error) {
    res.redirect(`${FRONTEND_URL}/metricas?error=${encodeURIComponent(error_description || error)}`)
    return
  }
  if (!code || !clientId) {
    res.redirect(`${FRONTEND_URL}/metricas?error=missing_params`)
    return
  }

  try {
    let tokens: any

    switch (platform) {
      case 'linkedin': tokens = await LinkedInService.exchangeCode(code); break
      case 'meta':     tokens = await MetaService.exchangeCode(code);     break
      case 'tiktok':   tokens = await TikTokService.exchangeCode(code);   break
      case 'ga4':      tokens = await GA4Service.exchangeCode(code);      break
      default:
        res.redirect(`${FRONTEND_URL}/metricas?error=platform_not_supported`)
        return
    }

    // Guardar/actualizar conexión en DB
    await pool.query(
      `INSERT INTO platform_connections
         (id, client_id, platform, access_token, refresh_token, token_expires_at, platform_account_id, platform_account_name, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,1)
       ON CONFLICT (client_id, platform) DO UPDATE SET
         access_token         = EXCLUDED.access_token,
         refresh_token        = EXCLUDED.refresh_token,
         token_expires_at     = EXCLUDED.token_expires_at,
         platform_account_id  = EXCLUDED.platform_account_id,
         platform_account_name = EXCLUDED.platform_account_name,
         is_active            = 1`,
      [uuid(), clientId, platform, tokens.access_token, tokens.refresh_token, tokens.expires_at, tokens.account_id, tokens.account_name]
    )

    // Marcar cliente como conectado en LinkedIn si aplica
    if (platform === 'linkedin') {
      await pool.query('UPDATE clients SET linkedin_connected = 1 WHERE id = $1', [clientId])
    }

    res.redirect(`${FRONTEND_URL}/metricas?connected=${platform}&client=${clientId}`)
  } catch (err: any) {
    console.error(`OAuth callback error [${platform}]:`, err.message)
    res.redirect(`${FRONTEND_URL}/metricas?error=${encodeURIComponent('Error al conectar plataforma')}`)
  }
})

// ─── DELETE conexión de plataforma ────────────────────────────────────────────
app.delete('/api/oauth/:platform/disconnect/:clientId',
  (req, res, next) => verifyToken(req as AuthRequest, res, next),
  (req, res, next) => requireAdmin(req as AuthRequest, res, next),
  async (req, res) => {
    const { platform, clientId } = req.params
    try {
      await pool.query(
        'DELETE FROM platform_connections WHERE client_id = $1 AND platform = $2',
        [clientId, platform]
      )
      if (platform === 'linkedin') {
        await pool.query('UPDATE clients SET linkedin_connected = 0 WHERE id = $1', [clientId])
      }
      res.json({ ok: true })
    } catch {
      res.status(500).json({ error: 'Error interno del servidor' })
    }
  }
)

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ ok: true, db: 'postgresql', time: new Date().toISOString() })
  } catch {
    res.status(503).json({ ok: false, db: 'disconnected' })
  }
})

async function start() {
  await initDB()
  await seedDB()
  startMetricsWorker()
  app.listen(PORT, () => {
    console.log(`\n🚀 TBS CRM Backend → http://localhost:${PORT}`)
    console.log(`📊 DB: PostgreSQL`)
    console.log(`📁 Uploads: ${uploadsDir}\n`)
  })
}

start().catch(err => {
  console.error('Error iniciando servidor:', err)
  process.exit(1)
})
