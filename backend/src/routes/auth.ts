import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { pool } from '../db'
import { signToken, verifyToken, AuthRequest } from '../middleware/auth'

const router = Router()

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      res.status(400).json({ error: 'Email y contraseña requeridos' }); return
    }
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email])
    const user = rows[0]
    if (!user) { res.status(401).json({ error: 'Credenciales incorrectas' }); return }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) { res.status(401).json({ error: 'Credenciales incorrectas' }); return }

    if (user.active === 0) { res.status(403).json({ error: 'Usuario desactivado' }); return }

    // Update last_login
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id])

    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role as 'admin' | 'client',
      clientId: user.client_id,
      name: user.name,
    }
    res.json({ token: signToken(payload), user: { id: user.id, email: user.email, role: user.role, name: user.name, clientId: user.client_id, profile_photo: user.profile_photo || null, language: user.language || null } })
  } catch {
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.get('/me', verifyToken, (req: AuthRequest, res: Response) => {
  res.json({ user: req.user })
})

export default router
