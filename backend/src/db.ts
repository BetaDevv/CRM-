import 'dotenv/config'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'
import { v4 as uuid } from 'uuid'

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL environment variable is required')

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
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
      color TEXT DEFAULT '#EA580C',
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
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD'`)
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '#EA580C'`)
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS active INTEGER DEFAULT 1`)
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ`)
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

    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      actor TEXT,
      description TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      entity_type TEXT,
      entity_id TEXT,
      is_read INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS client_notes (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      author TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      start_time TIMESTAMPTZ NOT NULL,
      end_time TIMESTAMPTZ NOT NULL,
      all_day BOOLEAN DEFAULT FALSE,
      color TEXT,
      creator_id TEXT NOT NULL,
      client_id TEXT,
      todo_id TEXT,
      milestone_id TEXT,
      google_event_id TEXT,
      is_shared BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS event_participants (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(event_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS google_calendar_connections (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      token_expires_at TIMESTAMPTZ,
      calendar_id TEXT DEFAULT 'primary',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS microsoft_calendar_connections (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      token_expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `)

  // Migration: add probability to prospects
  await pool.query(`ALTER TABLE prospects ADD COLUMN IF NOT EXISTS probability INTEGER DEFAULT 0`)

  // Migration: add microsoft_event_id to events
  await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS microsoft_event_id TEXT`)

  // Migration: add client_note to events
  await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS client_note TEXT`)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS post_templates (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      platform TEXT DEFAULT 'linkedin',
      category TEXT DEFAULT 'general',
      industry TEXT,
      tags TEXT DEFAULT '[]',
      variables TEXT DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      path TEXT NOT NULL,
      client_id TEXT,
      uploaded_by TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  await pool.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS shared INTEGER DEFAULT 0`)

  // Migration: add shared and created_by to todos and ideas
  await pool.query(`ALTER TABLE todos ADD COLUMN IF NOT EXISTS shared INTEGER DEFAULT 0`)
  await pool.query(`ALTER TABLE todos ADD COLUMN IF NOT EXISTS created_by TEXT`)
  await pool.query(`ALTER TABLE ideas ADD COLUMN IF NOT EXISTS shared INTEGER DEFAULT 0`)
  await pool.query(`ALTER TABLE ideas ADD COLUMN IF NOT EXISTS created_by TEXT`)
  await pool.query(`ALTER TABLE todos ADD COLUMN IF NOT EXISTS note TEXT`)
  await pool.query(`ALTER TABLE ideas ADD COLUMN IF NOT EXISTS note TEXT`)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS item_notes (
      id TEXT PRIMARY KEY,
      item_type TEXT NOT NULL,
      item_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_item_notes_lookup ON item_notes(item_type, item_id);
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notes_read (
      user_id TEXT NOT NULL,
      item_type TEXT NOT NULL,
      item_id TEXT NOT NULL,
      read_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, item_type, item_id)
    );
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS todo_attachments (
      id TEXT PRIMARY KEY,
      todo_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      url TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_todo_attachments_todo ON todo_attachments(todo_id);
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      client_id TEXT,
      scopes TEXT DEFAULT 'read',
      is_active INTEGER DEFAULT 1,
      last_used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // Migration: add status, start_time, end_time, assigned_to to todos
  await pool.query(`ALTER TABLE todos ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'`)
  await pool.query(`ALTER TABLE todos ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ`)
  await pool.query(`ALTER TABLE todos ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ`)
  await pool.query(`ALTER TABLE todos ADD COLUMN IF NOT EXISTS assigned_to TEXT`)

  // Data migration: sync status with done flag
  await pool.query(`UPDATE todos SET status = CASE WHEN done = 1 THEN 'done' ELSE 'pending' END WHERE status IS NULL OR (status = 'pending' AND done = 1)`)

  // Migration: add profile_photo to users
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo TEXT`)

  // Migration: add accent_color to users (per-user override; falls back to clients.color)
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS accent_color TEXT`)

  // Migration: add created_by to posts (records which user originated the post)
  await pool.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS created_by TEXT`)

  // Migration: add language preference to users (per-user, nullable — null = use browser detection)
  // Allowed values: 'es' | 'en' | 'de' | NULL
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS language TEXT`)

  // Migration: global client ordering for the admin client strip (Metricas, PlanMarketing, etc.)
  // Shared across admins; persists across reloads.
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0`)
  {
    // Backfill any rows with sort_order=0 using alphabetical ORDER BY company (one-shot).
    const { rows: needBackfill } = await pool.query(
      'SELECT id FROM clients WHERE sort_order IS NULL OR sort_order = 0 ORDER BY company ASC'
    )
    if (needBackfill.length > 1) {
      for (let i = 0; i < needBackfill.length; i++) {
        await pool.query('UPDATE clients SET sort_order = $1 WHERE id = $2', [i + 1, needBackfill[i].id])
      }
    }
  }

  // Web (Plausible) dimensional breakdowns: top pages, channels, sources, devices, countries.
  // Time-series (visitors/pageviews/visits/bounce_rate/visit_duration) lives in metric_snapshots
  // with platform='web' — here we store the non-temporal aggregates.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS web_dimensions (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      dimension_type TEXT NOT NULL,
      name TEXT NOT NULL,
      visitors NUMERIC DEFAULT 0,
      pageviews NUMERIC DEFAULT 0,
      bounce_rate NUMERIC DEFAULT 0,
      visit_duration NUMERIC DEFAULT 0,
      extra TEXT DEFAULT '{}',
      imported_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(client_id, dimension_type, name)
    );
    CREATE INDEX IF NOT EXISTS idx_web_dimensions_lookup
      ON web_dimensions(client_id, dimension_type);
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
    { id: 'c1', company: 'TechNova Solutions', contact: 'Alejandro Ruiz', email: 'alejandro@technova.com', phone: '+57 300 123 4567', industry: 'Tecnología', monthly_fee: 2500, services: JSON.stringify(['Social Media', 'SEO', 'Pauta Digital']), status: 'active', start_date: '2024-01-15', color: '#EA580C', description: 'Empresa líder en soluciones cloud para PYMES', linkedin_connected: 1 },
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
    { id: 'p1', company: 'Nexus Inmobiliaria', contact: 'Carlos Mendoza', email: 'cmendoza@nexus.com', industry: 'Inmobiliaria', budget: '$3,000/mes', status: 'proposal', source: 'Referido', probability: 40 },
    { id: 'p2', company: 'PetLove Store', contact: 'María Fernández', email: 'maria@petlove.co', industry: 'Retail', budget: '$800/mes', status: 'contacted', source: 'Instagram', probability: 20 },
    { id: 'p3', company: 'Fintech Verde', contact: 'Diego Castillo', email: 'diego@fintechverde.io', industry: 'Fintech', budget: '$4,000/mes', status: 'negotiation', source: 'LinkedIn', probability: 70 },
    { id: 'p4', company: 'Moda Élite', contact: 'Sofía Ramírez', email: 'sofia@modaelite.co', industry: 'Moda', budget: '$1,500/mes', status: 'new', source: 'Web', probability: 10 },
  ]
  for (const p of prospects) {
    await pool.query(
      `INSERT INTO prospects (id, company, contact, email, industry, budget, status, source, probability) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
      [p.id, p.company, p.contact, p.email, p.industry, p.budget, p.status, p.source, p.probability]
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

  // Seed activity log
  const now = new Date()
  const activitySeed = [
    { id: 'act1', type: 'post_approved', actor: 'Alejandro Ruiz', description: 'TechNova aprobó post para LinkedIn', entity_type: 'post', entity_id: 'post1', minutes_ago: 30 },
    { id: 'act2', type: 'prospect_created', actor: 'Admin TBS', description: 'Nuevo prospecto: Moda Élite', entity_type: 'prospect', entity_id: 'p4', minutes_ago: 60 },
    { id: 'act3', type: 'todo_completed', actor: 'Admin TBS', description: 'Informe mensual Urban Bites entregado', entity_type: 'todo', entity_id: 't4', minutes_ago: 180 },
    { id: 'act4', type: 'client_updated', actor: 'Valentina Torres', description: 'Bloom Wellness solicitó revisión de propuesta', entity_type: 'client', entity_id: 'c2', minutes_ago: 1080 },
    { id: 'act5', type: 'idea_updated', actor: 'Admin TBS', description: 'Idea "Serie Behind the Brand" marcada como ready', entity_type: 'idea', entity_id: 'i1', minutes_ago: 1350 },
    { id: 'act6', type: 'client_created', actor: 'Admin TBS', description: 'Nuevo cliente: Urban Bites', entity_type: 'client', entity_id: 'c3', minutes_ago: 2880 },
  ]
  for (const a of activitySeed) {
    const createdAt = new Date(now.getTime() - a.minutes_ago * 60 * 1000)
    await pool.query(
      `INSERT INTO activity_log (id, type, actor, description, entity_type, entity_id, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
      [a.id, a.type, a.actor, a.description, a.entity_type, a.entity_id, createdAt.toISOString()]
    )
  }

  // Platform connections for all clients
  const platformConnections = [
    // TechNova (c1) — LinkedIn + Meta + TikTok + GA4
    { id: 'pc-c1-linkedin', client_id: 'c1', platform: 'linkedin', access_token: 'fake_token', refresh_token: null, platform_account_id: 'urn:li:organization:technova', platform_account_name: 'TechNova Solutions' },
    { id: 'pc-c1-meta', client_id: 'c1', platform: 'meta', access_token: 'fake_token', refresh_token: 'fake_refresh', platform_account_id: 'technova_page_id', platform_account_name: 'TechNova Solutions' },
    { id: 'pc-c1-tiktok', client_id: 'c1', platform: 'tiktok', access_token: 'fake_token', refresh_token: 'fake_refresh', platform_account_id: 'tt_technova', platform_account_name: 'TechNova Solutions' },
    { id: 'pc-c1-ga4', client_id: 'c1', platform: 'ga4', access_token: 'fake_token', refresh_token: 'fake_refresh', platform_account_id: 'properties/123456', platform_account_name: 'TechNova Web' },
    // Bloom Wellness (c2)
    { id: 'pc-c2-linkedin', client_id: 'c2', platform: 'linkedin', access_token: 'fake_token', refresh_token: null, platform_account_id: 'urn:li:organization:bloom', platform_account_name: 'Bloom Wellness' },
    { id: 'pc-c2-meta', client_id: 'c2', platform: 'meta', access_token: 'fake_token', refresh_token: 'fake_refresh', platform_account_id: 'bloom_page_id', platform_account_name: 'Bloom Wellness' },
    { id: 'pc-c2-tiktok', client_id: 'c2', platform: 'tiktok', access_token: 'fake_token', refresh_token: 'fake_refresh', platform_account_id: 'tt_bloom', platform_account_name: 'Bloom Wellness' },
    { id: 'pc-c2-ga4', client_id: 'c2', platform: 'ga4', access_token: 'fake_token', refresh_token: 'fake_refresh', platform_account_id: 'properties/789012', platform_account_name: 'Bloom Web' },
    // Urban Bites (c3)
    { id: 'pc-c3-linkedin', client_id: 'c3', platform: 'linkedin', access_token: 'fake_token', refresh_token: null, platform_account_id: 'urn:li:organization:urban', platform_account_name: 'Urban Bites' },
    { id: 'pc-c3-meta', client_id: 'c3', platform: 'meta', access_token: 'fake_token', refresh_token: 'fake_refresh', platform_account_id: 'urban_page_id', platform_account_name: 'Urban Bites' },
    { id: 'pc-c3-tiktok', client_id: 'c3', platform: 'tiktok', access_token: 'fake_token', refresh_token: 'fake_refresh', platform_account_id: 'tt_urban', platform_account_name: 'Urban Bites' },
    { id: 'pc-c3-ga4', client_id: 'c3', platform: 'ga4', access_token: 'fake_token', refresh_token: 'fake_refresh', platform_account_id: 'properties/345678', platform_account_name: 'Urban Bites Web' },
  ]
  for (const pc of platformConnections) {
    await pool.query(
      `INSERT INTO platform_connections (id, client_id, platform, access_token, refresh_token, platform_account_id, platform_account_name, is_active, last_sync_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,1,NOW()) ON CONFLICT (client_id, platform) DO NOTHING`,
      [pc.id, pc.client_id, pc.platform, pc.access_token, pc.refresh_token, pc.platform_account_id, pc.platform_account_name]
    )
  }

  // Seed metrics for all clients and platforms
  // c1: TechNova — larger tech company
  await seedDemoLinkedIn('c1', 1840, 25, 5, 3000, 800, 400, 80)
  await seedDemoMeta('c1', 3200, 15, 2, 5800, 30, 8, 5000, 1000, 8000, 2000)
  await seedDemoTikTok('c1', 5200, 10, 50, 2000, 8000, 500, 2000, 50, 200, 20, 100)
  await seedDemoGA4('c1', 400, 800, 300, 600, 800, 2000, 38, 52, 150, 280, 80, 200)

  // c2: Bloom Wellness — smaller, wellness niche
  await seedDemoLinkedIn('c2', 620, 10, 3, 1200, 300, 150, 30)
  await seedDemoMeta('c2', 1400, 8, 1, 8200, 45, 12, 3000, 600, 5000, 1000)
  await seedDemoTikTok('c2', 12000, 30, 80, 5000, 15000, 1200, 5000, 100, 400, 40, 200)
  await seedDemoGA4('c2', 150, 350, 100, 250, 300, 800, 40, 55, 120, 240, 40, 120)

  // c3: Urban Bites — medium food industry
  await seedDemoLinkedIn('c3', 950, 12, 4, 1800, 500, 250, 50)
  await seedDemoMeta('c3', 2100, 12, 3, 11500, 55, 15, 4500, 900, 7000, 1500)
  await seedDemoTikTok('c3', 8500, 20, 60, 4000, 12000, 800, 3500, 80, 350, 30, 150)
  await seedDemoGA4('c3', 250, 500, 180, 400, 500, 1200, 35, 50, 140, 260, 60, 160)

  // Seed notifications
  const notifSeed = [
    { id: 'notif1', user_id: 'u_admin', type: 'post_pending', title: 'Post pendiente de aprobación', description: 'TechNova tiene un post pendiente para LinkedIn', entity_type: 'post', entity_id: 'post1', minutes_ago: 15 },
    { id: 'notif2', user_id: 'u_admin', type: 'prospect_new', title: 'Nuevo prospecto', description: 'Nuevo prospecto: Moda Élite desde Web', entity_type: 'prospect', entity_id: 'p4', minutes_ago: 60 },
    { id: 'notif3', user_id: 'u_admin', type: 'post_approved', title: 'Post aprobado', description: 'Bloom Wellness aprobó el post: Tip de bienestar lunes', entity_type: 'post', entity_id: 'post2', minutes_ago: 180 },
    { id: 'notif4', user_id: 'u_admin', type: 'milestone_upcoming', title: 'Hito próximo', description: 'TechNova: Lanzamiento Blog Corporativo en 5 días', entity_type: 'plan', entity_id: 'mp1', minutes_ago: 360 },
    { id: 'notif5', user_id: 'u_client1', type: 'post_pending', title: 'Post pendiente de aprobación', description: 'Tienes un nuevo post para revisar: Lanzamiento nueva feature cloud', entity_type: 'post', entity_id: 'post1', minutes_ago: 20 },
    { id: 'notif6', user_id: 'u_client1', type: 'post_pending', title: 'Post en revisión', description: 'Tu post "Caso de éxito cliente enterprise" necesita cambios', entity_type: 'post', entity_id: 'post3', minutes_ago: 120 },
  ]
  for (const n of notifSeed) {
    const createdAt = new Date(now.getTime() - n.minutes_ago * 60 * 1000)
    await pool.query(
      `INSERT INTO notifications (id, user_id, type, title, description, entity_type, entity_id, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
      [n.id, n.user_id, n.type, n.title, n.description, n.entity_type, n.entity_id, createdAt.toISOString()]
    )
  }

  // Seed client notes for TechNova (c1)
  const notesSeed = [
    { id: 'cn1', client_id: 'c1', content: 'Alejandro mencionó que quieren aumentar presupuesto en Q3 para campañas de awareness en LinkedIn. Preparar propuesta.', author: 'Admin TBS', minutes_ago: 2880 },
    { id: 'cn2', client_id: 'c1', content: 'Reunión con equipo de producto de TechNova. Quieren destacar la nueva feature de migración automática en el próximo contenido.', author: 'Admin TBS', minutes_ago: 1440 },
    { id: 'cn3', client_id: 'c1', content: 'El CEO de TechNova va a estar en un evento en Bogotá la semana del 24 de marzo. Oportunidad para contenido en vivo.', author: 'Admin TBS', minutes_ago: 360 },
  ]
  for (const n of notesSeed) {
    const createdAt = new Date(now.getTime() - n.minutes_ago * 60 * 1000)
    await pool.query(
      `INSERT INTO client_notes (id, client_id, content, author, created_at)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
      [n.id, n.client_id, n.content, n.author, createdAt.toISOString()]
    )
  }

  // Seed calendar events
  const eventsSeed = [
    { id: 'ev1', title: 'Planificación contenido TechNova — Abril', description: 'Sesión de brainstorming y definición de calendario de contenido para abril.', start_time: '2026-03-23T10:00:00-05:00', end_time: '2026-03-23T11:30:00-05:00', all_day: false, color: '#EA580C', creator_id: 'u_admin', client_id: 'c1', todo_id: 't1', milestone_id: null, is_shared: false },
    { id: 'ev2', title: 'Revisión métricas semanales', description: 'Revisión de KPIs y métricas de todas las plataformas.', start_time: '2026-03-24T09:00:00-05:00', end_time: '2026-03-24T09:45:00-05:00', all_day: false, color: '#7C3AED', creator_id: 'u_admin', client_id: null, todo_id: null, milestone_id: null, is_shared: false },
    { id: 'ev3', title: 'Reunión con TechNova — Blog Corporativo', description: 'Presentación del plan de contenido para el blog corporativo. Revisar SEO y pilares de contenido.', start_time: '2026-03-25T14:00:00-05:00', end_time: '2026-03-25T15:00:00-05:00', all_day: false, color: '#EA580C', creator_id: 'u_admin', client_id: 'c1', todo_id: null, milestone_id: 'm3', is_shared: true },
    { id: 'ev4', title: 'Deadline: Propuesta Nexus Inmobiliaria', description: 'Fecha límite para enviar propuesta comercial a Nexus.', start_time: '2026-03-26T00:00:00-05:00', end_time: '2026-03-26T23:59:59-05:00', all_day: true, color: '#F59E0B', creator_id: 'u_admin', client_id: null, todo_id: 't2', milestone_id: null, is_shared: false },
    { id: 'ev5', title: 'Llamada onboarding PetLove', description: 'Primera llamada con PetLove Store para definir alcance y objetivos.', start_time: '2026-03-27T11:00:00-05:00', end_time: '2026-03-27T12:00:00-05:00', all_day: false, color: '#10B981', creator_id: 'u_admin', client_id: null, todo_id: 't5', milestone_id: null, is_shared: false },
    { id: 'ev6', title: 'Review creativo Bloom Wellness', description: 'Revisión de stories y contenido visual con el equipo de diseño.', start_time: '2026-03-28T16:00:00-05:00', end_time: '2026-03-28T17:00:00-05:00', all_day: false, color: '#7C3AED', creator_id: 'u_admin', client_id: 'c2', todo_id: null, milestone_id: null, is_shared: true },
  ]
  for (const ev of eventsSeed) {
    await pool.query(
      `INSERT INTO events (id, title, description, start_time, end_time, all_day, color, creator_id, client_id, todo_id, milestone_id, is_shared)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO NOTHING`,
      [ev.id, ev.title, ev.description, ev.start_time, ev.end_time, ev.all_day, ev.color, ev.creator_id, ev.client_id, ev.todo_id, ev.milestone_id, ev.is_shared]
    )
  }

  // Seed event participants for shared events
  const participantsSeed = [
    { id: 'ep1', event_id: 'ev3', user_id: 'u_client1', status: 'accepted' },
    { id: 'ep2', event_id: 'ev6', user_id: 'u_client1', status: 'pending' },
  ]
  for (const ep of participantsSeed) {
    await pool.query(
      `INSERT INTO event_participants (id, event_id, user_id, status)
       VALUES ($1,$2,$3,$4) ON CONFLICT (event_id, user_id) DO NOTHING`,
      [ep.id, ep.event_id, ep.user_id, ep.status]
    )
  }

  // Seed post templates
  const templates = [
    { id: 'tpl1', title: 'Thought Leadership LinkedIn', content: '💡 En {{industria}}, el cambio no espera.\n\nEn {{cliente}} hemos aprendido que {{resultado}}.\n\nTres lecciones clave:\n1. ...\n2. ...\n3. ...\n\n¿Cuál es tu mayor desafío en {{industria}} hoy? Me encantaría escucharte 👇\n\n#{{industria}} #Liderazgo #TransformaciónDigital', platform: 'linkedin', category: 'thought_leadership', industry: 'tecnología', tags: JSON.stringify(['liderazgo', 'opinión', 'B2B']), variables: JSON.stringify(['cliente', 'industria', 'resultado']) },
    { id: 'tpl2', title: 'Carousel Caption Instagram', content: '📲 Desliza para descubrir cómo {{cliente}} logró {{resultado}} →\n\n✅ Slide 1: El problema\n✅ Slide 2: La estrategia\n✅ Slide 3: Los resultados\n✅ Slide 4: Tu turno\n\n💬 ¿Te identificas? Comenta "INFO" y te contamos más.\n\n#{{industria}} #MarketingDigital #Resultados', platform: 'instagram', category: 'carousel', industry: null, tags: JSON.stringify(['carousel', 'educativo', 'engagement']), variables: JSON.stringify(['cliente', 'resultado', 'industria']) },
    { id: 'tpl3', title: 'Engagement Post Facebook', content: '🔥 Pregunta del día para {{industria}}:\n\n¿Prefieres {{opcionA}} o {{opcionB}}?\n\nEn {{cliente}} hemos probado ambos caminos y los resultados nos sorprendieron.\n\n👉 Comenta A o B y te cuento qué funcionó mejor.\n\n#{{industria}} #Debate #CommunityManager', platform: 'facebook', category: 'engagement', industry: null, tags: JSON.stringify(['engagement', 'interacción', 'comunidad']), variables: JSON.stringify(['industria', 'opcionA', 'opcionB', 'cliente']) },
    { id: 'tpl4', title: 'Caso de Éxito LinkedIn', content: '🚀 {{cliente}} logró {{resultado}} en solo {{periodo}}.\n\nEl desafío:\n{{cliente}} enfrentaba un mercado cada vez más competitivo en {{industria}}.\n\nLa solución:\nDiseñamos una estrategia integral enfocada en resultados medibles.\n\nEl resultado:\n📊 {{resultado}}\n\n¿Tu empresa necesita resultados similares? Hablemos.\n\n#{{industria}} #CasoDeÉxito #TransformaciónDigital', platform: 'linkedin', category: 'caso_exito', industry: 'tecnología', tags: JSON.stringify(['caso de éxito', 'resultados', 'B2B']), variables: JSON.stringify(['cliente', 'resultado', 'periodo', 'industria']) },
    { id: 'tpl5', title: 'Instagram Stories CTA', content: '⚡ {{cliente}} tiene algo INCREÍBLE para ti.\n\n{{producto}} ya está disponible.\n\n🔗 Link en bio para más info\n\n📅 Solo hasta {{fecha}}\n\n¡No te lo pierdas! 🙌', platform: 'instagram', category: 'stories', industry: null, tags: JSON.stringify(['stories', 'CTA', 'promoción']), variables: JSON.stringify(['cliente', 'producto', 'fecha']) },
    { id: 'tpl6', title: 'Thread Opener Twitter/X', content: '🧵 HILO: Cómo {{cliente}} transformó su {{industria}} en {{periodo}}.\n\nSpoiler: {{resultado}}.\n\nTe cuento paso a paso 👇\n\n(1/7)', platform: 'twitter', category: 'thread', industry: null, tags: JSON.stringify(['thread', 'storytelling', 'viral']), variables: JSON.stringify(['cliente', 'industria', 'periodo', 'resultado']) },
    { id: 'tpl7', title: 'Company Update LinkedIn', content: '📢 Noticias de {{cliente}}:\n\n{{novedad}}\n\nEsto significa:\n• Mayor {{beneficio1}}\n• Mejor {{beneficio2}}\n• Más {{beneficio3}}\n\nGracias a todo el equipo que hizo esto posible. 💪\n\n#{{industria}} #Crecimiento #Innovación', platform: 'linkedin', category: 'update', industry: null, tags: JSON.stringify(['actualización', 'corporativo', 'noticias']), variables: JSON.stringify(['cliente', 'novedad', 'beneficio1', 'beneficio2', 'beneficio3', 'industria']) },
    { id: 'tpl8', title: 'Post Promocional General', content: '🎯 {{producto}} de {{cliente}}\n\n¿Sabías que {{dato}}?\n\nPor eso creamos {{producto}}, diseñado para {{beneficio}}.\n\n🔥 Disponible desde {{fecha}}\n💰 {{precio}}\n\n👉 Más info en el link de la bio\n\n#{{industria}} #NuevoProducto #Lanzamiento', platform: 'linkedin', category: 'promocional', industry: null, tags: JSON.stringify(['promoción', 'producto', 'lanzamiento']), variables: JSON.stringify(['producto', 'cliente', 'dato', 'beneficio', 'fecha', 'precio', 'industria']) },
  ]
  for (const tpl of templates) {
    await pool.query(
      `INSERT INTO post_templates (id, title, content, platform, category, industry, tags, variables)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
      [tpl.id, tpl.title, tpl.content, tpl.platform, tpl.category, tpl.industry, tpl.tags, tpl.variables]
    )
  }

  console.log('✅ DB seeded (PostgreSQL)')
}

