import { Router, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { pool } from '../db'
import { verifyToken, requireAdmin, AuthRequest } from '../middleware/auth'
import { v4 as uuid } from 'uuid'
import { logActivity } from '../services/activityLogger'
import { notifyClient, notifyAdmins } from '../services/notificationService'
import { sendPostForApproval, sendPostStatusNotification } from '../services/emailService'
import { POST_STATUS, NOTIFICATION_TYPE } from '../constants'

const uploadDir = path.resolve(__dirname, '../../../uploads')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `${uuid()}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4']
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowed.includes(ext)) cb(null, true)
    else cb(new Error('Formato no soportado'))
  },
})

const router = Router()
router.use(verifyToken)

function parsePost(p: any) {
  return { ...p, media_urls: JSON.parse(p.media_urls || '[]') }
}

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    if (req.user!.role === 'client') {
      const { rows } = await pool.query(
        `SELECT p.*, u_creator.name AS created_by_name, u_creator.avatar AS created_by_avatar
         FROM posts p
         LEFT JOIN users u_creator ON u_creator.id = p.created_by
         WHERE p.client_id = $1
         ORDER BY p.created_at DESC`,
        [req.user!.clientId]
      )
      res.json(rows.map(parsePost))
    } else {
      const { rows } = await pool.query(
        `SELECT p.*, u_creator.name AS created_by_name, u_creator.avatar AS created_by_avatar
         FROM posts p
         LEFT JOIN users u_creator ON u_creator.id = p.created_by
         ORDER BY p.created_at DESC`
      )
      res.json(rows.map(parsePost))
    }
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.post('/', requireAdmin, upload.array('images', 4), async (req: AuthRequest, res: Response) => {
  try {
    const { client_id, title, content, platform, scheduled_date, type } = req.body
    const files = (req.files as Express.Multer.File[]) || []
    const mediaUrls = files.map(f => `/uploads/${f.filename}`)
    const id = uuid()
    const { rows } = await pool.query(
      `INSERT INTO posts (id, client_id, title, content, platform, scheduled_date, status, media_urls, type, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [id, client_id, title, content || null, platform || 'linkedin', scheduled_date || null, POST_STATUS.PENDING, JSON.stringify(mediaUrls), type || 'post', req.user!.userId]
    )
    logActivity({ type: 'post_created', description: `Nuevo post creado: ${title}`, entityType: 'post', entityId: id })
    notifyClient(client_id, { type: 'post_pending', title: 'Post pendiente de aprobación', description: `Tienes un nuevo post para revisar: ${title}`, entityType: 'post', entityId: id })

    // Email notification to client (fire and forget)
    pool.query('SELECT u.email, u.name FROM users u WHERE u.client_id = $1 AND u.role = $2', [client_id, 'client'])
      .then(({ rows: userRows }) => {
        if (userRows.length) {
          sendPostForApproval({
            to: userRows[0].email,
            clientName: userRows[0].name,
            postTitle: title,
            platform: platform || 'linkedin',
            scheduledDate: scheduled_date || '',
          }).catch(err => console.error('[Email] Error sending post approval email:', err))
        }
      })
      .catch(err => console.error('[Email] Error querying client user:', err))

    res.status(201).json(parsePost(rows[0]))
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.patch('/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const { status, feedback } = req.body
    const { rows: cur } = await pool.query('SELECT * FROM posts WHERE id = $1', [req.params.id])
    if (!cur.length) { res.status(404).json({ error: 'Post no encontrado' }); return }
    const post = cur[0]

    if (req.user!.role === 'client' && post.client_id !== req.user!.clientId) {
      res.status(403).json({ error: 'Sin acceso' }); return
    }
    const validPostStatuses = Object.values(POST_STATUS)
    if (!validPostStatuses.includes(status)) { res.status(400).json({ error: 'Status inválido' }); return }

    const { rows } = await pool.query(
      'UPDATE posts SET status=$1, feedback=$2 WHERE id=$3 RETURNING *',
      [status, feedback || post.feedback, req.params.id]
    )
    logActivity({ type: `post_${status}`, description: `Post ${status}: ${post.title}`, entityType: 'post', entityId: req.params.id })

    // Notify on approval/rejection/revision
    if (status === POST_STATUS.APPROVED || status === POST_STATUS.REJECTED || status === POST_STATUS.REVISION) {
      const { rows: clientRows } = await pool.query('SELECT company FROM clients WHERE id = $1', [post.client_id])
      const clientName = clientRows[0]?.company || 'Cliente'

      if (status === POST_STATUS.APPROVED || status === POST_STATUS.REJECTED) {
        const notifType = status === POST_STATUS.APPROVED ? NOTIFICATION_TYPE.POST_APPROVED : NOTIFICATION_TYPE.POST_REJECTED
        const notifTitle = status === POST_STATUS.APPROVED ? 'Post aprobado' : 'Post rechazado'
        const notifDesc = `${clientName} ${status === POST_STATUS.APPROVED ? 'aprobó' : 'rechazó'} el post: ${post.title}`
        notifyAdmins({ type: notifType, title: notifTitle, description: notifDesc, entityType: 'post', entityId: req.params.id })
      }

      // Email notification to all admins (fire and forget)
      pool.query("SELECT email FROM users WHERE role = 'admin'")
        .then(({ rows: adminRows }) => {
          for (const admin of adminRows) {
            sendPostStatusNotification({
              to: admin.email,
              postTitle: post.title,
              platform: post.platform || 'linkedin',
              status: status as 'approved' | 'rejected' | 'revision',
              clientName,
              feedback: feedback || undefined,
            }).catch(err => console.error('[Email] Error sending status notification:', err))
          }
        })
        .catch(err => console.error('[Email] Error querying admin users:', err))
    }

    res.json(parsePost(rows[0]))
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.put('/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { rows: cur } = await pool.query('SELECT * FROM posts WHERE id = $1', [id])
    if (!cur.length) { res.status(404).json({ error: 'Post no encontrado' }); return }

    const post = cur[0]
    const title = req.body.title ?? post.title
    const content = req.body.content ?? post.content
    const platform = req.body.platform ?? post.platform
    const scheduled_date = req.body.scheduled_date ?? post.scheduled_date
    const status = req.body.status ?? post.status
    const type = req.body.type ?? post.type

    const { rows } = await pool.query(
      `UPDATE posts SET title=$1, content=$2, platform=$3, scheduled_date=$4, status=$5, type=$6 WHERE id=$7 RETURNING *`,
      [title, content, platform, scheduled_date, status, type, id]
    )
    logActivity({ type: 'post_updated', description: `Post actualizado: ${title}`, entityType: 'post', entityId: id })
    res.json(parsePost(rows[0]))
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.delete('/:id', requireAdmin, async (req, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT media_urls FROM posts WHERE id = $1', [req.params.id])
    if (rows.length) {
      const urls: string[] = JSON.parse(rows[0].media_urls || '[]')
      urls.forEach(u => {
        const fp = path.join(uploadDir, path.basename(u))
        if (fs.existsSync(fp)) fs.unlinkSync(fp)
      })
    }
    await pool.query('DELETE FROM posts WHERE id = $1', [req.params.id])
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
