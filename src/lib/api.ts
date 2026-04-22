import axios from 'axios'
import type { Idea, TodoItem, Post } from '../types'

export const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('tbs_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('tbs_token')
      localStorage.removeItem('tbs_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// --- Ideas API ---

function mapIdea(raw: any): Idea {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description ?? '',
    status: raw.status,
    tags: raw.tags ?? [],
    clientId: raw.client_id ?? undefined,
    createdAt: raw.created_at ?? raw.createdAt ?? '',
    emoji: raw.emoji ?? undefined,
    shared: Boolean(raw.shared),
    createdBy: raw.created_by ?? undefined,
    createdByName: raw.created_by_name ?? null,
    createdByAvatar: raw.created_by_avatar ?? null,

    notesCount: raw.notes_count ?? 0,
  }
}

export async function getIdeas(): Promise<Idea[]> {
  const { data } = await api.get('/ideas')
  return data.map(mapIdea)
}

export async function createIdea(idea: Omit<Idea, 'id'>): Promise<Idea> {
  const { data } = await api.post('/ideas', {
    title: idea.title,
    description: idea.description,
    status: idea.status,
    tags: idea.tags,
    emoji: idea.emoji,
    client_id: idea.clientId,
    shared: idea.shared ? 1 : 0,
  })
  return mapIdea(data)
}

export async function updateIdea(id: string, idea: Partial<Idea>): Promise<Idea> {
  const { data } = await api.put(`/ideas/${id}`, {
    title: idea.title,
    description: idea.description,
    status: idea.status,
    tags: idea.tags,
    emoji: idea.emoji,
    shared: idea.shared ? 1 : 0,
  })
  return mapIdea(data)
}

export async function deleteIdea(id: string): Promise<void> {
  await api.delete(`/ideas/${id}`)
}

// --- Todos API ---

/** Convert a DB timestamp (ISO/UTC) to a `datetime-local` input value in the browser's timezone */
function toDatetimeLocal(val: string | null | undefined): string | undefined {
  if (!val) return undefined
  try {
    const d = new Date(val)
    if (isNaN(d.getTime())) return undefined
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return undefined
  }
}

/** Convert a naive `datetime-local` string (YYYY-MM-DDTHH:MM) to a full ISO string with timezone offset */
function localToISO(val: string | undefined): string | undefined {
  if (!val) return undefined
  try {
    const d = new Date(val)
    if (isNaN(d.getTime())) return undefined
    return d.toISOString()
  } catch {
    return undefined
  }
}

function mapTodo(raw: any): TodoItem {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description ?? '',
    priority: raw.priority,
    done: Boolean(raw.done),
    clientId: raw.client_id ?? raw.clientId ?? undefined,
    weekOf: raw.week_of ?? raw.weekOf ?? '',
    category: raw.category ?? '',
    shared: Boolean(raw.shared),
    createdBy: raw.created_by ?? undefined,
    createdByName: raw.created_by_name ?? null,
    createdByAvatar: raw.created_by_avatar ?? null,
    status: raw.status ?? (raw.done ? 'done' : 'pending'),
    startTime: toDatetimeLocal(raw.start_time ?? raw.startTime),
    endTime: toDatetimeLocal(raw.end_time ?? raw.endTime),
    assignedTo: raw.assigned_to ?? raw.assignedTo ?? undefined,

    notesCount: raw.notes_count ?? 0,
  }
}

export async function getTodos(): Promise<TodoItem[]> {
  const { data } = await api.get('/todos')
  return data.map(mapTodo)
}

export async function createTodo(todo: Omit<TodoItem, 'id'>): Promise<TodoItem> {
  const { data } = await api.post('/todos', {
    title: todo.title,
    description: todo.description,
    priority: todo.priority,
    category: todo.category,
    client_id: todo.clientId,
    week_of: todo.weekOf,
    shared: todo.shared ? 1 : 0,
    start_time: localToISO(todo.startTime),
    end_time: localToISO(todo.endTime),
    status: todo.status,
    assigned_to: todo.assignedTo,
  })
  return mapTodo(data)
}

