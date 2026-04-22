export type ProspectStatus = 'new' | 'contacted' | 'proposal' | 'negotiation' | 'won' | 'lost'
export type ClientStatus = 'active' | 'paused' | 'completed'
export type Priority = 'low' | 'medium' | 'high'
export type PostStatus = 'pending' | 'approved' | 'rejected' | 'revision'
export type IdeaStatus = 'brainstorm' | 'developing' | 'ready' | 'implemented'

export interface Prospect {
  id: string
  company: string
  contact: string
  email: string
  phone?: string
  industry: string
  budget?: string
  status: ProspectStatus
  notes?: string
  createdAt: string
  avatar?: string
  source: string
  probability?: number
}

export interface Client {
  id: string
  company: string
  contact: string
  email: string
  phone?: string
  industry: string
  monthlyFee: number
  monthly_fee?: number
  services: string[]
  status: ClientStatus
  startDate: string
  start_date?: string
  avatar?: string
  avatar_url?: string
  color: string
  currency?: string
  accent_color?: string
  description?: string
  linkedin_connected?: boolean
}

export interface TodoItem {
  id: string
  title: string
  description?: string
  priority: Priority
  done: boolean
  clientId?: string
  weekOf: string
  category: string
  shared?: boolean
  createdBy?: string
  createdByName?: string | null
  createdByAvatar?: string | null
  status: 'pending' | 'in_progress' | 'done'
  startTime?: string
  endTime?: string
  assignedTo?: string

  notesCount?: number
}

export interface Idea {
  id: string
  title: string
  description: string
  status: IdeaStatus
  tags: string[]
  clientId?: string
  createdAt: string
  emoji?: string
  shared?: boolean
  createdBy?: string
  createdByName?: string | null
  createdByAvatar?: string | null

  notesCount?: number
}

export interface Post {
  id: string
  clientId: string
  title: string
  content: string
  platform: 'linkedin' | 'instagram' | 'facebook' | 'twitter'
  scheduledDate: string
  status: PostStatus
  mediaUrl?: string
  createdAt: string
  feedback?: string
  createdByName?: string | null
  createdByAvatar?: string | null
}

export interface MarketingMilestone {
  id: string
  title: string
  description: string
  date: string
  completed: boolean
  category: 'content' | 'ads' | 'seo' | 'analytics' | 'design' | 'strategy'
  color?: string
}

export interface MarketingPlan {
  id: string
  clientId: string
  title: string
  objective: string
  startDate: string
  endDate: string
  milestones: MarketingMilestone[]
  kpis: { label: string; target: string; current?: string }[]
}
