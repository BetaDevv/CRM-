import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Prospect, Client, TodoItem, Idea, Post, MarketingPlan } from '../types'
import { api } from '../lib/api'

interface CRMState {
  prospects: Prospect[]
  clients: Client[]
  todos: TodoItem[]
  ideas: Idea[]
  posts: Post[]
  marketingPlans: MarketingPlan[]
  sidebarCollapsed: boolean

  // Hydrate from API
  fetchClients: () => Promise<void>

  // Prospects
  addProspect: (p: Prospect) => void
  updateProspect: (id: string, data: Partial<Prospect>) => void
  deleteProspect: (id: string) => void

  // Clients
  addClient: (c: Client) => void
  updateClient: (id: string, data: Partial<Client>) => void
  deleteClient: (id: string) => void

  // Todos
  addTodo: (t: TodoItem) => void
  updateTodo: (id: string, data: Partial<TodoItem>) => void
  deleteTodo: (id: string) => void
  toggleTodo: (id: string) => void

  // Ideas
  addIdea: (i: Idea) => void
  updateIdea: (id: string, data: Partial<Idea>) => void
  deleteIdea: (id: string) => void

  // Posts
  addPost: (p: Post) => void
  updatePost: (id: string, data: Partial<Post>) => void
  deletePost: (id: string) => void

  // Marketing Plans
  addPlan: (p: MarketingPlan) => void
  updatePlan: (id: string, data: Partial<MarketingPlan>) => void

  // UI
  toggleSidebar: () => void
}

const sampleClients: Client[] = [
  {
    id: 'c1',
    company: 'TechNova Solutions',
    contact: 'Alejandro Ruiz',
    email: 'alejandro@technova.com',
    phone: '+57 300 123 4567',
    industry: 'Tecnología',
    monthlyFee: 2500,
    services: ['Social Media', 'SEO', 'Pauta Digital'],
    status: 'active',
    startDate: '2024-01-15',
    color: '#DC143C',
    description: 'Empresa líder en soluciones cloud para PYMES',
  },
  {
    id: 'c2',
    company: 'Bloom Wellness',
    contact: 'Valentina Torres',
    email: 'valen@bloomwellness.co',
    industry: 'Salud & Bienestar',
    monthlyFee: 1800,
    services: ['Contenido', 'Instagram', 'Email Marketing'],
    status: 'active',
    startDate: '2024-03-01',
    color: '#7C3AED',
    description: 'Centro de bienestar holístico premium',
  },
  {
    id: 'c3',
    company: 'Urban Bites',
    contact: 'Sebastián Mora',
    email: 'sebas@urbanbites.co',
    industry: 'Gastronomía',
    monthlyFee: 1200,
    services: ['Social Media', 'Fotografía'],
    status: 'active',
    startDate: '2024-06-10',
    color: '#F59E0B',
    description: 'Restaurante urbano con cocina fusión',
  },
]

const sampleProspects: Prospect[] = [
  {
    id: 'p1',
    company: 'Nexus Inmobiliaria',
    contact: 'Carlos Mendoza',
    email: 'cmendoza@nexus.com',
    industry: 'Inmobiliaria',
    budget: '$3,000/mes',
    status: 'proposal',
    source: 'Referido',
    createdAt: '2025-02-20',
    probability: 40,
  },
  {
    id: 'p2',
    company: 'PetLove Store',
    contact: 'María Fernández',
    email: 'maria@petlove.co',
    industry: 'Retail',
    budget: '$800/mes',
    status: 'contacted',
    source: 'Instagram',
    createdAt: '2025-03-01',
    probability: 20,
  },
  {
    id: 'p3',
    company: 'Fintech Verde',
    contact: 'Diego Castillo',
    email: 'diego@fintechverde.io',
    industry: 'Fintech',
    budget: '$4,000/mes',
    status: 'negotiation',
    source: 'LinkedIn',
    createdAt: '2025-02-10',
    probability: 70,
  },
  {
    id: 'p4',
    company: 'Moda Élite',
    contact: 'Sofía Ramírez',
    email: 'sofia@modaelite.co',
    industry: 'Moda',
    budget: '$1,500/mes',
    status: 'new',
    source: 'Web',
    createdAt: '2025-03-05',
    probability: 10,
  },
]

