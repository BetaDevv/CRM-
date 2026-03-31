// Todo statuses
export const TODO_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
} as const
export const VALID_TODO_STATUSES = Object.values(TODO_STATUS)

// Post statuses
export const POST_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  REVISION: 'revision',
} as const

// Idea statuses
export const IDEA_STATUS = {
  BRAINSTORM: 'brainstorm',
  DEVELOPING: 'developing',
  READY: 'ready',
  IMPLEMENTED: 'implemented',
} as const

// Priority levels
export const PRIORITY = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const

// Notification types
export const NOTIFICATION_TYPE = {
  TODO_COMPLETED: 'todo_completed',
  NOTE_ADDED: 'note_added',
  POST_FOR_APPROVAL: 'post_for_approval',
  POST_APPROVED: 'post_approved',
  POST_REJECTED: 'post_rejected',
  POST_REVISION: 'post_revision',
  EVENT_NOTE: 'event_note',
} as const

// Calendar event defaults
export const CALENDAR = {
  DEFAULT_TODO_COLOR: '#3B82F6',
} as const
