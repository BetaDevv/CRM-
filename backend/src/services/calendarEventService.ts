import { pool } from '../db'
import { v4 as uuid } from 'uuid'
import { CALENDAR } from '../constants'

export const CalendarEventService = {
  async createFromTodo(params: {
    title: string
    description?: string
    startTime: string
    endTime: string
    creatorId: string
    clientId?: string | null
    todoId: string
  }) {
    const eventId = uuid()
    await pool.query(
      `INSERT INTO events (id, title, description, start_time, end_time, color, creator_id, client_id, todo_id, is_shared, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
      [eventId, params.title, params.description || null, params.startTime, params.endTime, CALENDAR.DEFAULT_TODO_COLOR, params.creatorId, params.clientId || null, params.todoId, params.clientId ? true : false]
    )
    return eventId
  },

  async updateFromTodo(params: {
    todoId: string
    title: string
    description?: string
    startTime: string
    endTime: string
    clientId?: string | null
  }) {
    await pool.query(
      `UPDATE events SET title=$1, description=$2, start_time=$3, end_time=$4, client_id=$5, is_shared=$6, updated_at=NOW() WHERE todo_id=$7`,
      [params.title, params.description || null, params.startTime, params.endTime, params.clientId || null, params.clientId ? true : false, params.todoId]
    )
  },
}