const sampleTodos: TodoItem[] = [
  {
    id: 't1',
    title: 'Crear calendario de contenido TechNova — Abril',
    priority: 'high',
    done: false,
    status: 'pending',
    category: 'Contenido',
    weekOf: '2025-03-03',
    clientId: 'c1',
  },
  {
    id: 't2',
    title: 'Presentar propuesta Nexus Inmobiliaria',
    priority: 'high',
    done: false,
    status: 'pending',
    category: 'Ventas',
    weekOf: '2025-03-03',
  },
  {
    id: 't3',
    title: 'Diseñar stories Bloom Wellness',
    priority: 'medium',
    done: true,
    status: 'done',
    category: 'Diseño',
    weekOf: '2025-03-03',
    clientId: 'c2',
  },
  {
    id: 't4',
    title: 'Informe mensual Urban Bites',
    priority: 'medium',
    done: false,
    status: 'pending',
    category: 'Reportes',
    weekOf: '2025-03-03',
    clientId: 'c3',
  },
  {
    id: 't5',
    title: 'Llamada de onboarding PetLove',
    priority: 'low',
    done: false,
    status: 'pending',
    category: 'Ventas',
    weekOf: '2025-03-03',
  },
]

const sampleIdeas: Idea[] = [
  {
    id: 'i1',
    title: 'Serie "Behind the Brand" para LinkedIn',
    description: 'Mini-documental semanal mostrando el backstage de nuestros clientes. Humaniza la marca y genera engagement.',
    status: 'developing',
    tags: ['LinkedIn', 'Contenido', 'Video'],
    emoji: '🎬',
    createdAt: '2025-02-28',
  },
  {
    id: 'i2',
    title: 'Campaña "Antes & Después" de resultados',
    description: 'Mostrar métricas reales de clientes (con permiso) en carruseles atractivos.',
    status: 'brainstorm',
    tags: ['Social Proof', 'Resultados', 'Diseño'],
    emoji: '📈',
    createdAt: '2025-03-01',
  },
  {
    id: 'i3',
    title: 'Email newsletter quincenal para prospectos',
    description: 'Newsletter con tendencias de marketing, tips y casos de éxito de la agencia.',
    status: 'ready',
    tags: ['Email', 'Lead Nurturing'],
    emoji: '📧',
    createdAt: '2025-02-15',
  },
]

const samplePosts: Post[] = [
  {
    id: 'post1',
    clientId: 'c1',
    title: 'Lanzamiento nueva feature cloud',
    content: '🚀 ¡Grandes noticias! En TechNova lanzamos nuestra nueva suite cloud que reduce costos operativos hasta un 40%. Más de 200 empresas ya están transformando su infraestructura con nosotros.\n\n¿Listo para el futuro? 👇',
    platform: 'linkedin',
    scheduledDate: '2025-03-10',
    status: 'pending',
    createdAt: '2025-03-05',
  },
  {
    id: 'post2',
    clientId: 'c2',
    title: 'Tip de bienestar lunes',
    content: '✨ El secreto de una mente clara empieza por 5 minutos de respiración consciente cada mañana. En Bloom Wellness te enseñamos cómo transformar tu rutina.\n\n#Bienestar #Mindfulness #Salud',
    platform: 'instagram',
    scheduledDate: '2025-03-08',
    status: 'approved',
    createdAt: '2025-03-03',
  },
  {
    id: 'post3',
    clientId: 'c1',
    title: 'Caso de éxito cliente enterprise',
    content: 'Cómo ayudamos a una empresa de 500 empleados a migrar toda su infraestructura en 30 días sin interrupciones. Un caso de estudio que redefine lo posible. 💼',
    platform: 'linkedin',
    scheduledDate: '2025-03-15',
    status: 'revision',
    createdAt: '2025-03-04',
    feedback: 'Agregar métricas específicas y logo del cliente.',
  },
]