export async function updateTodo(id: string, todo: Partial<TodoItem>): Promise<TodoItem> {
  const { data } = await api.put(`/todos/${id}`, {
    title: todo.title,
    description: todo.description,
    priority: todo.priority,
    category: todo.category,
    client_id: todo.clientId,
    done: todo.done,
    shared: todo.shared ? 1 : 0,
    start_time: localToISO(todo.startTime),
    end_time: localToISO(todo.endTime),
    status: todo.status,
    assigned_to: todo.assignedTo,
  })
  return mapTodo(data)
}

export async function toggleTodo(id: string): Promise<TodoItem> {
  const { data } = await api.patch(`/todos/${id}/toggle`)
  return mapTodo(data)
}

export async function updateTodoStatus(id: string, status: 'pending' | 'in_progress' | 'done'): Promise<TodoItem> {
  const { data } = await api.patch(`/todos/${id}/status`, { status });
  return mapTodo(data);
}

export async function deleteTodo(id: string): Promise<void> {
  await api.delete(`/todos/${id}`)
}

// --- Item Notes API ---

export interface ItemNote {
  id: string
  item_type: string
  item_id: string
  author_id: string
  author_name: string
  content: string
  created_at: string
}

export async function getTodoNotes(todoId: string): Promise<ItemNote[]> {
  const { data } = await api.get(`/todos/${todoId}/notes`)
  return data
}

export async function addTodoNoteMsg(todoId: string, content: string): Promise<ItemNote> {
  const { data } = await api.post(`/todos/${todoId}/notes`, { content })
  return data
}

export async function markTodoNotesRead(todoId: string): Promise<void> {
  await api.patch(`/todos/${todoId}/notes/read`)
}

export async function editTodoNote(todoId: string, noteId: string, content: string): Promise<ItemNote> {
  const { data } = await api.patch(`/todos/${todoId}/notes/${noteId}`, { content })
  return data
}

export async function deleteTodoNote(todoId: string, noteId: string): Promise<void> {
  await api.delete(`/todos/${todoId}/notes/${noteId}`)
}

export interface TodoAttachment {
  id: string
  todo_id: string
  filename: string
  original_name: string
  mime_type: string
  size: number
  url: string
  created_at?: string
}

export async function getTodoAttachments(todoId: string): Promise<TodoAttachment[]> {
  const { data } = await api.get(`/todos/${todoId}/attachments`)
  return data
}

