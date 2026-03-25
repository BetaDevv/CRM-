import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export async function sendEventInvite(params: {
  to: string
  eventTitle: string
  eventDescription?: string
  startTime: string
  endTime: string
  organizerName: string
}) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('[Email] SMTP not configured, skipping email to:', params.to)
    return
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 30px; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #DC143C; margin: 0;">TheBrandingStudio</h1>
        <p style="color: #666; font-size: 12px;">CRM Calendar</p>
      </div>
      <div style="background: #111111; padding: 20px; border-radius: 8px; border-left: 4px solid #DC143C;">
        <h2 style="margin-top: 0; color: #fff;">${params.eventTitle}</h2>
        ${params.eventDescription ? `<p style="color: #aaa;">${params.eventDescription}</p>` : ''}
        <p style="color: #DC143C; font-weight: bold;">
          ${new Date(params.startTime).toLocaleString('es-CO', { dateStyle: 'full', timeStyle: 'short' })}
        </p>
        <p style="color: #888; font-size: 14px;">
          Hasta: ${new Date(params.endTime).toLocaleString('es-CO', { timeStyle: 'short' })}
        </p>
        <p style="color: #aaa; font-size: 14px;">
          Organizado por: <strong>${params.organizerName}</strong>
        </p>
      </div>
      <p style="color: #666; font-size: 12px; text-align: center; margin-top: 20px;">
        Ingresa al CRM para ver los detalles del evento.
      </p>
    </div>
  `

  try {
    await transporter.sendMail({
      from: `"TheBrandingStudio CRM" <${process.env.SMTP_USER}>`,
      to: params.to,
      subject: `Invitacion: ${params.eventTitle}`,
      html,
    })
    console.log('[Email] Sent event invite to:', params.to)
  } catch (err) {
    console.error('[Email] Failed to send:', err)
  }
}

// ─── Post Approval Request (sent to client) ───────────────────────
export async function sendPostForApproval(params: {
  to: string
  clientName: string
  postTitle: string
  platform: string
  scheduledDate: string
}) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('[Email] SMTP not configured, skipping email to:', params.to)
    return
  }

  const platformLabel = params.platform.charAt(0).toUpperCase() + params.platform.slice(1)
  const dateFormatted = params.scheduledDate
    ? new Date(params.scheduledDate).toLocaleDateString('es-CO', { dateStyle: 'long' })
    : 'Por definir'

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 30px; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #DC143C; margin: 0;">TheBrandingStudio</h1>
        <p style="color: #666; font-size: 12px;">Content Approval</p>
      </div>
      <div style="background: #111111; padding: 20px; border-radius: 8px; border-left: 4px solid #DC143C;">
        <h2 style="margin-top: 0; color: #fff;">Nuevo post pendiente de aprobación</h2>
        <p style="color: #aaa;">Hola <strong>${params.clientName}</strong>, tienes un nuevo post para revisar:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="color: #888; padding: 8px 0; border-bottom: 1px solid #222;">Título</td>
            <td style="color: #fff; padding: 8px 0; border-bottom: 1px solid #222; text-align: right;"><strong>${params.postTitle}</strong></td>
          </tr>
          <tr>
            <td style="color: #888; padding: 8px 0; border-bottom: 1px solid #222;">Plataforma</td>
            <td style="color: #fff; padding: 8px 0; border-bottom: 1px solid #222; text-align: right;">${platformLabel}</td>
          </tr>
          <tr>
            <td style="color: #888; padding: 8px 0;">Fecha programada</td>
            <td style="color: #DC143C; padding: 8px 0; text-align: right; font-weight: bold;">${dateFormatted}</td>
          </tr>
        </table>
        <p style="color: #aaa; font-size: 14px; margin-top: 16px;">
          Ingresa al CRM para revisar y aprobar este contenido.
        </p>
      </div>
      <p style="color: #666; font-size: 12px; text-align: center; margin-top: 20px;">
        Este es un mensaje automático de TheBrandingStudio CRM.
      </p>
    </div>
  `

  try {
    await transporter.sendMail({
      from: `"TheBrandingStudio CRM" <${process.env.SMTP_USER}>`,
      to: params.to,
      subject: `📋 Nuevo post pendiente de aprobación — ${params.postTitle}`,
      html,
    })
    console.log('[Email] Sent post approval request to:', params.to)
  } catch (err) {
    console.error('[Email] Failed to send post approval:', err)
  }
}

