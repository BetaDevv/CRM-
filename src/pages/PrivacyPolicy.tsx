import LegalPage from './LegalPage'

const APP_NAME = 'NextGenCRM'
const APP_DOMAIN = 'crm.nextgenbrand.de'
const CONTACT_EMAIL = 'info@nextgenbrand.de'

const content = {
  es: {
    title: 'Política de Privacidad',
    backToLogin: 'Volver al inicio',
    sections: [
      {
        heading: '1. Introducción',
        body: `${APP_NAME} opera la plataforma CRM disponible en ${APP_DOMAIN} (el "Servicio"). Esta Política de Privacidad explica cómo recopilamos, usamos, almacenamos y protegemos tu información personal cuando utilizas nuestro Servicio.`,
      },
      {
        heading: '2. Información que Recopilamos',
        body: `Recopilamos los siguientes tipos de información:

• **Información de cuenta**: nombre, correo electrónico y contraseña al registrarte.
• **Datos de clientes y prospectos**: nombres de empresas, contactos, correos electrónicos, teléfonos, industria y datos de servicios que ingreses en el CRM.
• **Contenido generado**: publicaciones, ideas, tareas, planes de marketing, documentos y notas que crees dentro de la plataforma.
• **Datos de Google Calendar**: cuando conectas tu cuenta de Google Calendar, accedemos a tus eventos de calendario para sincronizarlos con el sistema. Esto incluye títulos de eventos, fechas, horarios, descripciones y participantes.
• **Métricas de redes sociales**: cuando conectas plataformas como LinkedIn, Meta, TikTok o Google Analytics, recopilamos métricas de rendimiento (seguidores, impresiones, engagement) asociadas a tus cuentas.
• **Datos técnicos**: dirección IP, tipo de navegador y datos de uso del Servicio.`,
      },
      {
        heading: '3. Uso de Datos de Google Calendar',
        body: `Cuando conectas tu cuenta de Google Calendar a ${APP_NAME}, utilizamos los datos de la siguiente manera:

• **Sincronización bidireccional**: leemos tus eventos existentes de Google Calendar para mostrarlos en nuestro calendario interno, y creamos/actualizamos eventos en Google Calendar cuando los creas en nuestra plataforma.
• **Alcance limitado**: solo accedemos a los calendarios que explícitamente autorizas. No accedemos a otros servicios de Google.
• **Sin compartir con terceros**: los datos de tu Google Calendar NO se comparten, venden ni transfieren a terceros bajo ninguna circunstancia.
• **Sin publicidad**: los datos de Google Calendar NO se utilizan para fines publicitarios.
• **Almacenamiento**: los datos sincronizados se almacenan en nuestra base de datos para permitir la funcionalidad del calendario dentro del CRM. Solo se almacenan los datos necesarios (título, fecha, hora, descripción, participantes).
• **Eliminación**: puedes desconectar tu Google Calendar en cualquier momento desde la sección Calendario. Al desconectar, revocamos el acceso y eliminamos los tokens de autenticación almacenados.

Nuestro uso de la información recibida de las APIs de Google cumple con la Política de Datos de Usuario de los Servicios API de Google, incluidos los requisitos de Uso Limitado.`,
      },
      {
        heading: '4. Cómo Usamos tu Información',
        body: `Utilizamos la información recopilada para:

• Proporcionar, mantener y mejorar el Servicio.
• Sincronizar eventos entre nuestro CRM y tu Google Calendar.
• Enviar notificaciones por correo electrónico sobre actividad relevante (aprobaciones, notas, métricas semanales).
• Generar reportes y métricas de rendimiento para tu equipo.
• Proteger contra uso no autorizado o abuso del Servicio.`,
      },
      {
        heading: '5. Almacenamiento y Seguridad',
        body: `• Los datos se almacenan en una base de datos PostgreSQL con acceso restringido.
• Las contraseñas se cifran usando bcrypt con 10 rondas de salt.
• La autenticación se gestiona mediante tokens JWT con expiración de 7 días.
• Las comunicaciones se realizan sobre HTTPS.
• Los tokens de acceso de Google Calendar se almacenan de forma segura y se eliminan al desconectar la cuenta.
• Los archivos subidos se almacenan en servidores con acceso restringido.`,
      },
      {
        heading: '6. Compartir Información',
        body: `NO vendemos, alquilamos ni compartimos tu información personal con terceros, excepto:

• **Proveedores de servicio**: usamos servicios de terceros para el envío de correos electrónicos (SMTP) y las integraciones de APIs (Google Calendar, LinkedIn, Meta, TikTok, Google Analytics).
• **Obligación legal**: podemos divulgar información si es requerido por ley o proceso legal.`,
      },
      {
        heading: '7. Tus Derechos',
        body: `Tienes derecho a:

• **Acceder** a tus datos personales almacenados en el Servicio.
• **Corregir** información inexacta.
• **Eliminar** tu cuenta y datos asociados contactándonos a ${CONTACT_EMAIL}.
• **Revocar** el acceso a Google Calendar u otras plataformas conectadas en cualquier momento desde la sección Calendario del CRM.
• **Exportar** tus datos en formato estándar.`,
      },
      {
        heading: '8. Retención de Datos',
        body: `Conservamos tu información mientras tu cuenta esté activa o según sea necesario para proporcionarte el Servicio. Si deseas eliminar tu cuenta, contáctanos a ${CONTACT_EMAIL} y eliminaremos tus datos en un plazo de 30 días.`,
      },
      {
        heading: '9. Cookies y Almacenamiento Local',
        body: `El Servicio utiliza localStorage del navegador para mantener tu sesión activa (token de autenticación) y preferencias (idioma, tema visual). No utilizamos cookies de seguimiento de terceros.`,
      },
      {
        heading: '10. Cambios a esta Política',
        body: `Podemos actualizar esta Política de Privacidad periódicamente. Publicaremos cualquier cambio en esta página con la fecha de actualización. El uso continuado del Servicio después de los cambios constituye tu aceptación de la política modificada.`,
      },
      {
        heading: '11. Contacto',
        body: `Si tienes preguntas sobre esta Política de Privacidad o sobre el manejo de tus datos, contáctanos:

• **Email**: ${CONTACT_EMAIL}
• **Plataforma**: ${APP_NAME} — ${APP_DOMAIN}`,
      },
    ],
  },
  en: {
    title: 'Privacy Policy',
    backToLogin: 'Back to home',
    sections: [
      {
        heading: '1. Introduction',
        body: `${APP_NAME} operates the CRM platform available at ${APP_DOMAIN} (the "Service"). This Privacy Policy explains how we collect, use, store, and protect your personal information when you use our Service.`,
      },
      {
        heading: '2. Information We Collect',
        body: `We collect the following types of information:

• **Account information**: name, email address, and password when you register.
• **Client and prospect data**: company names, contacts, email addresses, phone numbers, industry, and service data you enter into the CRM.
• **Generated content**: posts, ideas, tasks, marketing plans, documents, and notes you create within the platform.
• **Google Calendar data**: when you connect your Google Calendar account, we access your calendar events for synchronization. This includes event titles, dates, times, descriptions, and participants.
• **Social media metrics**: when you connect platforms like LinkedIn, Meta, TikTok, or Google Analytics, we collect performance metrics (followers, impressions, engagement) associated with your accounts.
• **Technical data**: IP address, browser type, and Service usage data.`,
      },
      {
        heading: '3. Use of Google Calendar Data',
        body: `When you connect your Google Calendar account to ${APP_NAME}, we use the data as follows:

• **Bidirectional sync**: we read your existing Google Calendar events to display them in our internal calendar, and create/update events in Google Calendar when you create them in our platform.
• **Limited scope**: we only access the calendars you explicitly authorize. We do not access other Google services.
• **No third-party sharing**: your Google Calendar data is NOT shared, sold, or transferred to third parties under any circumstances.
• **No advertising**: Google Calendar data is NOT used for advertising purposes.
• **Storage**: synced data is stored in our database to enable calendar functionality within the CRM. Only necessary data is stored (title, date, time, description, participants).
• **Deletion**: you can disconnect your Google Calendar at any time from the Calendar section. Upon disconnection, we revoke access and delete stored authentication tokens.

Our use of information received from Google APIs complies with the Google API Services User Data Policy, including the Limited Use requirements.`,
      },
      {
        heading: '4. How We Use Your Information',
        body: `We use collected information to:

• Provide, maintain, and improve the Service.
• Synchronize events between our CRM and your Google Calendar.
• Send email notifications about relevant activity (approvals, notes, weekly metrics).
• Generate performance reports and metrics for your team.
• Protect against unauthorized use or abuse of the Service.`,
      },
      {
        heading: '5. Storage and Security',
        body: `• Data is stored in a PostgreSQL database with restricted access.
• Passwords are encrypted using bcrypt with 10 salt rounds.
• Authentication is managed via JWT tokens with 7-day expiration.
• Communications are conducted over HTTPS.
• Google Calendar access tokens are stored securely and deleted upon account disconnection.
• Uploaded files are stored on servers with restricted access.`,
      },
      {
        heading: '6. Information Sharing',
        body: `We do NOT sell, rent, or share your personal information with third parties, except:

• **Service providers**: we use third-party services for email delivery (SMTP) and API integrations (Google Calendar, LinkedIn, Meta, TikTok, Google Analytics).
• **Legal obligation**: we may disclose information if required by law or legal process.`,
      },
      {
        heading: '7. Your Rights',
        body: `You have the right to:

• **Access** your personal data stored in the Service.
• **Correct** inaccurate information.
• **Delete** your account and associated data by contacting us at ${CONTACT_EMAIL}.
• **Revoke** access to Google Calendar or other connected platforms at any time from the Calendar section of the CRM.
• **Export** your data in a standard format.`,
      },
      {
        heading: '8. Data Retention',
        body: `We retain your information while your account is active or as needed to provide the Service. If you wish to delete your account, contact us at ${CONTACT_EMAIL} and we will delete your data within 30 days.`,
      },
      {
        heading: '9. Cookies and Local Storage',
        body: `The Service uses browser localStorage to maintain your active session (authentication token) and preferences (language, visual theme). We do not use third-party tracking cookies.`,
      },
      {
        heading: '10. Changes to this Policy',
        body: `We may update this Privacy Policy periodically. We will post any changes on this page with the update date. Continued use of the Service after changes constitutes your acceptance of the modified policy.`,
      },
      {
        heading: '11. Contact',
        body: `If you have questions about this Privacy Policy or about how your data is handled, contact us:

• **Email**: ${CONTACT_EMAIL}
• **Platform**: ${APP_NAME} — ${APP_DOMAIN}`,
      },
    ],
  },
  de: {
    title: 'Datenschutzrichtlinie',
    backToLogin: 'Zurück zur Startseite',
    sections: [
      {
        heading: '1. Einleitung',
        body: `${APP_NAME} betreibt die CRM-Plattform unter ${APP_DOMAIN} (der "Dienst"). Diese Datenschutzrichtlinie erläutert, wie wir Ihre personenbezogenen Daten erfassen, verwenden, speichern und schützen, wenn Sie unseren Dienst nutzen.`,
      },
      {
        heading: '2. Erfasste Informationen',
        body: `Wir erfassen folgende Arten von Informationen:

• **Kontoinformationen**: Name, E-Mail-Adresse und Passwort bei der Registrierung.
• **Kunden- und Interessentendaten**: Firmennamen, Kontakte, E-Mail-Adressen, Telefonnummern, Branche und Servicedaten, die Sie in das CRM eingeben.
• **Erstellte Inhalte**: Beiträge, Ideen, Aufgaben, Marketingpläne, Dokumente und Notizen, die Sie innerhalb der Plattform erstellen.
• **Google Calendar-Daten**: Wenn Sie Ihr Google Calendar-Konto verbinden, greifen wir zur Synchronisierung auf Ihre Kalenderereignisse zu. Dies umfasst Ereignistitel, Daten, Zeiten, Beschreibungen und Teilnehmer.
• **Social-Media-Metriken**: Wenn Sie Plattformen wie LinkedIn, Meta, TikTok oder Google Analytics verbinden, erfassen wir Leistungsmetriken (Follower, Impressionen, Engagement).
• **Technische Daten**: IP-Adresse, Browsertyp und Nutzungsdaten des Dienstes.`,
      },
      {
        heading: '3. Verwendung von Google Calendar-Daten',
        body: `Wenn Sie Ihr Google Calendar-Konto mit ${APP_NAME} verbinden, verwenden wir die Daten wie folgt:

• **Bidirektionale Synchronisierung**: Wir lesen Ihre bestehenden Google Calendar-Ereignisse, um sie in unserem internen Kalender anzuzeigen, und erstellen/aktualisieren Ereignisse in Google Calendar, wenn Sie diese in unserer Plattform erstellen.
• **Begrenzter Umfang**: Wir greifen nur auf die Kalender zu, die Sie ausdrücklich autorisieren. Wir greifen nicht auf andere Google-Dienste zu.
• **Keine Weitergabe an Dritte**: Ihre Google Calendar-Daten werden unter keinen Umständen an Dritte weitergegeben, verkauft oder übertragen.
• **Keine Werbung**: Google Calendar-Daten werden NICHT für Werbezwecke verwendet.
• **Speicherung**: Synchronisierte Daten werden in unserer Datenbank gespeichert, um die Kalenderfunktionalität im CRM zu ermöglichen. Es werden nur notwendige Daten gespeichert (Titel, Datum, Uhrzeit, Beschreibung, Teilnehmer).
• **Löschung**: Sie können Ihren Google Calendar jederzeit im Kalenderbereich trennen. Bei der Trennung widerrufen wir den Zugang und löschen die gespeicherten Authentifizierungstoken.

Unsere Verwendung von Informationen, die von Google APIs empfangen werden, entspricht der Google API Services User Data Policy, einschließlich der Anforderungen zur eingeschränkten Nutzung.`,
      },
      {
        heading: '4. Wie wir Ihre Informationen verwenden',
        body: `Wir verwenden die erfassten Informationen um:

• Den Dienst bereitzustellen, zu warten und zu verbessern.
• Ereignisse zwischen unserem CRM und Ihrem Google Calendar zu synchronisieren.
• E-Mail-Benachrichtigungen über relevante Aktivitäten zu senden (Genehmigungen, Notizen, wöchentliche Metriken).
• Leistungsberichte und Metriken für Ihr Team zu erstellen.
• Vor unbefugter Nutzung oder Missbrauch des Dienstes zu schützen.`,
      },
      {
        heading: '5. Speicherung und Sicherheit',
        body: `• Daten werden in einer PostgreSQL-Datenbank mit eingeschränktem Zugang gespeichert.
• Passwörter werden mit bcrypt und 10 Salt-Runden verschlüsselt.
• Die Authentifizierung erfolgt über JWT-Token mit 7-tägiger Gültigkeit.
• Die Kommunikation erfolgt über HTTPS.
• Google Calendar-Zugriffstoken werden sicher gespeichert und bei Kontotrennung gelöscht.
• Hochgeladene Dateien werden auf Servern mit eingeschränktem Zugang gespeichert.`,
      },
      {
        heading: '6. Informationsweitergabe',
        body: `Wir verkaufen, vermieten oder teilen Ihre personenbezogenen Daten NICHT mit Dritten, außer:

• **Dienstleister**: Wir nutzen Drittanbieterdienste für den E-Mail-Versand (SMTP) und API-Integrationen (Google Calendar, LinkedIn, Meta, TikTok, Google Analytics).
• **Gesetzliche Verpflichtung**: Wir können Informationen offenlegen, wenn dies gesetzlich oder durch ein Gerichtsverfahren erforderlich ist.`,
      },
      {
        heading: '7. Ihre Rechte',
        body: `Sie haben das Recht:

• Auf Ihre im Dienst gespeicherten personenbezogenen Daten **zuzugreifen**.
• Ungenaue Informationen zu **korrigieren**.
• Ihr Konto und zugehörige Daten zu **löschen**, indem Sie uns unter ${CONTACT_EMAIL} kontaktieren.
• Den Zugang zu Google Calendar oder anderen verbundenen Plattformen jederzeit im Kalenderbereich des CRM zu **widerrufen**.
• Ihre Daten in einem Standardformat zu **exportieren**.`,
      },
      {
        heading: '8. Datenspeicherung',
        body: `Wir bewahren Ihre Informationen auf, solange Ihr Konto aktiv ist oder es zur Bereitstellung des Dienstes erforderlich ist. Wenn Sie Ihr Konto löschen möchten, kontaktieren Sie uns unter ${CONTACT_EMAIL}, und wir löschen Ihre Daten innerhalb von 30 Tagen.`,
      },
      {
        heading: '9. Cookies und lokaler Speicher',
        body: `Der Dienst verwendet den localStorage des Browsers, um Ihre aktive Sitzung (Authentifizierungstoken) und Einstellungen (Sprache, visuelles Design) aufrechtzuerhalten. Wir verwenden keine Tracking-Cookies von Drittanbietern.`,
      },
      {
        heading: '10. Änderungen dieser Richtlinie',
        body: `Wir können diese Datenschutzrichtlinie regelmäßig aktualisieren. Wir werden alle Änderungen auf dieser Seite mit dem Aktualisierungsdatum veröffentlichen. Die fortgesetzte Nutzung des Dienstes nach Änderungen stellt Ihre Zustimmung zur geänderten Richtlinie dar.`,
      },
      {
        heading: '11. Kontakt',
        body: `Wenn Sie Fragen zu dieser Datenschutzrichtlinie oder zum Umgang mit Ihren Daten haben, kontaktieren Sie uns:

• **E-Mail**: ${CONTACT_EMAIL}
• **Plattform**: ${APP_NAME} — ${APP_DOMAIN}`,
      },
    ],
  },
}

export default function PrivacyPolicy() {
  return <LegalPage content={content} lastUpdated="2026-04-07" />
}