export async function uploadTodoAttachments(todoId: string, files: File[]): Promise<TodoAttachment[]> {
  const fd = new FormData()
  files.forEach(f => fd.append('files', f))
  const { data } = await api.post(`/todos/${todoId}/attachments`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function deleteTodoAttachment(todoId: string, attachmentId: string): Promise<void> {
  await api.delete(`/todos/${todoId}/attachments/${attachmentId}`)
}

export async function getIdeaNotes(ideaId: string): Promise<ItemNote[]> {
  const { data } = await api.get(`/ideas/${ideaId}/notes`)
  return data
}

export async function addIdeaNoteMsg(ideaId: string, content: string): Promise<ItemNote> {
  const { data } = await api.post(`/ideas/${ideaId}/notes`, { content })
  return data
}

export async function markIdeaNotesRead(ideaId: string): Promise<void> {
  await api.patch(`/ideas/${ideaId}/notes/read`)
}

export async function editIdeaNote(ideaId: string, noteId: string, content: string): Promise<ItemNote> {
  const { data } = await api.patch(`/ideas/${ideaId}/notes/${noteId}`, { content })
  return data
}

export async function deleteIdeaNote(ideaId: string, noteId: string): Promise<void> {
  await api.delete(`/ideas/${ideaId}/notes/${noteId}`)
}

// --- Posts API ---

function mapPost(raw: any): Post {
  return {
    id: raw.id,
    clientId: raw.client_id ?? raw.clientId,
    title: raw.title,
    content: raw.content ?? '',
    platform: raw.platform,
    scheduledDate: raw.scheduled_date ?? raw.scheduledDate ?? '',
    status: raw.status,
    mediaUrl: raw.media_url ?? raw.mediaUrl,
    createdAt: raw.created_at ?? raw.createdAt ?? '',
    feedback: raw.feedback ?? undefined,
    createdByName: raw.created_by_name ?? null,
    createdByAvatar: raw.created_by_avatar ?? null,
  }
}

export async function getPosts(): Promise<Post[]> {
  const { data } = await api.get('/posts')
  return data.map(mapPost)
}

export async function updatePostDate(id: string, scheduledDate: string): Promise<Post> {
  const { data } = await api.put(`/posts/${id}`, { scheduled_date: scheduledDate })
  return mapPost(data)
}

export async function deletePost(id: string): Promise<void> {
  await api.delete(`/posts/${id}`)
}

// --- Prospects API ---

export async function convertProspect(id: string): Promise<any> {
  const { data } = await api.post(`/prospects/${id}/convert`)
  return data
}

// --- Activity API ---

export interface ActivityLog {
  id: string
  type: string
  actor: string | null
  description: string
  entity_type: string | null
  entity_id: string | null
  created_at: string
}

export async function getActivity(limit = 10): Promise<ActivityLog[]> {
  const { data } = await api.get(`/activity?limit=${limit}`)
  return data
}

// --- Client Notes & Activity API ---

export interface ClientNote {
  id: string
  client_id: string
  content: string
  author: string | null
  created_at: string
}

export async function getClientNotes(clientId: string): Promise<ClientNote[]> {
  const { data } = await api.get(`/clients/${clientId}/notes`)
  return data
}

export async function addClientNote(clientId: string, content: string): Promise<ClientNote> {
  const { data } = await api.post(`/clients/${clientId}/notes`, { content })
  return data
}

export async function deleteClientNote(clientId: string, noteId: string): Promise<void> {
  await api.delete(`/clients/${clientId}/notes/${noteId}`)
}

export async function getClientActivity(clientId: string): Promise<ActivityLog[]> {
  const { data } = await api.get(`/clients/${clientId}/activity`)
  return data
}

// --- Users API ---

export interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'client'
  clientId: string | null
  avatar: string | null
  active: boolean
  createdAt: string
  lastLogin: string | null
}

function mapUser(raw: any): User {
  return {
    id: raw.id,
    email: raw.email,
    name: raw.name,
    role: raw.role,
    clientId: raw.client_id ?? null,
    avatar: raw.avatar ?? null,
    active: Boolean(raw.active),
    createdAt: raw.created_at ?? raw.createdAt ?? '',
    lastLogin: raw.last_login ?? raw.lastLogin ?? null,
  }
}

export async function getUsers(): Promise<User[]> {
  const { data } = await api.get('/users')
  return data.map(mapUser)
}

export async function createUser(userData: { name: string; email: string; password: string; role: string; client_id?: string }): Promise<User> {
  const { data } = await api.post('/users', userData)
  return mapUser(data)
}

export async function updateUser(id: string, userData: Partial<User>): Promise<User> {
  const { data } = await api.put(`/users/${id}`, {
    name: userData.name,
    email: userData.email,
    role: userData.role,
    client_id: userData.clientId,
    active: userData.active,
  })
  return mapUser(data)
}

export async function toggleUserActive(id: string): Promise<User> {
  const { data } = await api.patch(`/users/${id}/toggle-active`)
  return mapUser(data)
}

export async function resetUserPassword(id: string, newPassword: string): Promise<void> {
  await api.patch(`/users/${id}/reset-password`, { new_password: newPassword })
}

export async function deleteUser(id: string): Promise<void> {
  await api.delete(`/users/${id}`)
}

// --- Calendar Events API ---

export interface CalendarEvent {
  id: string
  title: string
  description: string | null
  startTime: string
  endTime: string
  allDay: boolean
  color: string | null
  creatorId: string
  clientId: string | null
  todoId: string | null
  milestoneId: string | null
  googleEventId: string | null
  microsoftEventId: string | null
  isShared: boolean
  clientNote: string | null
  milestone: { title: string; category: string; date: string } | null
  participants: { id: string; status: string; name: string; email: string }[]
  createdByName?: string | null
  createdByAvatar?: string | null
}

function mapCalendarEvent(raw: any): CalendarEvent {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description ?? null,
    startTime: raw.start_time ?? raw.startTime,
    endTime: raw.end_time ?? raw.endTime,
    allDay: Boolean(raw.all_day ?? raw.allDay),
    color: raw.color ?? null,
    creatorId: raw.creator_id ?? raw.creatorId,
    clientId: raw.client_id ?? raw.clientId ?? null,
    todoId: raw.todo_id ?? raw.todoId ?? null,
    milestoneId: raw.milestone_id ?? raw.milestoneId ?? null,
    googleEventId: raw.google_event_id ?? raw.googleEventId ?? null,
    microsoftEventId: raw.microsoft_event_id ?? raw.microsoftEventId ?? null,
    isShared: Boolean(raw.is_shared ?? raw.isShared),
    clientNote: raw.client_note ?? raw.clientNote ?? null,
    milestone: raw.milestone ?? null,
    participants: raw.participants ?? [],
    createdByName: raw.created_by_name ?? null,
    createdByAvatar: raw.created_by_avatar ?? null,
  }
}

