import { Router, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { pool } from '../db'
import { verifyToken, AuthRequest } from '../middleware/auth'
import { v4 as uuid } from 'uuid'
import { logActivity } from '../services/activityLogger'

const uploadDir = path.resolve(__dirname, '../../../uploads/documents')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const allowedExtensions = [
  '.pdf', '.doc', '.docx', '.ppt', '.pptx',
  '.xls', '.xlsx', '.sql', '.csv', '.txt', '.zip',
]

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `${uuid()}-${file.originalname}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowedExtensions.includes(ext)) cb(null, true)
    else cb(new Error(`Formato no soportado: ${ext}. Permitidos: ${allowedExtensions.join(', ')}`))
  },
})

const router = Router()
router.use(verifyToken)

// GET /api/documents — List all documents
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { client_id, category } = req.query
    let query = ''
    const params: any[] = []
    let paramIdx = 1

    if (req.user!.role === 'client') {
      // Client only sees their own documents
      query = `
        SELECT d.*, c.company as client_name,
               u_creator.name AS uploaded_by_name,
               u_creator.avatar AS uploaded_by_avatar
        FROM documents d
        LEFT JOIN clients c ON d.client_id = c.id
        LEFT JOIN users u_creator ON u_creator.id = d.uploaded_by
        WHERE d.client_id = $1
        ORDER BY d.created_at DESC
      `
      params.push(req.user!.clientId)
    } else {
      // Admin sees all, with optional filters
      const conditions: string[] = []

      if (client_id) {
        conditions.push(`d.client_id = $${paramIdx++}`)
        params.push(client_id)
      }
      if (category && category !== 'todos') {
        conditions.push(`d.category = $${paramIdx++}`)
        params.push(category)
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
      query = `
        SELECT d.*, c.company as client_name,
               u_creator.name AS uploaded_by_name,
               u_creator.avatar AS uploaded_by_avatar
        FROM documents d
        LEFT JOIN clients c ON d.client_id = c.id
        LEFT JOIN users u_creator ON u_creator.id = d.uploaded_by
        ${where}
        ORDER BY d.created_at DESC
      `
    }

    const { rows } = await pool.query(query, params)
    res.json(rows)
  } catch (err) {
    console.error('Error listing documents:', err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// POST /api/documents — Upload document(s)
router.post('/', upload.array('files', 20), async (req: AuthRequest, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[]
    if (!files || files.length === 0) {
      res.status(400).json({ error: 'No se enviaron archivos' })
      return
    }

    const { client_id, category, shared } = req.body
    const isClient = req.user!.role === 'client'

    // Client uploads: force client_id to their own, admin uploads: use provided client_id
    const effectiveClientId = isClient ? req.user!.clientId : (client_id || null)
    // Client: use body shared value (0 or 1), Admin: default to 1 (visible to client)
    const effectiveShared = isClient ? (parseInt(shared) || 0) : 1

    const docs: any[] = []

    for (const file of files) {
      const id = uuid()
      const docPath = `/uploads/documents/${file.filename}`

      const { rows } = await pool.query(
        `INSERT INTO documents (id, name, original_name, mime_type, size, path, client_id, uploaded_by, category, shared)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [id, file.filename, file.originalname, file.mimetype, file.size, docPath, effectiveClientId, req.user!.userId, category || 'general', effectiveShared]
      )

      docs.push(rows[0])

      logActivity({
        type: 'document_uploaded',
        actor: req.user!.userId,
        description: `Documento subido: ${file.originalname}`,
        entityType: 'document',
        entityId: id,
      })
    }

    res.status(201).json(docs)
  } catch (err) {
    console.error('Error uploading documents:', err)
    res.status(500).json({ error: 'Error al subir documentos' })
  }
})

// GET /api/documents/:id/download — Download/serve document
router.get('/:id/download', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { rows } = await pool.query('SELECT * FROM documents WHERE id = $1', [id])

    if (!rows.length) {
      res.status(404).json({ error: 'Documento no encontrado' })
      return
    }

    const doc = rows[0]

    // Client can only download their own documents
    if (req.user!.role === 'client' && doc.client_id !== req.user!.clientId) {
      res.status(403).json({ error: 'Sin acceso a este documento' })
      return
    }

    const filePath = path.resolve(uploadDir, doc.name)

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Archivo no encontrado en disco' })
      return
    }

    res.setHeader('Content-Type', doc.mime_type)
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.original_name)}"`)
    res.sendFile(filePath)
  } catch (err) {
    console.error('Error downloading document:', err)
    res.status(500).json({ error: 'Error al descargar documento' })
  }
})

// DELETE /api/documents/:id — Delete document (admin or own upload)
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { rows } = await pool.query('SELECT * FROM documents WHERE id = $1', [id])

    if (!rows.length) {
      res.status(404).json({ error: 'Documento no encontrado' })
      return
    }

    const doc = rows[0]

    // Clients can only delete their own uploads
    if (req.user!.role === 'client' && doc.uploaded_by !== req.user!.userId) {
      res.status(403).json({ error: 'Solo puedes eliminar documentos que subiste' })
      return
    }

    // Delete file from disk
    const filePath = path.resolve(uploadDir, doc.name)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }

    // Delete from DB
    await pool.query('DELETE FROM documents WHERE id = $1', [id])

    logActivity({
      type: 'document_deleted',
      actor: req.user!.userId,
      description: `Documento eliminado: ${doc.original_name}`,
      entityType: 'document',
      entityId: id,
    })

    res.json({ ok: true })
  } catch (err) {
    console.error('Error deleting document:', err)
    res.status(500).json({ error: 'Error al eliminar documento' })
  }
})

export default router
