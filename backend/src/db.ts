import 'dotenv/config'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'
import { v4 as uuid } from 'uuid'

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/tbs_crm',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

export async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'client',
      name TEXT NOT NULL,
      client_id TEXT,
      avatar TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      company TEXT NOT NULL,
      contact TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      industry TEXT,
      monthly_fee NUMERIC DEFAULT 0,
      services TEXT DEFAULT '[]',
      status TEXT DEFAULT 'active',
      start_date TEXT,
      color TEXT DEFAULT '#DC143C',
      description TEXT,
      linkedin_connected INTEGER DEFAULT 0,
      linkedin_company_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS platform_connections (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      access_token TEXT,
      refresh_token TEXT,
      token_expires_at TIMESTAMPTZ,
      platform_account_id TEXT,
      platform_account_name TEXT,
      scopes TEXT DEFAULT '[]',
      is_active INTEGER DEFAULT 1,
      last_sync_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(client_id, platform)
    );

    CREATE TABLE IF NOT EXISTS metric_snapshots (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      metric_type TEXT NOT NULL,
      value NUMERIC,
      metadata TEXT DEFAULT '{}',
      snapshot_date DATE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(client_id, platform, metric_type, snapshot_date)
    );

    CREATE INDEX IF NOT EXISTS idx_snapshots_lookup
      ON metric_snapshots(client_id, platform, snapshot_date DESC);
  `)
  // Safe migrations for columns added after initial schema
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS avatar_url TEXT`)
  await pool.query(`

    CREATE TABLE IF NOT EXISTS prospects (
      id TEXT PRIMARY KEY,
      company TEXT NOT NULL,
      contact TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      industry TEXT,
      budget TEXT,
      status TEXT DEFAULT 'new',
      source TEXT DEFAULT 'Web',
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT DEFAULT 'medium',
      done INTEGER DEFAULT 0,
      category TEXT DEFAULT 'General',
      client_id TEXT,
      week_of TEXT,
      due_date TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ideas (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'brainstorm',
      tags TEXT DEFAULT '[]',
      emoji TEXT DEFAULT '💡',
      client_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT,
      platform TEXT DEFAULT 'linkedin',
      scheduled_date TEXT,
      status TEXT DEFAULT 'pending',
      media_urls TEXT DEFAULT '[]',
      feedback TEXT,
      type TEXT DEFAULT 'post',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      objective TEXT,
      start_date TEXT,
      end_date TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS milestones (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      date TEXT,
      completed INTEGER DEFAULT 0,
      category TEXT DEFAULT 'strategy',
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS kpis (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      target TEXT,
      current_value TEXT
    );
  `)
}