export async function getCalendarEvents(start: string, end: string): Promise<CalendarEvent[]> {
  const { data } = await api.get('/calendar/events', { params: { start, end } })
  return data.map(mapCalendarEvent)
}

export async function createCalendarEvent(eventData: any): Promise<CalendarEvent> {
  const { data } = await api.post('/calendar/events', {
    title: eventData.title,
    description: eventData.description,
    start_time: localToISO(eventData.startTime),
    end_time: localToISO(eventData.endTime),
    all_day: eventData.allDay,
    color: eventData.color,
    client_id: eventData.clientId,
    todo_id: eventData.todoId,
    milestone_id: eventData.milestoneId,
    is_shared: eventData.isShared,
    participants: eventData.participantIds,
  })
  return mapCalendarEvent(data)
}

export async function updateCalendarEvent(id: string, eventData: any): Promise<CalendarEvent> {
  const { data } = await api.put(`/calendar/events/${id}`, {
    title: eventData.title,
    description: eventData.description,
    start_time: localToISO(eventData.startTime),
    end_time: localToISO(eventData.endTime),
    all_day: eventData.allDay,
    color: eventData.color,
    client_id: eventData.clientId,
    todo_id: eventData.todoId,
    milestone_id: eventData.milestoneId,
    is_shared: eventData.isShared,
  })
  return mapCalendarEvent(data)
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  await api.delete(`/calendar/events/${id}`)
}

export async function addClientNoteToEvent(eventId: string, note: string): Promise<CalendarEvent> {
  const { data } = await api.patch(`/calendar/events/${eventId}/client-note`, { note })
  return mapCalendarEvent(data)
}

export async function addEventParticipants(eventId: string, userIds: string[]): Promise<void> {
  await api.post(`/calendar/events/${eventId}/participants`, { participants: userIds })
}

export async function removeEventParticipant(eventId: string, userId: string): Promise<void> {
  await api.delete(`/calendar/events/${eventId}/participants/${userId}`)
}

export interface CalendarUser {
  id: string
  name: string
  email: string
  role: string
}

export async function getCalendarUsers(): Promise<CalendarUser[]> {
  const { data } = await api.get('/calendar/users')
  return data
}

