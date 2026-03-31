import { vi } from 'vitest'

// Set required env vars BEFORE any imports that depend on them
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret-key-for-vitest'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db'
process.env.SMTP_HOST = 'localhost'
process.env.SMTP_PORT = '587'
process.env.SMTP_USER = 'test@test.com'
process.env.SMTP_PASS = 'test'

// Mock the database pool globally
vi.mock('../db', () => ({
  pool: {
    query: vi.fn(),
  },
  initDB: vi.fn(),
  seedDB: vi.fn(),
}))

// Mock email service
vi.mock('../services/emailService', () => ({
  sendNoteNotification: vi.fn(),
  sendTodoCompletedNotification: vi.fn(),
  sendPostApprovalNotification: vi.fn(),
  sendInviteEmail: vi.fn(),
  sendWeeklyMetricsEmail: vi.fn(),
}))

// Mock notification service
vi.mock('../services/notificationService', () => ({
  createNotification: vi.fn(),
  notifyAdmins: vi.fn(),
  notifyClient: vi.fn(),
  notifyTodoCompleted: vi.fn(),
  notifyNoteAdded: vi.fn(),
}))

// Mock calendar event service
vi.mock('../services/calendarEventService', () => ({
  CalendarEventService: {
    createFromTodo: vi.fn(),
    updateFromTodo: vi.fn(),
  },
}))

// Mock activity logger
vi.mock('../services/activityLogger', () => ({
  logActivity: vi.fn(),
}))

// Mock metrics worker
vi.mock('../workers/metrics.worker', () => ({
  startMetricsWorker: vi.fn(),
}))

// Mock OAuth services
vi.mock('../services/linkedin.service', () => ({
  LinkedInService: { getOAuthUrl: vi.fn(), exchangeCode: vi.fn() },
}))
vi.mock('../services/meta.service', () => ({
  MetaService: { getOAuthUrl: vi.fn(), exchangeCode: vi.fn() },
}))
vi.mock('../services/tiktok.service', () => ({
  TikTokService: { getOAuthUrl: vi.fn(), exchangeCode: vi.fn() },
}))
vi.mock('../services/ga4.service', () => ({
  GA4Service: { getOAuthUrl: vi.fn(), exchangeCode: vi.fn() },
}))