async function seedDemoLinkedIn(
  clientId: string,
  startFollowers: number, followerRandMax: number, followerRandMin: number,
  impressionMax: number, impressionMin: number, pvMax: number, pvMin: number,
) {
  const today = new Date()
  let followers = startFollowers

  for (let i = 89; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    followers += Math.floor(Math.random() * followerRandMax) + followerRandMin

    const snaps = [
      { id: `li_fl_${clientId}_${dateStr}`, metric_type: 'followers', value: followers },
      { id: `li_im_${clientId}_${dateStr}`, metric_type: 'impressions', value: Math.floor(Math.random() * impressionMax) + impressionMin },
      { id: `li_pv_${clientId}_${dateStr}`, metric_type: 'page_views', value: Math.floor(Math.random() * pvMax) + pvMin },
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

async function seedDemoMeta(
  clientId: string,
  startFb: number, fbRandMax: number, fbRandMin: number,
  startIg: number, igRandMax: number, igRandMin: number,
  reachMax: number, reachMin: number, impMax: number, impMin: number,
) {
  const today = new Date()
  let fbFollowers = startFb
  let igFollowers = startIg

  for (let i = 89; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    fbFollowers += Math.floor(Math.random() * fbRandMax) + fbRandMin
    igFollowers += Math.floor(Math.random() * igRandMax) + igRandMin

    const snaps = [
      { id: `meta_fb_${clientId}_${dateStr}`, metric_type: 'fb_followers', value: fbFollowers },
      { id: `meta_ig_${clientId}_${dateStr}`, metric_type: 'ig_followers', value: igFollowers },
      { id: `meta_reach_${clientId}_${dateStr}`, metric_type: 'reach', value: Math.floor(Math.random() * reachMax) + reachMin },
      { id: `meta_imp_${clientId}_${dateStr}`, metric_type: 'impressions', value: Math.floor(Math.random() * impMax) + impMin },
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

async function seedDemoTikTok(
  clientId: string,
  startFollowers: number, followerRandMin: number, followerRandMax: number,
  viewsMin: number, viewsMax: number,
  likesMin: number, likesMax: number,
  commentsMin: number, commentsMax: number,
  sharesMin: number, sharesMax: number,
) {
  const today = new Date()
  let followers = startFollowers
  let totalViews = Math.floor(startFollowers * 8)
  let totalLikes = Math.floor(startFollowers * 3)
  let totalComments = Math.floor(startFollowers * 0.4)
  let totalShares = Math.floor(startFollowers * 0.15)

  for (let i = 89; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]

    followers += Math.floor(Math.random() * (followerRandMax - followerRandMin)) + followerRandMin
    totalViews += Math.floor(Math.random() * (viewsMax - viewsMin)) + viewsMin
    totalLikes += Math.floor(Math.random() * (likesMax - likesMin)) + likesMin
    totalComments += Math.floor(Math.random() * (commentsMax - commentsMin)) + commentsMin
    totalShares += Math.floor(Math.random() * (sharesMax - sharesMin)) + sharesMin

    const snaps = [
      { id: `tt_fl_${clientId}_${dateStr}`, metric_type: 'followers', value: followers },
      { id: `tt_vv_${clientId}_${dateStr}`, metric_type: 'total_video_views', value: totalViews },
      { id: `tt_vl_${clientId}_${dateStr}`, metric_type: 'total_video_likes', value: totalLikes },
      { id: `tt_vc_${clientId}_${dateStr}`, metric_type: 'total_video_comments', value: totalComments },
      { id: `tt_vs_${clientId}_${dateStr}`, metric_type: 'total_video_shares', value: totalShares },
    ]
    for (const s of snaps) {
      await pool.query(
        `INSERT INTO metric_snapshots (id, client_id, platform, metric_type, value, snapshot_date)
         VALUES ($1,$2,'tiktok',$3,$4,$5)
         ON CONFLICT (client_id, platform, metric_type, snapshot_date) DO NOTHING`,
        [s.id, clientId, s.metric_type, s.value, dateStr]
      )
    }
  }
}

async function seedDemoGA4(
  clientId: string,
  sessionsMin: number, sessionsMax: number,
  usersMin: number, usersMax: number,
  pvMin: number, pvMax: number,
  bounceMin: number, bounceMax: number,
  durationMin: number, durationMax: number,
  newUsersMin: number, newUsersMax: number,
) {
  const today = new Date()

  for (let i = 89; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]

    const snaps = [
      { id: `ga_sess_${clientId}_${dateStr}`, metric_type: 'sessions', value: Math.floor(Math.random() * (sessionsMax - sessionsMin)) + sessionsMin },
      { id: `ga_users_${clientId}_${dateStr}`, metric_type: 'active_users', value: Math.floor(Math.random() * (usersMax - usersMin)) + usersMin },
      { id: `ga_pv_${clientId}_${dateStr}`, metric_type: 'page_views', value: Math.floor(Math.random() * (pvMax - pvMin)) + pvMin },
      { id: `ga_br_${clientId}_${dateStr}`, metric_type: 'bounce_rate', value: parseFloat((Math.random() * (bounceMax - bounceMin) + bounceMin).toFixed(1)) },
      { id: `ga_dur_${clientId}_${dateStr}`, metric_type: 'avg_session_duration', value: Math.floor(Math.random() * (durationMax - durationMin)) + durationMin },
      { id: `ga_new_${clientId}_${dateStr}`, metric_type: 'new_users', value: Math.floor(Math.random() * (newUsersMax - newUsersMin)) + newUsersMin },
    ]
    for (const s of snaps) {
      await pool.query(
        `INSERT INTO metric_snapshots (id, client_id, platform, metric_type, value, snapshot_date)
         VALUES ($1,$2,'ga4',$3,$4,$5)
         ON CONFLICT (client_id, platform, metric_type, snapshot_date) DO NOTHING`,
        [s.id, clientId, s.metric_type, s.value, dateStr]
      )
    }
  }
}
