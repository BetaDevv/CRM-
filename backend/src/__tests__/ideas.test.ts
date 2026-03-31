import { describe, it, expect, beforeEach, vi } from 'vitest'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { pool } from '../db'
import { app } from '../server'

const JWT_SECRET = process.env.JWT_SECRET!
const mockQuery = pool.query as ReturnType<typeof vi.fn>

function adminToken(overrides = {}) {
  return jwt.sign(
    { userId: 'admin-1', email: 'admin@tbs.com', role: 'admin', clientId: null, name: 'Admin', ...overrides },
    JWT_SECRET,
    { expiresIn: '1h' }
  )
}

function clientToken(overrides = {}) {
  return jwt.sign(
    { userId: 'client-1', email: 'client@tbs.com', role: 'client', clientId: 'c-100', name: 'Client', ...overrides },
    JWT_SECRET,
    { expiresIn: '1h' }
  )
}

describe('Ideas API', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('POST /api/ideas — Sharing logic', () => {
    it('admin creating idea with client_id should auto-share', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'idea-1', title: 'Campaign Idea', client_id: 'c-100', shared: 1,
          created_by: 'admin-1', status: 'brainstorm', tags: '[]',
        }],
      })

      const res = await request(app)
        .post('/api/ideas')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Campaign Idea', client_id: 'c-100' })

      expect(res.status).toBe(201)
      const params = mockQuery.mock.calls[0][1]
      expect(params[7]).toBe(1) // shared = 1 when admin assigns client_id
    })

    it('admin creating idea without client_id should NOT share', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'idea-2', title: 'Internal Idea', client_id: null, shared: 0,
          created_by: 'admin-1', status: 'brainstorm', tags: '[]',
        }],
      })

      const res = await request(app)
        .post('/api/ideas')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Internal Idea' })

      expect(res.status).toBe(201)
      const params = mockQuery.mock.calls[0][1]
      expect(params[7]).toBe(0) // shared = 0
    })

    it('client creating idea with shared=true should share with admin', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'idea-3', title: 'Client Idea', client_id: 'c-100', shared: 1,
          created_by: 'client-1', status: 'brainstorm', tags: '["marketing"]',
        }],
      })

      const res = await request(app)
        .post('/api/ideas')
        .set('Authorization', `Bearer ${clientToken()}`)
        .send({ title: 'Client Idea', shared: true, tags: ['marketing'] })

      expect(res.status).toBe(201)
      const params = mockQuery.mock.calls[0][1]
      expect(params[7]).toBe(1) // shared
      expect(params[6]).toBe('c-100') // client_id from token
    })

    it('should parse tags as JSON array in response', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'idea-4', title: 'Tagged', client_id: null, shared: 0,
          created_by: 'admin-1', status: 'brainstorm',
          tags: '["social","content"]',
        }],
      })

      const res = await request(app)
        .post('/api/ideas')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Tagged', tags: ['social', 'content'] })

      expect(res.status).toBe(201)
      expect(res.body.tags).toEqual(['social', 'content'])
    })
  })

  describe('DELETE /api/ideas/:id — Authorization', () => {
    it('admin can delete any idea (including client-created)', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }) // DELETE

      const res = await request(app)
        .delete('/api/ideas/idea-1')
        .set('Authorization', `Bearer ${adminToken()}`)

      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
    })

    it('client can delete their own idea', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ created_by: 'client-1' }],
      })
      mockQuery.mockResolvedValueOnce({ rows: [] })

      const res = await request(app)
        .delete('/api/ideas/idea-1')
        .set('Authorization', `Bearer ${clientToken()}`)

      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
    })

    it('client CANNOT delete admin-created ideas', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ created_by: 'admin-1' }],
      })

      const res = await request(app)
        .delete('/api/ideas/idea-1')
        .set('Authorization', `Bearer ${clientToken()}`)

      expect(res.status).toBe(403)
      expect(res.body.error).toContain('No podés eliminar')
    })

    it('client gets 404 when idea does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] })

      const res = await request(app)
        .delete('/api/ideas/nonexistent')
        .set('Authorization', `Bearer ${clientToken()}`)

      expect(res.status).toBe(404)
    })
  })

  describe('PUT /api/ideas/:id — Edit ownership', () => {
    it('admin can edit any idea', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ created_by: 'client-1' }], // client-created
      })
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'idea-1', title: 'Updated', status: 'review',
          tags: '[]', created_by: 'client-1',
        }],
      })

      const res = await request(app)
        .put('/api/ideas/idea-1')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Updated', status: 'review' })

      expect(res.status).toBe(200)
      expect(res.body.title).toBe('Updated')
    })

    it('client CANNOT edit ideas created by others', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ created_by: 'admin-1' }],
      })

      const res = await request(app)
        .put('/api/ideas/idea-1')
        .set('Authorization', `Bearer ${clientToken()}`)
        .send({ title: 'Attempted edit' })

      expect(res.status).toBe(403)
    })

    it('client CAN edit their own ideas', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ created_by: 'client-1' }],
      })
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'idea-1', title: 'My Updated Idea', status: 'brainstorm',
          tags: '[]', created_by: 'client-1',
        }],
      })

      const res = await request(app)
        .put('/api/ideas/idea-1')
        .set('Authorization', `Bearer ${clientToken()}`)
        .send({ title: 'My Updated Idea' })

      expect(res.status).toBe(200)
    })

    it('returns 404 for non-existent idea', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] })

      const res = await request(app)
        .put('/api/ideas/nonexistent')
        .set('Authorization', `Bearer ${clientToken()}`)
        .send({ title: 'Does not matter' })

      expect(res.status).toBe(404)
    })
  })

  describe('POST /api/ideas/:id/notes — Notes', () => {
    it('should reject empty content', async () => {
      const res = await request(app)
        .post('/api/ideas/idea-1/notes')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ content: '' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Contenido requerido')
    })

    it('should return 404 for non-existent idea', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] })

      const res = await request(app)
        .post('/api/ideas/nonexistent/notes')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ content: 'A note' })

      expect(res.status).toBe(404)
    })

    it('should create note successfully when idea exists', async () => {
      // Verify idea exists
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'idea-1', title: 'Test', created_by: 'admin-1', shared: 0, client_id: null }],
      })
      // INSERT note
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'note-1', item_type: 'idea', item_id: 'idea-1',
          author_id: 'admin-1', author_name: 'Admin', content: 'Great idea!',
        }],
      })

      const res = await request(app)
        .post('/api/ideas/idea-1/notes')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ content: 'Great idea!' })

      expect(res.status).toBe(201)
      expect(res.body.content).toBe('Great idea!')
    })
  })
})
