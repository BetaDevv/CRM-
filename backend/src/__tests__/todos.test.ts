import { describe, it, expect, beforeEach, vi } from 'vitest'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { pool } from '../db'
import { app } from '../server'
import { CalendarEventService } from '../services/calendarEventService'
import { notifyTodoCompleted, notifyNoteAdded } from '../services/notificationService'

const JWT_SECRET = process.env.JWT_SECRET!
const mockQuery = pool.query as ReturnType<typeof vi.fn>
const mockCreateFromTodo = CalendarEventService.createFromTodo as ReturnType<typeof vi.fn>
const mockNotifyTodoCompleted = notifyTodoCompleted as ReturnType<typeof vi.fn>
const mockNotifyNoteAdded = notifyNoteAdded as ReturnType<typeof vi.fn>

function adminToken(overrides = {}) {
  return jwt.sign(
    { userId: 'admin-1', email: 'admin@tbs.com', role: 'admin', clientId: null, name: 'Admin', ...overrides },
    JWT_SECRET,
    { expiresIn: '1h' }
  )
}

function clientToken(overrides = {}) {
  return jwt.sign(
    { userId: 'client-1', email: 'client@tbs.com', role: 'client', clientId: 'c-100', name: 'Client User', ...overrides },
    JWT_SECRET,
    { expiresIn: '1h' }
  )
}