// ─── Post Status Notification (sent to admins) ────────────────────
export async function sendPostStatusNotification(params: {
  to: string
  postTitle: string
  platform: string
  status: 'approved' | 'rejected' | 'revision'
  clientName: string
  feedback?: string
}) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('[Email] SMTP not configured, skipping email to:', params.to)
    return
  }

  const statusConfig: Record<string, { emoji: string; label: string; color: string }> = {
    approved: { emoji: '✅', label: 'Post aprobado', color: '#22c55e' },
    rejected: { emoji: '❌', label: 'Post rechazado', color: '#ef4444' },
    revision: { emoji: '🔄', label: 'Cambios solicitados', color: '#f59e0b' },
  }
  const cfg = statusConfig[params.status]
  const platformLabel = params.platform.charAt(0).toUpperCase() + params.platform.slice(1)

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 30px; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #DC143C; margin: 0;">TheBrandingStudio</h1>
        <p style="color: #666; font-size: 12px;">Post Status Update</p>
      </div>
      <div style="background: #111111; padding: 20px; border-radius: 8px; border-left: 4px solid ${cfg.color};">
        <h2 style="margin-top: 0; color: ${cfg.color};">${cfg.emoji} ${cfg.label}</h2>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="color: #888; padding: 8px 0; border-bottom: 1px solid #222;">Post</td>
            <td style="color: #fff; padding: 8px 0; border-bottom: 1px solid #222; text-align: right;"><strong>${params.postTitle}</strong></td>
          </tr>
          <tr>
            <td style="color: #888; padding: 8px 0; border-bottom: 1px solid #222;">Plataforma</td>
            <td style="color: #fff; padding: 8px 0; border-bottom: 1px solid #222; text-align: right;">${platformLabel}</td>
          </tr>
          <tr>
            <td style="color: #888; padding: 8px 0;">Cliente</td>
            <td style="color: #fff; padding: 8px 0; text-align: right;"><strong>${params.clientName}</strong></td>
          </tr>
        </table>
        ${params.feedback ? `
        <div style="background: #1a1a1a; padding: 12px; border-radius: 6px; margin-top: 12px;">
          <p style="color: #888; margin: 0 0 4px 0; font-size: 12px;">Feedback del cliente:</p>
          <p style="color: #fff; margin: 0;">${params.feedback}</p>
        </div>` : ''}
      </div>
      <p style="color: #666; font-size: 12px; text-align: center; margin-top: 20px;">
        Ingresa al CRM para ver los detalles.
      </p>
    </div>
  `

  try {
    await transporter.sendMail({
      from: `"TheBrandingStudio CRM" <${process.env.SMTP_USER}>`,
      to: params.to,
      subject: `${cfg.emoji} ${cfg.label} — ${params.postTitle}`,
      html,
    })
    console.log('[Email] Sent post status notification to:', params.to)
  } catch (err) {
    console.error('[Email] Failed to send post status notification:', err)
  }
}

// ─── Note Notification ────────────────────────────────────────────
export async function sendNoteNotification(params: {
  to: string
  recipientName: string
  senderName: string
  itemType: 'tarea' | 'idea'
  itemTitle: string
  note: string
}) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('[Email] SMTP not configured, skipping note email to:', params.to)
    return
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 30px; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #DC143C; margin: 0;">TheBrandingStudio</h1>
        <p style="color: #666; font-size: 12px;">Nueva nota</p>
      </div>
      <div style="background: #111111; padding: 20px; border-radius: 8px; border-left: 4px solid #F59E0B;">
        <h2 style="margin-top: 0; color: #F59E0B;">💬 Nueva nota en tu ${params.itemType}</h2>
        <p style="color: #aaa;">Hola <strong>${params.recipientName}</strong>,</p>
        <p style="color: #aaa;"><strong>${params.senderName}</strong> dejó una nota en tu ${params.itemType}:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="color: #888; padding: 8px 0; border-bottom: 1px solid #222;">${params.itemType === 'tarea' ? 'Tarea' : 'Idea'}</td>
            <td style="color: #fff; padding: 8px 0; border-bottom: 1px solid #222; text-align: right;"><strong>${params.itemTitle}</strong></td>
          </tr>
        </table>
        <div style="background: #1a1a1a; padding: 12px; border-radius: 6px; margin-top: 12px;">
          <p style="color: #888; margin: 0 0 4px 0; font-size: 12px;">Nota:</p>
          <p style="color: #fff; margin: 0;">${params.note}</p>
        </div>
      </div>
      <p style="color: #666; font-size: 12px; text-align: center; margin-top: 20px;">
        Ingresa al CRM para responder.
      </p>
    </div>
  `

  try {
    await transporter.sendMail({
      from: `"TheBrandingStudio CRM" <${process.env.SMTP_USER}>`,
      to: params.to,
      subject: `💬 Nueva nota en tu ${params.itemType} — ${params.itemTitle}`,
      html,
    })
    console.log('[Email] Sent note notification to:', params.to)
  } catch (err) {
    console.error('[Email] Failed to send note notification:', err)
  }
}