const samplePlan: MarketingPlan = {
  id: 'mp1',
  clientId: 'c1',
  title: 'Plan Q2 2025 — TechNova Solutions',
  objective: 'Posicionar a TechNova como referente en soluciones cloud para PYMES en LATAM, incrementando leads calificados en 40%.',
  startDate: '2025-04-01',
  endDate: '2025-06-30',
  milestones: [
    { id: 'm1', title: 'Auditoría & Estrategia', description: 'Análisis completo de presencia digital y definición de pilares de contenido', date: '2025-04-07', completed: true, category: 'strategy' },
    { id: 'm2', title: 'Rediseño de perfil LinkedIn', description: 'Optimización de banner, about y featured content', date: '2025-04-14', completed: true, category: 'design' },
    { id: 'm3', title: 'Lanzamiento Blog Corporativo', description: '4 artículos SEO sobre transformación digital', date: '2025-04-21', completed: false, category: 'content' },
    { id: 'm4', title: 'Campaña Awareness Q2', description: 'Pauta en LinkedIn + Google Display para generación de leads', date: '2025-05-01', completed: false, category: 'ads' },
    { id: 'm5', title: 'Webinar "Cloud para PYMES"', description: 'Evento online con 200 asistentes esperados', date: '2025-05-15', completed: false, category: 'content' },
    { id: 'm6', title: 'Reporte de Resultados Mensual', description: 'Dashboard con KPIs y optimizaciones', date: '2025-05-31', completed: false, category: 'analytics' },
    { id: 'm7', title: 'Campaña Mid-Funnel', description: 'Retargeting y nurturing de leads captados', date: '2025-06-10', completed: false, category: 'ads' },
    { id: 'm8', title: 'Cierre Q2 & Planificación Q3', description: 'Informe final y roadmap siguiente trimestre', date: '2025-06-30', completed: false, category: 'strategy' },
  ],
  kpis: [
    { label: 'Alcance mensual', target: '50,000', current: '32,400' },
    { label: 'Leads generados', target: '120', current: '67' },
    { label: 'Engagement rate', target: '5%', current: '3.8%' },
    { label: 'Tráfico web', target: '+40%', current: '+24%' },
  ],
}

export const useStore = create<CRMState>()(
  persist(
    (set) => ({
      prospects: sampleProspects,
      clients: [],
      todos: sampleTodos,
      ideas: sampleIdeas,
      posts: samplePosts,
      marketingPlans: [samplePlan],
      sidebarCollapsed: false,

      fetchClients: async () => {
        try {
          const { data } = await api.get('/clients')
          set({ clients: data })
        } catch {
          // If API fails, keep current state
        }
      },

      addProspect: (p) => set((s) => ({ prospects: [...s.prospects, p] })),
      updateProspect: (id, data) => set((s) => ({ prospects: s.prospects.map(p => p.id === id ? { ...p, ...data } : p) })),
      deleteProspect: (id) => set((s) => ({ prospects: s.prospects.filter(p => p.id !== id) })),

      addClient: (c) => set((s) => ({ clients: [...s.clients, c] })),
      updateClient: (id, data) => set((s) => ({ clients: s.clients.map(c => c.id === id ? { ...c, ...data } : c) })),
      deleteClient: (id) => set((s) => ({ clients: s.clients.filter(c => c.id !== id) })),

      addTodo: (t) => set((s) => ({ todos: [...s.todos, t] })),
      updateTodo: (id, data) => set((s) => ({ todos: s.todos.map(t => t.id === id ? { ...t, ...data } : t) })),
      deleteTodo: (id) => set((s) => ({ todos: s.todos.filter(t => t.id !== id) })),
      toggleTodo: (id) => set((s) => ({ todos: s.todos.map(t => t.id === id ? { ...t, done: !t.done } : t) })),

      addIdea: (i) => set((s) => ({ ideas: [...s.ideas, i] })),
      updateIdea: (id, data) => set((s) => ({ ideas: s.ideas.map(i => i.id === id ? { ...i, ...data } : i) })),
      deleteIdea: (id) => set((s) => ({ ideas: s.ideas.filter(i => i.id !== id) })),

      addPost: (p) => set((s) => ({ posts: [...s.posts, p] })),
      updatePost: (id, data) => set((s) => ({ posts: s.posts.map(p => p.id === id ? { ...p, ...data } : p) })),
      deletePost: (id) => set((s) => ({ posts: s.posts.filter(p => p.id !== id) })),

      addPlan: (p) => set((s) => ({ marketingPlans: [...s.marketingPlans, p] })),
      updatePlan: (id, data) => set((s) => ({ marketingPlans: s.marketingPlans.map(p => p.id === id ? { ...p, ...data } : p) })),

      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    {
      name: 'tbs-crm-store',
      partialize: (state) => {
        // Don't persist clients — always fetched fresh from API
        const { clients, ...rest } = state
        return rest
      },
    }
  )
)
