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