export async function getGoogleCalendarStatus(): Promise<{ connected: boolean; email?: string }> {
  const { data } = await api.get('/calendar/google/status')
  return data
}

export async function connectGoogleCalendar(): Promise<string> {
  const { data } = await api.get('/calendar/google/connect')
  return data.url
}

export async function disconnectGoogleCalendar(): Promise<void> {
  await api.delete('/calendar/google/disconnect')
}

export async function syncGoogleCalendar(): Promise<void> {
  await api.post('/calendar/google/sync')
}

// Microsoft Calendar
export async function getMicrosoftCalendarStatus(): Promise<{ connected: boolean }> {
  const { data } = await api.get('/calendar/microsoft/status')
  return data
}

export async function connectMicrosoftCalendar(): Promise<string> {
  const { data } = await api.get('/calendar/microsoft/connect')
  return data.url
}

export async function disconnectMicrosoftCalendar(): Promise<void> {
  await api.delete('/calendar/microsoft/disconnect')
}

export async function syncMicrosoftCalendar(): Promise<void> {
  await api.post('/calendar/microsoft/sync')
}

// --- Templates API ---

export interface PostTemplate {
  id: string
  title: string
  content: string
  platform: string
  category: string
  industry: string | null
  tags: string[]
  variables: string[]
  created_at: string
}

export async function getTemplates(filters?: { platform?: string; category?: string }): Promise<PostTemplate[]> {
  const params: Record<string, string> = {}
  if (filters?.platform) params.platform = filters.platform
  if (filters?.category) params.category = filters.category
  const { data } = await api.get('/templates', { params })
  return data
}

export async function createTemplate(templateData: Partial<PostTemplate>): Promise<PostTemplate> {
  const { data } = await api.post('/templates', templateData)
  return data
}

export async function updateTemplate(id: string, templateData: Partial<PostTemplate>): Promise<PostTemplate> {
  const { data } = await api.put(`/templates/${id}`, templateData)
  return data
}

export async function deleteTemplate(id: string): Promise<void> {
  await api.delete(`/templates/${id}`)
}

export async function useTemplate(id: string, variables: Record<string, string>): Promise<{ content: string; title: string; platform: string }> {
  const { data } = await api.post(`/templates/${id}/use`, { variables })
  return data
}

// --- Documents API ---

export interface Document {
  id: string
  name: string
  originalName: string
  mimeType: string
  size: number
  path: string
  clientId: string | null
  uploadedBy: string
  category: string
  createdAt: string
  clientName: string | null
  shared: boolean
  uploadedByName?: string | null
  uploadedByAvatar?: string | null
}

function mapDocument(raw: any): Document {
  return {
    id: raw.id,
    name: raw.name,
    originalName: raw.original_name ?? raw.originalName,
    mimeType: raw.mime_type ?? raw.mimeType,
    size: raw.size,
    path: raw.path,
    clientId: raw.client_id ?? raw.clientId ?? null,
    uploadedBy: raw.uploaded_by ?? raw.uploadedBy,
    category: raw.category ?? 'general',
    createdAt: raw.created_at ?? raw.createdAt ?? '',
    clientName: raw.client_name ?? raw.clientName ?? null,
    shared: Boolean(raw.shared),
    uploadedByName: raw.uploaded_by_name ?? null,
    uploadedByAvatar: raw.uploaded_by_avatar ?? null,
  }
}

export async function getDocuments(clientId?: string, category?: string): Promise<Document[]> {
  const params: Record<string, string> = {}
  if (clientId) params.client_id = clientId
  if (category) params.category = category
  const { data } = await api.get('/documents', { params })
  return data.map(mapDocument)
}