export async function seedDB() {
  const { rows } = await pool.query(
    "SELECT id FROM users WHERE email = 'admin@thebrandingstudio.com'"
  )
  if (rows.length > 0) return

  const adminHash = await bcrypt.hash('TBS@Admin2025!', 10)
  const clientHash = await bcrypt.hash('TechNova@2025!', 10)

  const clients = [
    { id: 'c1', company: 'TechNova Solutions', contact: 'Alejandro Ruiz', email: 'alejandro@technova.com', phone: '+57 300 123 4567', industry: 'Tecnología', monthly_fee: 2500, services: JSON.stringify(['Social Media', 'SEO', 'Pauta Digital']), status: 'active', start_date: '2024-01-15', color: '#DC143C', description: 'Empresa líder en soluciones cloud para PYMES', linkedin_connected: 1 },
    { id: 'c2', company: 'Bloom Wellness', contact: 'Valentina Torres', email: 'valen@bloomwellness.co', phone: '+57 315 987 6543', industry: 'Salud & Bienestar', monthly_fee: 1800, services: JSON.stringify(['Contenido', 'Instagram', 'Email Marketing']), status: 'active', start_date: '2024-03-01', color: '#7C3AED', description: 'Centro de bienestar holístico premium', linkedin_connected: 0 },
    { id: 'c3', company: 'Urban Bites', contact: 'Sebastián Mora', email: 'sebas@urbanbites.co', phone: '+57 320 456 7890', industry: 'Gastronomía', monthly_fee: 1200, services: JSON.stringify(['Social Media', 'Fotografía']), status: 'active', start_date: '2024-06-10', color: '#F59E0B', description: 'Restaurante urbano con cocina fusión', linkedin_connected: 0 },
  ]
  for (const c of clients) {
    await pool.query(
      `INSERT INTO clients (id, company, contact, email, phone, industry, monthly_fee, services, status, start_date, color, description, linkedin_connected)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (id) DO NOTHING`,
      [c.id, c.company, c.contact, c.email, c.phone, c.industry, c.monthly_fee, c.services, c.status, c.start_date, c.color, c.description, c.linkedin_connected]
    )
  }

  await pool.query(
    `INSERT INTO users (id, email, password_hash, role, name, client_id) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
    ['u_admin', 'admin@thebrandingstudio.com', adminHash, 'admin', 'Admin TBS', null]
  )
  await pool.query(
    `INSERT INTO users (id, email, password_hash, role, name, client_id) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
    ['u_client1', 'hola@technova.com', clientHash, 'client', 'Alejandro Ruiz', 'c1']
  )

  const prospects = [
    { id: 'p1', company: 'Nexus Inmobiliaria', contact: 'Carlos Mendoza', email: 'cmendoza@nexus.com', industry: 'Inmobiliaria', budget: '$3,000/mes', status: 'proposal', source: 'Referido' },
    { id: 'p2', company: 'PetLove Store', contact: 'María Fernández', email: 'maria@petlove.co', industry: 'Retail', budget: '$800/mes', status: 'contacted', source: 'Instagram' },
    { id: 'p3', company: 'Fintech Verde', contact: 'Diego Castillo', email: 'diego@fintechverde.io', industry: 'Fintech', budget: '$4,000/mes', status: 'negotiation', source: 'LinkedIn' },
    { id: 'p4', company: 'Moda Élite', contact: 'Sofía Ramírez', email: 'sofia@modaelite.co', industry: 'Moda', budget: '$1,500/mes', status: 'new', source: 'Web' },
  ]
  for (const p of prospects) {
    await pool.query(
      `INSERT INTO prospects (id, company, contact, email, industry, budget, status, source) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
      [p.id, p.company, p.contact, p.email, p.industry, p.budget, p.status, p.source]
    )
  }

  const todos = [
    { id: 't1', title: 'Crear calendario de contenido TechNova — Abril', priority: 'high', done: 0, category: 'Contenido', client_id: 'c1', week_of: '2025-03-03' },
    { id: 't2', title: 'Presentar propuesta Nexus Inmobiliaria', priority: 'high', done: 0, category: 'Ventas', client_id: null, week_of: '2025-03-03' },
    { id: 't3', title: 'Diseñar stories Bloom Wellness', priority: 'medium', done: 1, category: 'Diseño', client_id: 'c2', week_of: '2025-03-03' },
    { id: 't4', title: 'Informe mensual Urban Bites', priority: 'medium', done: 0, category: 'Reportes', client_id: 'c3', week_of: '2025-03-03' },
    { id: 't5', title: 'Llamada onboarding PetLove', priority: 'low', done: 0, category: 'Ventas', client_id: null, week_of: '2025-03-03' },
  ]
  for (const t of todos) {
    await pool.query(
      `INSERT INTO todos (id, title, priority, done, category, client_id, week_of) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
      [t.id, t.title, t.priority, t.done, t.category, t.client_id, t.week_of]
    )
  }

  const ideas = [
    { id: 'i1', title: 'Serie "Behind the Brand" para LinkedIn', description: 'Mini-documental semanal mostrando el backstage de nuestros clientes.', status: 'developing', tags: JSON.stringify(['LinkedIn', 'Video', 'Contenido']), emoji: '🎬' },
    { id: 'i2', title: 'Campaña "Antes & Después" de resultados', description: 'Mostrar métricas reales en carruseles atractivos.', status: 'brainstorm', tags: JSON.stringify(['Social Proof', 'Resultados']), emoji: '📈' },
    { id: 'i3', title: 'Email newsletter quincenal', description: 'Newsletter con tendencias de marketing y casos de éxito.', status: 'ready', tags: JSON.stringify(['Email', 'Lead Nurturing']), emoji: '📧' },
  ]
  for (const i of ideas) {
    await pool.query(
      `INSERT INTO ideas (id, title, description, status, tags, emoji) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
      [i.id, i.title, i.description, i.status, i.tags, i.emoji]
    )
  }

  const posts = [
    { id: 'post1', client_id: 'c1', title: 'Lanzamiento nueva feature cloud', content: '🚀 ¡Grandes noticias! En TechNova lanzamos nuestra nueva suite cloud que reduce costos operativos hasta un 40%. Más de 200 empresas ya están transformando su infraestructura con nosotros.\n\n¿Listo para el futuro? 👇', platform: 'linkedin', scheduled_date: '2025-03-10', status: 'pending', feedback: null, type: 'post' },
    { id: 'post2', client_id: 'c2', title: 'Tip de bienestar lunes', content: '✨ El secreto de una mente clara empieza por 5 minutos de respiración consciente cada mañana. En Bloom Wellness te enseñamos cómo transformar tu rutina.\n\n#Bienestar #Mindfulness', platform: 'instagram', scheduled_date: '2025-03-08', status: 'approved', feedback: null, type: 'post' },
    { id: 'post3', client_id: 'c1', title: 'Caso de éxito cliente enterprise', content: 'Cómo ayudamos a una empresa de 500 empleados a migrar toda su infraestructura en 30 días sin interrupciones. Un caso de estudio que redefine lo posible. 💼', platform: 'linkedin', scheduled_date: '2025-03-15', status: 'revision', feedback: 'Agregar métricas específicas y logo del cliente.', type: 'post' },
  ]
  for (const p of posts) {
    await pool.query(
      `INSERT INTO posts (id, client_id, title, content, platform, scheduled_date, status, feedback, type) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
      [p.id, p.client_id, p.title, p.content, p.platform, p.scheduled_date, p.status, p.feedback, p.type]
    )
  }

  const planId = 'mp1'
  await pool.query(
    `INSERT INTO plans (id, client_id, title, objective, start_date, end_date) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
    [planId, 'c1', 'Plan Q2 2025 — TechNova Solutions', 'Posicionar a TechNova como referente en soluciones cloud para PYMES en LATAM, incrementando leads calificados en 40%.', '2025-04-01', '2025-06-30']
  )

  const milestones = [
    { id: 'm1', title: 'Auditoría & Estrategia', description: 'Análisis completo de presencia digital y definición de pilares de contenido', date: '2025-04-07', completed: 1, category: 'strategy', sort_order: 0 },
    { id: 'm2', title: 'Rediseño de perfil LinkedIn', description: 'Optimización de banner, about y featured content', date: '2025-04-14', completed: 1, category: 'design', sort_order: 1 },
    { id: 'm3', title: 'Lanzamiento Blog Corporativo', description: '4 artículos SEO sobre transformación digital', date: '2025-04-21', completed: 0, category: 'content', sort_order: 2 },
    { id: 'm4', title: 'Campaña Awareness Q2', description: 'Pauta en LinkedIn + Google Display para generación de leads', date: '2025-05-01', completed: 0, category: 'ads', sort_order: 3 },
    { id: 'm5', title: 'Webinar "Cloud para PYMES"', description: 'Evento online con 200 asistentes esperados', date: '2025-05-15', completed: 0, category: 'content', sort_order: 4 },
    { id: 'm6', title: 'Reporte de Resultados Mensual', description: 'Dashboard con KPIs y optimizaciones', date: '2025-05-31', completed: 0, category: 'analytics', sort_order: 5 },
    { id: 'm7', title: 'Campaña Mid-Funnel', description: 'Retargeting y nurturing de leads captados', date: '2025-06-10', completed: 0, category: 'ads', sort_order: 6 },
    { id: 'm8', title: 'Cierre Q2 & Planificación Q3', description: 'Informe final y roadmap siguiente trimestre', date: '2025-06-30', completed: 0, category: 'strategy', sort_order: 7 },
  ]
  for (const m of milestones) {
    await pool.query(
      `INSERT INTO milestones (id, plan_id, title, description, date, completed, category, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
      [m.id, planId, m.title, m.description, m.date, m.completed, m.category, m.sort_order]
    )
  }

  const kpis = [
    { id: 'k1', label: 'Alcance mensual', target: '50000', current_value: '32400' },
    { id: 'k2', label: 'Leads generados', target: '120', current_value: '67' },
    { id: 'k3', label: 'Engagement rate', target: '5', current_value: '3.8' },
    { id: 'k4', label: 'Tráfico web', target: '40', current_value: '24' },
  ]
  for (const k of kpis) {
    await pool.query(
      `INSERT INTO kpis (id, plan_id, label, target, current_value) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
      [k.id, planId, k.label, k.target, k.current_value]
    )
  }

  await seedDemoLinkedIn('c1')
  await seedDemoMeta('c1')

  console.log('✅ DB seeded (PostgreSQL)')
}

async function seedDemoLinkedIn(clientId: string) {
  const today = new Date()
  let followers = 1840

  for (let i = 89; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    followers += Math.floor(Math.random() * 25) + 5

    const snaps = [
      { id: `li_fl_${clientId}_${dateStr}`, metric_type: 'followers', value: followers },
      { id: `li_im_${clientId}_${dateStr}`, metric_type: 'impressions', value: Math.floor(Math.random() * 3000) + 800 },
      { id: `li_pv_${clientId}_${dateStr}`, metric_type: 'page_views', value: Math.floor(Math.random() * 400) + 80 },
      { id: `li_er_${clientId}_${dateStr}`, metric_type: 'engagement_rate', value: parseFloat((Math.random() * 4 + 2).toFixed(2)) },
    ]
    if (i <= 29) {
      snaps.push({ id: `li_cl_${clientId}_${dateStr}`, metric_type: 'clicks', value: Math.floor(Math.random() * 150) + 30 })
    }
    for (const s of snaps) {
      await pool.query(
        `INSERT INTO metric_snapshots (id, client_id, platform, metric_type, value, snapshot_date)
         VALUES ($1,$2,'linkedin',$3,$4,$5)
         ON CONFLICT (client_id, platform, metric_type, snapshot_date) DO NOTHING`,
        [s.id, clientId, s.metric_type, s.value, dateStr]
      )
    }
  }
}

async function seedDemoMeta(clientId: string) {
  const today = new Date()
  let fbFollowers = 3200
  let igFollowers = 5800

  for (let i = 89; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    fbFollowers += Math.floor(Math.random() * 15) + 2
    igFollowers += Math.floor(Math.random() * 30) + 8

    const snaps = [
      { id: `meta_fb_${clientId}_${dateStr}`, metric_type: 'fb_followers', value: fbFollowers },
      { id: `meta_ig_${clientId}_${dateStr}`, metric_type: 'ig_followers', value: igFollowers },
      { id: `meta_reach_${clientId}_${dateStr}`, metric_type: 'reach', value: Math.floor(Math.random() * 5000) + 1000 },
      { id: `meta_imp_${clientId}_${dateStr}`, metric_type: 'impressions', value: Math.floor(Math.random() * 8000) + 2000 },
      { id: `meta_er_${clientId}_${dateStr}`, metric_type: 'engagement_rate', value: parseFloat((Math.random() * 5 + 1).toFixed(2)) },
    ]
    for (const s of snaps) {
      await pool.query(
        `INSERT INTO metric_snapshots (id, client_id, platform, metric_type, value, snapshot_date)
         VALUES ($1,$2,'meta',$3,$4,$5)
         ON CONFLICT (client_id, platform, metric_type, snapshot_date) DO NOTHING`,
        [s.id, clientId, s.metric_type, s.value, dateStr]
      )
    }
  }
}
