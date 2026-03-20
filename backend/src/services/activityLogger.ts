import { pool } from '../db'
import { v4 as uuid } from 'uuid'

export async function logActivity(params: {
  type: string
  actor?: string
  description: string
  entityType?: string
  entityId?: string
}) {
  const id = uuid()
  try {
    await pool.query(
      'INSERT INTO activity_log (id, type, actor, description, entity_type, entity_id) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, params.type, params.actor || null, params.description, params.entityType || null, params.entityId || null]
    )
  } catch (err) {
    console.error('Error logging activity:', err)
  }
}