export async function uploadDocuments(files: File[], clientId?: string, category?: string, shared?: boolean): Promise<Document[]> {
  const formData = new FormData()
  files.forEach(f => formData.append('files', f))
  if (clientId) formData.append('client_id', clientId)
  if (category) formData.append('category', category)
  if (shared !== undefined) formData.append('shared', shared ? '1' : '0')
  const { data } = await api.post('/documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  })
  return data.map(mapDocument)
}

export async function deleteDocument(id: string): Promise<void> {
  await api.delete(`/documents/${id}`)
}

export function getDocumentDownloadUrl(id: string): string {
  return `/api/documents/${id}/download`
}

// --- Milestones API ---

export interface Milestone {
  id: string
  planId: string
  title: string
  description: string | null
  date: string | null
  completed: boolean
  category: string
  planTitle: string
  clientName: string
}

export async function getMilestones(): Promise<Milestone[]> {
  const { data } = await api.get('/plans/milestones/all')
  return data.map((m: any) => ({
    id: m.id,
    planId: m.plan_id,
    title: m.title,
    description: m.description,
    date: m.date,
    completed: Boolean(m.completed),
    category: m.category,
    planTitle: m.plan_title,
    clientName: m.client_name,
  }))
}

// --- Notifications API ---

export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  description: string | null
  entity_type: string | null
  entity_id: string | null
  is_read: number
  created_at: string
}

export async function getNotifications(): Promise<Notification[]> {
  const { data } = await api.get('/notifications')
  return data
}

export async function getUnreadCount(): Promise<number> {
  const { data } = await api.get('/notifications/unread')
  return data.count
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.patch(`/notifications/${id}/read`)
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.patch('/notifications/read-all')
}

// --- API Keys ---

export interface ApiKey {
  id: string
  key: string
  name: string
  user_id: string
  role: 'admin' | 'client'
  client_id: string | null
  scopes: string
  is_active: number
  last_used_at: string | null
  created_at: string
  user_name?: string
  user_email?: string
  client_name?: string
  full_key?: string
}

export async function getApiKeys(): Promise<ApiKey[]> {
  const { data } = await api.get('/api-keys')
  return data
}

export async function createApiKey(payload: {
  name: string
  user_id: string
  role: string
  client_id?: string
  scopes?: string
}): Promise<ApiKey> {
  const { data } = await api.post('/api-keys', payload)
  return data
}

export async function toggleApiKey(id: string): Promise<ApiKey> {
  const { data } = await api.patch(`/api-keys/${id}/toggle`)
  return data
}

export async function deleteApiKey(id: string): Promise<void> {
  await api.delete(`/api-keys/${id}`)
}

// --- Client Settings API ---

export interface MyClientSettings {
  accent_color: string               // RESOLVED: user override -> client default -> crimson fallback
  user_accent_color: string | null   // raw per-user override
  client_accent_color: string | null // raw client default
  avatar_url: string | null
  company: string
}

export async function getMyClientSettings(): Promise<MyClientSettings> {
  const { data } = await api.get('/clients/me/settings')
  return data
}

/** admin-only: sets the client-wide default color (affects every user of that client) */
export async function updateClientAccent(clientId: string, accent_color: string): Promise<void> {
  await api.patch(`/clients/${clientId}/accent`, { accent_color })
}

export interface MyAccentResponse {
  accent_color: string               // RESOLVED
  user_accent_color: string | null   // raw user override
  client_accent_color: string | null // raw client default
}

/** Per-user accent override. Pass `null` or empty to clear the override and fall back to the client default. */
export async function updateMyAccentColor(color: string | null): Promise<MyAccentResponse> {
  const { data } = await api.patch('/users/me/accent-color', { color })
  return data
}

// --- Profile API ---

export async function getMyProfile() {
  const { data } = await api.get('/users/me')
  return data
}

export async function updateMyProfile(name: string) {
  const { data } = await api.put('/users/me', { name })
  return data
}

export async function uploadProfilePhoto(file: File) {
  const form = new FormData()
  form.append('photo', file)
  const { data } = await api.post('/users/me/photo', form)
  return data
}
