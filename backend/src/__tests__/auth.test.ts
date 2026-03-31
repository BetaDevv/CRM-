import { describe, it, expect, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'
import express from 'express'
import request from 'supertest'
import { verifyToken, requireAdmin, signToken, AuthRequest } from '../middleware/auth'

const JWT_SECRET = process.env.JWT_SECRET!

// Minimal Express app with auth middleware for testing
function createTestApp() {
  const app = express()
  app.use(express.json())

  // Protected route
  app.get('/protected', verifyToken, (req: AuthRequest, res) => {
    res.json({ user: req.user })
  })

  // Admin-only route
  app.get('/admin-only', verifyToken, requireAdmin, (req: AuthRequest, res) => {
    res.json({ user: req.user })
  })

  return app
}

describe('Auth Middleware', () => {
  let app: express.Express

  beforeEach(() => {
    app = createTestApp()
  })

  describe('verifyToken', () => {
    it('should reject requests without Authorization header', async () => {
      const res = await request(app).get('/protected')
      expect(res.status).toBe(401)
      expect(res.body.error).toBe('Token requerido')
    })

    it('should reject requests with malformed Authorization header', async () => {
      const res = await request(app)
        .get('/protected')
        .set('Authorization', 'NotBearer some-token')
      expect(res.status).toBe(401)
      expect(res.body.error).toBe('Token requerido')
    })

    it('should reject requests with invalid JWT', async () => {
      const res = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer invalid.jwt.token')
      expect(res.status).toBe(401)
      expect(res.body.error).toBe('Token inválido o expirado')
    })

    it('should reject expired tokens', async () => {
      const token = jwt.sign(
        { userId: '1', email: 'test@test.com', role: 'admin', clientId: null, name: 'Test' },
        JWT_SECRET,
        { expiresIn: '0s' }
      )
      // Small delay to ensure token is expired
      await new Promise(r => setTimeout(r, 10))
      const res = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(401)
    })

    it('should pass with a valid JWT and attach user to request', async () => {
      const payload = { userId: 'user-1', email: 'admin@test.com', role: 'admin' as const, clientId: null, name: 'Admin' }
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' })
      const res = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.user.userId).toBe('user-1')
      expect(res.body.user.email).toBe('admin@test.com')
      expect(res.body.user.role).toBe('admin')
    })
  })

  describe('requireAdmin', () => {
    it('should block client users from admin routes', async () => {
      const token = jwt.sign(
        { userId: 'client-1', email: 'client@test.com', role: 'client', clientId: 'c-1', name: 'Client' },
        JWT_SECRET,
        { expiresIn: '1h' }
      )
      const res = await request(app)
        .get('/admin-only')
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(403)
      expect(res.body.error).toBe('Acceso solo para administradores')
    })

    it('should allow admin users through', async () => {
      const token = jwt.sign(
        { userId: 'admin-1', email: 'admin@test.com', role: 'admin', clientId: null, name: 'Admin' },
        JWT_SECRET,
        { expiresIn: '1h' }
      )
      const res = await request(app)
        .get('/admin-only')
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.user.role).toBe('admin')
    })
  })

  describe('signToken', () => {
    it('should generate a valid JWT that can be verified', () => {
      const payload = { userId: 'u-1', email: 'a@b.com', role: 'admin' as const, clientId: null, name: 'Test' }
      const token = signToken(payload)
      const decoded = jwt.verify(token, JWT_SECRET) as any
      expect(decoded.userId).toBe('u-1')
      expect(decoded.email).toBe('a@b.com')
      expect(decoded.role).toBe('admin')
    })

    it('should set 7-day expiration', () => {
      const payload = { userId: 'u-1', email: 'a@b.com', role: 'admin' as const, clientId: null, name: 'Test' }
      const token = signToken(payload)
      const decoded = jwt.verify(token, JWT_SECRET) as any
      // exp - iat should be approximately 7 days (604800 seconds)
      const diff = decoded.exp - decoded.iat
      expect(diff).toBe(604800)
    })
  })
})
