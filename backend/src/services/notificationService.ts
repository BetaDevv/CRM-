import { pool } from '../db'
import { v4 as uuid } from 'uuid'

export async function createNotification(params: {
  userId: string
  type: string
  title: string
  description: string
  entityType?: string
  entityId?: string
}) {
  const id = uuid()
  try {
    await pool.query(
      `INSERT INTO notifications (id, user_id, type, title, description, entity_type, entity_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, params.userId, params.type, params.title, params.description, params.entityType || null, params.entityId || null]
    )
  } catch (err) {
    console.error('Error creating notification:', err)
  }
}

export async function notifyAdmins(params: {
  type: string
  title: string
  description: string
  entityType?: string
  entityId?: string
}) {
  try {
    const { rows } = await pool.query("SELECT id FROM users WHERE role = 'admin' AND active = 1")
    for (const user of rows) {
      await createNotification({ userId: user.id, ...params })
    }
  } catch (err) {
    console.error('Error notifying admins:', err)
  }
}

export async function notifyClient(clientId: string, params: {
  type: string
  title: string
  description: string
  entityType?: string
  entityId?: string
}) {
  try {
    const { rows } = await pool.query(
      "SELECT id FROM users WHERE client_id = $1 AND active = 1",
      [clientId]
    )
    for (const user of rows) {
      await createNotification({ userId: user.id, ...params })
    }
  } catch (err) {
    console.error('Error notifying client:', err)
  }
}