// ─── Todo Completed Notification (sent to client) ─────────────────
export async function sendTodoCompletedNotification(params: {
  to: string
  clientName: string
  todoTitle: string
}) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('[Email] SMTP not configured, skipping email to:', params.to)
    return
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 30px; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #DC143C; margin: 0;">TheBrandingStudio</h1>
        <p style="color: #666; font-size: 12px;">Task Update</p>
      </div>
      <div style="background: #111111; padding: 20px; border-radius: 8px; border-left: 4px solid #22c55e;">
        <h2 style="margin-top: 0; color: #22c55e;">Tarea completada</h2>
        <p style="color: #aaa;">Hola <strong>${params.clientName}</strong>,</p>
        <p style="color: #aaa;">La siguiente tarea ha sido marcada como completada:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="color: #888; padding: 8px 0; border-bottom: 1px solid #222;">Tarea</td>
            <td style="color: #fff; padding: 8px 0; border-bottom: 1px solid #222; text-align: right;"><strong>${params.todoTitle}</strong></td>
          </tr>
        </table>
        <p style="color: #aaa; font-size: 14px; margin-top: 16px;">
          Ingresa al CRM para ver los detalles.
        </p>
      </div>
      <p style="color: #666; font-size: 12px; text-align: center; margin-top: 20px;">
        Este es un mensaje automatico de TheBrandingStudio CRM.
      </p>
    </div>
  `

  try {
    await transporter.sendMail({
      from: `"TheBrandingStudio CRM" <${process.env.SMTP_USER}>`,
      to: params.to,
      subject: `Tarea completada: ${params.todoTitle}`,
      html,
    })
    console.log('[Email] Sent todo completed notification to:', params.to)
  } catch (err) {
    console.error('[Email] Failed to send todo completed notification:', err)
  }
}

// ─── Weekly Metrics Summary (sent to clients) ─────────────────────
export async function sendWeeklyMetricsSummary(params: {
  to: string
  clientName: string
  metrics: {
    linkedin?: { followers: number; impressions: number; engagement: number }
    meta?: { fbFollowers: number; igFollowers: number; reach: number }
    tiktok?: { followers: number; videoViews: number }
    ga4?: { sessions: number; pageViews: number; users: number }
  }
}) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('[Email] SMTP not configured, skipping email to:', params.to)
    return
  }

  const { metrics } = params

  const metricRow = (label: string, value: number) =>
    `<tr>
      <td style="color: #aaa; padding: 6px 0; border-bottom: 1px solid #1a1a1a;">${label}</td>
      <td style="color: #fff; padding: 6px 0; border-bottom: 1px solid #1a1a1a; text-align: right; font-weight: bold;">${value.toLocaleString('es-CO')}</td>
    </tr>`

  const platformSection = (title: string, color: string, rows: string) =>
    `<div style="background: #111111; padding: 16px; border-radius: 8px; border-left: 4px solid ${color}; margin-bottom: 12px;">
      <h3 style="margin: 0 0 12px 0; color: ${color};">${title}</h3>
      <table style="width: 100%; border-collapse: collapse;">${rows}</table>
    </div>`

  let sections = ''

  if (metrics.linkedin) {
    sections += platformSection('LinkedIn', '#0A66C2',
      metricRow('Seguidores', metrics.linkedin.followers) +
      metricRow('Impresiones', metrics.linkedin.impressions) +
      metricRow('Engagement', metrics.linkedin.engagement)
    )
  }
  if (metrics.meta) {
    sections += platformSection('Meta (Facebook + Instagram)', '#1877F2',
      metricRow('Seguidores FB', metrics.meta.fbFollowers) +
      metricRow('Seguidores IG', metrics.meta.igFollowers) +
      metricRow('Alcance', metrics.meta.reach)
    )
  }
  if (metrics.tiktok) {
    sections += platformSection('TikTok', '#00f2ea',
      metricRow('Seguidores', metrics.tiktok.followers) +
      metricRow('Vistas de video', metrics.tiktok.videoViews)
    )
  }
  if (metrics.ga4) {
    sections += platformSection('Google Analytics', '#F9AB00',
      metricRow('Sesiones', metrics.ga4.sessions) +
      metricRow('Páginas vistas', metrics.ga4.pageViews) +
      metricRow('Usuarios', metrics.ga4.users)
    )
  }

  if (!sections) {
    console.log('[Email] No metrics to send for:', params.clientName)
    return
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 30px; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #DC143C; margin: 0;">TheBrandingStudio</h1>
        <p style="color: #666; font-size: 12px;">Weekly Metrics Report</p>
      </div>
      <p style="color: #aaa; margin-bottom: 20px;">
        Hola <strong>${params.clientName}</strong>, aquí tienes el resumen de tus métricas de la última semana:
      </p>
      ${sections}
      <p style="color: #666; font-size: 12px; text-align: center; margin-top: 20px;">
        Ingresa al CRM para ver el detalle completo de tus métricas.
      </p>
    </div>
  `

  try {
    await transporter.sendMail({
      from: `"TheBrandingStudio CRM" <${process.env.SMTP_USER}>`,
      to: params.to,
      subject: `📊 Resumen semanal de métricas — ${params.clientName}`,
      html,
    })
    console.log('[Email] Sent weekly metrics summary to:', params.to)
  } catch (err) {
    console.error('[Email] Failed to send weekly metrics summary:', err)
  }
}
