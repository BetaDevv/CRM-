import { pool } from '../db'
import { v4 as uuid } from 'uuid'
import { sendTodoCompletedNotification, sendNoteNotification, CLIENT_EMAILS_ENABLED } from './emailService'
import { NOTIFICATION_TYPE } from '../constants'

type I18nParams = Record<string, string | number | null | undefined>

function serializeParams(params?: I18nParams): string | null {
  if (!params) return null
  try { return JSON.stringify(params) } catch { return null }
}

export async function createNotification(params: {
  userId: string
  type: string
  title: string
  description: string
  entityType?: string
  entityId?: string
  i18nKey?: string
  i18nParams?: I18nParams
}) {
  const id = uuid()
  try {
    await pool.query(
      `INSERT INTO notifications (id, user_id, type, title, description, entity_type, entity_id, i18n_key, i18n_params)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        id,
        params.userId,
        params.type,
        params.title,
        params.description,
        params.entityType || null,
        params.entityId || null,
        params.i18nKey || null,
        serializeParams(params.i18nParams),
      ]
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
  i18nKey?: string
  i18nParams?: I18nParams
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
  i18nKey?: string
  i18nParams?: I18nParams
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

/**
 * Notify client users when a todo is completed (DB notification + email).
 */
export async function notifyTodoCompleted(todo: { id: string; title: string; client_id: string }) {
  try {
    const clientUsers = await pool.query(
      'SELECT id, email, name FROM users WHERE client_id = $1 AND active = 1',
      [todo.client_id]
    )
    const i18nParams = serializeParams({ title: todo.title })
    for (const u of clientUsers.rows) {
      await pool.query(
        `INSERT INTO notifications (id, user_id, type, title, description, entity_type, entity_id, i18n_key, i18n_params)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          uuid(),
          u.id,
          NOTIFICATION_TYPE.TODO_COMPLETED,
          'Tarea completada',
          `La tarea "${todo.title}" ha sido marcada como completada`,
          'todo',
          todo.id,
          'notifications.body.todoCompleted',
          i18nParams,
        ]
      )
      if (CLIENT_EMAILS_ENABLED) {
        sendTodoCompletedNotification({ to: u.email, clientName: u.name, todoTitle: todo.title })
      }
    }
  } catch (err) {
    console.error('Error sending todo completion notification:', err)
  }
}

/**
 * Notify the other party when a note is added to a todo or idea (DB notification + email).
 */
export async function notifyNoteAdded(params: {
  itemType: 'todo' | 'idea'
  itemId: string
  item: { created_by: string | null; shared: number; client_id: string | null; title: string }
  authorUserId: string
  authorName: string
  content: string
}) {
  const { itemType, itemId, item, authorUserId, authorName, content } = params
  const trimmedContent = content.trim()
  const emailItemType = itemType === 'todo' ? 'tarea' : 'idea'
  const preview = trimmedContent.substring(0, 100)
  const itemTypeKey = `notifications.itemType.${itemType}` // 'notifications.itemType.todo' | 'notifications.itemType.idea'

  try {
    // Case 1: Item has a creator and it's not the note author -> notify the creator
    if (item.created_by && item.created_by !== authorUserId) {
      const i18nParams = serializeParams({ itemTypeKey, authorName, preview })
      await pool.query(
        `INSERT INTO notifications (id, user_id, type, title, description, entity_type, entity_id, i18n_key, i18n_params)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          uuid(),
          item.created_by,
          NOTIFICATION_TYPE.NOTE_ADDED,
          `Nueva nota en tu ${emailItemType}`,
          `${authorName}: ${preview}`,
          itemType,
          itemId,
          'notifications.body.noteAddedOnOwn',
          i18nParams,
        ]
      )
      const { rows: ownerRows } = await pool.query('SELECT email, name FROM users WHERE id = $1', [item.created_by])
      if (ownerRows.length) {
        if (CLIENT_EMAILS_ENABLED) {
          sendNoteNotification({
            to: ownerRows[0].email,
            recipientName: ownerRows[0].name,
            senderName: authorName,
            itemType: emailItemType,
            itemTitle: item.title,
            note: trimmedContent,
          })
        }
      }
    // Case 2: Item is shared and has a client_id -> notify admin (client wrote the note)
    } else if (item.shared && item.client_id) {
      const { rows: adminRows } = await pool.query("SELECT id, email, name FROM users WHERE role = 'admin' LIMIT 1")
      if (adminRows.length) {
        const i18nParams = serializeParams({ itemTypeKey, authorName, preview })
        await pool.query(
          `INSERT INTO notifications (id, user_id, type, title, description, entity_type, entity_id, i18n_key, i18n_params)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            uuid(),
            adminRows[0].id,
            NOTIFICATION_TYPE.NOTE_ADDED,
            `Nueva nota en ${emailItemType} compartida`,
            `${authorName}: ${preview}`,
            itemType,
            itemId,
            'notifications.body.noteAddedOnShared',
            i18nParams,
          ]
        )
        sendNoteNotification({
          to: adminRows[0].email,
          recipientName: adminRows[0].name,
          senderName: authorName,
          itemType: emailItemType,
          itemTitle: item.title,
          note: trimmedContent,
        })
      }
    }
  } catch (err) {
    console.error('Error sending note notification:', err)
  }
}
