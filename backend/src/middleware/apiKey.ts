import { Request, Response, NextFunction } from 'express'
import { pool } from '../db'

export interface ApiKeyPayload {
  id: string
  userId: string
  role: 'admin' | 'client'
  clientId: string | null
  scopes: string
}

export interface ApiKeyRequest extends Request {
  apiKey?: ApiKeyPayload
}

export async function verifyApiKey(req: ApiKeyRequest, res: Response, next: NextFunction): Promise<void> {
  const key = req.headers['x-api-key'] as string
  if (!key) {
    res.status(401).json({ error: 'API key required' })
    return
  }

  try {
    const { rows } = await pool.query(
      'SELECT * FROM api_keys WHERE key = $1 AND is_active = 1',
      [key]
    )

    if (!rows.length) {
      res.status(401).json({ error: 'Invalid API key' })
      return
    }

    const row = rows[0]

    // Update last_used_at in background
    pool.query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [row.id]).catch(() => {})

    req.apiKey = {
      id: row.id,
      userId: row.user_id,
      role: row.role,
      clientId: row.client_id,
      scopes: row.scopes,
    }

    next()
  } catch {
    res.status(500).json({ error: 'Error validating API key' })
  }
}

export function requireAdminKey(req: ApiKeyRequest, res: Response, next: NextFunction): void {
  if (req.apiKey?.role !== 'admin') {
    res.status(403).json({ error: 'Admin API key required' })
    return
  }
  next()
}