describe('Todos API', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('POST /api/todos — Sharing logic', () => {
    it('admin creating todo with client_id should auto-set shared=1', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'todo-1', title: 'Test', client_id: 'c-100', shared: 1,
          created_by: 'admin-1', status: 'pending', done: 0,
        }],
      })

      const res = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Test', client_id: 'c-100' })

      expect(res.status).toBe(201)
      // Verify the INSERT query used shared=1
      const insertCall = mockQuery.mock.calls[0]
      const params = insertCall[1]
      // params[7] is the shared value (8th parameter)
      expect(params[7]).toBe(1)
    })

    it('admin creating todo WITHOUT client_id should set shared=0', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'todo-2', title: 'Internal', client_id: null, shared: 0,
          created_by: 'admin-1', status: 'pending', done: 0,
        }],
      })

      const res = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Internal' })

      expect(res.status).toBe(201)
      const params = mockQuery.mock.calls[0][1]
      expect(params[7]).toBe(0) // shared = 0
    })

    it('client creating todo with shared=true should set shared=1', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'todo-3', title: 'Client Task', client_id: 'c-100', shared: 1,
          created_by: 'client-1', status: 'pending', done: 0,
        }],
      })

      const res = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${clientToken()}`)
        .send({ title: 'Client Task', shared: true })

      expect(res.status).toBe(201)
      const params = mockQuery.mock.calls[0][1]
      expect(params[7]).toBe(1) // shared = 1
      expect(params[5]).toBe('c-100') // client_id comes from token
    })

    it('client creating todo with shared=false should set shared=0', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'todo-4', title: 'Private Task', client_id: 'c-100', shared: 0,
          created_by: 'client-1', status: 'pending', done: 0,
        }],
      })

      const res = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${clientToken()}`)
        .send({ title: 'Private Task', shared: false })

      expect(res.status).toBe(201)
      const params = mockQuery.mock.calls[0][1]
      expect(params[7]).toBe(0)
    })
  })

  describe('POST /api/todos — Calendar event auto-creation', () => {
    it('should create a linked calendar event when start_time and end_time are provided', async () => {
      // INSERT todo
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'todo-cal', title: 'Meeting', client_id: null, shared: 0,
          created_by: 'admin-1', status: 'pending', done: 0,
        }],
      })

      const res = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({
          title: 'Meeting',
          start_time: '2026-04-01T10:00:00Z',
          end_time: '2026-04-01T11:00:00Z',
        })

      expect(res.status).toBe(201)
      // Only 1 DB query (INSERT todo); calendar event delegated to CalendarEventService
      expect(mockQuery).toHaveBeenCalledTimes(1)
      expect(mockCreateFromTodo).toHaveBeenCalledTimes(1)
      expect(mockCreateFromTodo).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Meeting',
        startTime: '2026-04-01T10:00:00Z',
        endTime: '2026-04-01T11:00:00Z',
      }))
    })

    it('should NOT create calendar event when no time range provided', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'todo-no-cal', title: 'Simple task', status: 'pending',
          created_by: 'admin-1', done: 0,
        }],
      })

      await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Simple task' })

      // Only the INSERT todo query, no event creation
      expect(mockQuery).toHaveBeenCalledTimes(1)
      expect(mockCreateFromTodo).not.toHaveBeenCalled()
    })
  })

  describe('PATCH /api/todos/:id/status — Status transitions', () => {
    it('should reject invalid status values', async () => {
      const res = await request(app)
        .patch('/api/todos/todo-1/status')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ status: 'invalid_status' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Invalid status')
    })

    it('should accept valid status "pending"', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'todo-1', status: 'pending', done: 0, title: 'Test', client_id: null }],
      })

      const res = await request(app)
        .patch('/api/todos/todo-1/status')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ status: 'pending' })

      expect(res.status).toBe(200)
      const updateParams = mockQuery.mock.calls[0][1]
      expect(updateParams[0]).toBe('pending') // status
      expect(updateParams[1]).toBe(0) // done = 0
    })

    it('should accept valid status "in_progress"', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'todo-1', status: 'in_progress', done: 0, title: 'Test', client_id: null }],
      })

      const res = await request(app)
        .patch('/api/todos/todo-1/status')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ status: 'in_progress' })

      expect(res.status).toBe(200)
      const updateParams = mockQuery.mock.calls[0][1]
      expect(updateParams[0]).toBe('in_progress')
      expect(updateParams[1]).toBe(0) // done = 0
    })

    it('should set done=1 when status is "done"', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'todo-1', status: 'done', done: 1, title: 'Test', client_id: null }],
      })

      const res = await request(app)
        .patch('/api/todos/todo-1/status')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ status: 'done' })

      expect(res.status).toBe(200)
      const updateParams = mockQuery.mock.calls[0][1]
      expect(updateParams[0]).toBe('done')
      expect(updateParams[1]).toBe(1) // done = 1 when status is done
    })
  })

  describe('DELETE /api/todos/:id — Authorization', () => {
    it('admin can delete any todo without ownership check', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }) // DELETE query

      const res = await request(app)
        .delete('/api/todos/todo-1')
        .set('Authorization', `Bearer ${adminToken()}`)

      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
    })

    it('client can delete their own todo', async () => {
      // SELECT ownership check
      mockQuery.mockResolvedValueOnce({
        rows: [{ created_by: 'client-1' }],
      })
      // DELETE
      mockQuery.mockResolvedValueOnce({ rows: [] })

      const res = await request(app)
        .delete('/api/todos/todo-1')
        .set('Authorization', `Bearer ${clientToken()}`)

      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
    })

    it('client CANNOT delete a todo created by someone else', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ created_by: 'admin-1' }], // Created by admin
      })

      const res = await request(app)
        .delete('/api/todos/todo-1')
        .set('Authorization', `Bearer ${clientToken()}`)

      expect(res.status).toBe(403)
      expect(res.body.error).toContain('No podés eliminar')
    })

    it('client gets 404 when todo does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }) // Empty result

      const res = await request(app)
        .delete('/api/todos/nonexistent')
        .set('Authorization', `Bearer ${clientToken()}`)

      expect(res.status).toBe(404)
    })
  })

  describe('PATCH /api/todos/:id/toggle', () => {
    it('should toggle done from 0 to 1 and status to done', async () => {
      // SELECT current state
      mockQuery.mockResolvedValueOnce({
        rows: [{ done: 0, title: 'My Task' }],
      })
      // UPDATE
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'todo-1', done: 1, status: 'done', title: 'My Task', client_id: null }],
      })

      const res = await request(app)
        .patch('/api/todos/todo-1/toggle')
        .set('Authorization', `Bearer ${adminToken()}`)

      expect(res.status).toBe(200)
      const updateParams = mockQuery.mock.calls[1][1]
      expect(updateParams[0]).toBe(1) // newDone
      expect(updateParams[1]).toBe('done') // newStatus
    })

    it('should toggle done from 1 to 0 and status to pending', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ done: 1, title: 'My Task' }],
      })
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'todo-1', done: 0, status: 'pending', title: 'My Task', client_id: null }],
      })

      const res = await request(app)
        .patch('/api/todos/todo-1/toggle')
        .set('Authorization', `Bearer ${adminToken()}`)

      expect(res.status).toBe(200)
      const updateParams = mockQuery.mock.calls[1][1]
      expect(updateParams[0]).toBe(0) // newDone
      expect(updateParams[1]).toBe('pending') // newStatus
    })

    it('should return 404 if todo not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] })

      const res = await request(app)
        .patch('/api/todos/nonexistent/toggle')
        .set('Authorization', `Bearer ${adminToken()}`)

      expect(res.status).toBe(404)
    })
  })

  describe('POST /api/todos/:id/notes — Notes validation', () => {
    it('should reject empty content', async () => {
      const res = await request(app)
        .post('/api/todos/todo-1/notes')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ content: '' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Contenido requerido')
    })

    it('should reject whitespace-only content', async () => {
      const res = await request(app)
        .post('/api/todos/todo-1/notes')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ content: '   ' })

      expect(res.status).toBe(400)
    })

    it('should return 404 if todo does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }) // todo not found

      const res = await request(app)
        .post('/api/todos/nonexistent/notes')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ content: 'Hello' })

      expect(res.status).toBe(404)
    })
  })
})
