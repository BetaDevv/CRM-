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
  })
  return mapIdea(data)
}

export async function deleteIdea(id: string): Promise<void> {
  await api.delete(`/ideas/${id}`)
}

// --- Todos API ---

function mapTodo(raw: any): TodoItem {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description ?? '',
    priority: raw.priority,
    done: Boolean(raw.done),
    dueDate: raw.due_date ?? raw.dueDate ?? undefined,
    clientId: raw.client_id ?? raw.clientId ?? undefined,
    weekOf: raw.week_of ?? raw.weekOf ?? '',
    category: raw.category ?? '',
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
    due_date: todo.dueDate,
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
    due_date: todo.dueDate,
  })
  return mapTodo(data)
}

export async function toggleTodo(id: string): Promise<TodoItem> {
  const { data } = await api.patch(`/todos/${id}/toggle`)
  return mapTodo(data)
}

export async function deleteTodo(id: string): Promise<void> {
  await api.delete(`/todos/${id}`)
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
  isShared: boolean
  participants: { id: string; status: string; name: string; email: string }[]
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
    isShared: Boolean(raw.is_shared ?? raw.isShared),
    participants: raw.participants ?? [],
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
    start_time: eventData.startTime,
    end_time: eventData.endTime,
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
    start_time: eventData.startTime,
    end_time: eventData.endTime,
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
