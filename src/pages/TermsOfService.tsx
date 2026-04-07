import LegalPage from './LegalPage'

const APP_NAME = 'NextGenCRM'
const APP_DOMAIN = 'crm.nextgenbrand.de'
const CONTACT_EMAIL = 'miguelangel.bet0211@gmail.com'

const content = {
  es: {
    title: 'Condiciones del Servicio',
    backToLogin: 'Volver al inicio',
    sections: [
      {
        heading: '1. Aceptación de las Condiciones',
        body: `Al acceder y utilizar ${APP_NAME} disponible en ${APP_DOMAIN} (el "Servicio"), aceptas estas Condiciones del Servicio. Si no estás de acuerdo con alguna de estas condiciones, no debes utilizar el Servicio.`,
      },
      {
        heading: '2. Descripción del Servicio',
        body: `${APP_NAME} es una plataforma CRM que permite gestionar clientes, prospectos, publicaciones de contenido, planes de marketing, métricas de redes sociales, tareas, ideas, documentos y eventos de calendario. El Servicio incluye integraciones con servicios de terceros como Google Calendar, LinkedIn, Meta, TikTok y Google Analytics.`,
      },
      {
        heading: '3. Cuentas de Usuario',
        body: `• El acceso al Servicio es por invitación. Las cuentas son creadas por un administrador.
• Eres responsable de mantener la confidencialidad de tus credenciales de acceso.
• Debes notificar inmediatamente cualquier uso no autorizado de tu cuenta.
• No debes compartir tus credenciales con terceros.`,
      },
      {
        heading: '4. Uso Aceptable',
        body: `Al utilizar el Servicio, te comprometes a:

• Utilizar el Servicio únicamente para fines legítimos de gestión empresarial.
• No intentar acceder a datos de otros usuarios sin autorización.
• No realizar ingeniería inversa, descompilar ni intentar extraer el código fuente del Servicio.
• No utilizar el Servicio para almacenar o transmitir contenido ilegal, difamatorio o que infrinja derechos de terceros.
• No sobrecargar intencionalmente la infraestructura del Servicio.`,
      },
      {
        heading: '5. Contenido del Usuario',
        body: `• Conservas todos los derechos sobre el contenido que subas o crees en el Servicio (documentos, publicaciones, notas, etc.).
• Nos otorgas una licencia limitada para almacenar, procesar y mostrar tu contenido con el único fin de proporcionarte el Servicio.
• Eres responsable de asegurar que tu contenido no infrinja derechos de propiedad intelectual de terceros.`,
      },
      {
        heading: '6. Integraciones con Terceros',
        body: `El Servicio permite conectar cuentas de plataformas de terceros (Google Calendar, LinkedIn, Meta, TikTok, Google Analytics).

• Estas integraciones están sujetas a los términos de servicio de cada plataforma respectiva.
• Puedes conectar y desconectar estas integraciones en cualquier momento.
• No somos responsables por cambios, interrupciones o limitaciones en las APIs de terceros.
• El uso de datos obtenidos de Google APIs cumple con la Política de Datos de Usuario de los Servicios API de Google.`,
      },
      {
        heading: '7. Disponibilidad del Servicio',
        body: `• Nos esforzamos por mantener el Servicio disponible de forma continua, pero no garantizamos un tiempo de actividad del 100%.
• Podemos realizar mantenimientos programados que pueden interrumpir temporalmente el acceso.
• No somos responsables por interrupciones causadas por factores fuera de nuestro control (fallos de red, proveedores de hosting, etc.).`,
      },
      {
        heading: '8. Limitación de Responsabilidad',
        body: `• El Servicio se proporciona "tal cual" y "según disponibilidad".
• No garantizamos que el Servicio esté libre de errores o interrupciones.
• En ningún caso seremos responsables por daños indirectos, incidentales o consecuentes derivados del uso del Servicio.
• Nuestra responsabilidad máxima se limita al monto pagado por el Servicio en los últimos 12 meses, si aplica.`,
      },
      {
        heading: '9. Terminación',
        body: `• Podemos suspender o cancelar tu acceso al Servicio si incumples estas Condiciones.
• Puedes solicitar la eliminación de tu cuenta contactándonos a ${CONTACT_EMAIL}.
• Al terminar el acceso, tus datos serán eliminados según lo descrito en nuestra Política de Privacidad.`,
      },
      {
        heading: '10. Modificaciones',
        body: `Podemos modificar estas Condiciones del Servicio en cualquier momento. Publicaremos los cambios en esta página con la fecha de actualización. El uso continuado del Servicio después de las modificaciones constituye tu aceptación de las condiciones actualizadas.`,
      },
      {
        heading: '11. Contacto',
        body: `Para preguntas sobre estas Condiciones del Servicio:

• **Email**: ${CONTACT_EMAIL}
• **Plataforma**: ${APP_NAME} — ${APP_DOMAIN}`,
      },
    ],
  },
  en: {
    title: 'Terms of Service',
    backToLogin: 'Back to home',
    sections: [
      {
        heading: '1. Acceptance of Terms',
        body: `By accessing and using ${APP_NAME} available at ${APP_DOMAIN} (the "Service"), you agree to these Terms of Service. If you do not agree with any of these terms, you must not use the Service.`,
      },
      {
        heading: '2. Description of the Service',
        body: `${APP_NAME} is a CRM platform that allows you to manage clients, prospects, content publications, marketing plans, social media metrics, tasks, ideas, documents, and calendar events. The Service includes integrations with third-party services such as Google Calendar, LinkedIn, Meta, TikTok, and Google Analytics.`,
      },
      {
        heading: '3. User Accounts',
        body: `• Access to the Service is by invitation only. Accounts are created by an administrator.
• You are responsible for maintaining the confidentiality of your login credentials.
• You must immediately notify any unauthorized use of your account.
• You must not share your credentials with third parties.`,
      },
      {
        heading: '4. Acceptable Use',
        body: `When using the Service, you agree to:

• Use the Service only for legitimate business management purposes.
• Not attempt to access other users' data without authorization.
• Not reverse-engineer, decompile, or attempt to extract the source code of the Service.
• Not use the Service to store or transmit illegal, defamatory, or rights-infringing content.
• Not intentionally overload the Service infrastructure.`,
      },
      {
        heading: '5. User Content',
        body: `• You retain all rights to content you upload or create in the Service (documents, publications, notes, etc.).
• You grant us a limited license to store, process, and display your content solely to provide the Service to you.
• You are responsible for ensuring your content does not infringe third-party intellectual property rights.`,
      },
      {
        heading: '6. Third-Party Integrations',
        body: `The Service allows connecting accounts from third-party platforms (Google Calendar, LinkedIn, Meta, TikTok, Google Analytics).

• These integrations are subject to the terms of service of each respective platform.
• You can connect and disconnect these integrations at any time.
• We are not responsible for changes, interruptions, or limitations in third-party APIs.
• Use of data obtained from Google APIs complies with the Google API Services User Data Policy.`,
      },
      {
        heading: '7. Service Availability',
        body: `• We strive to keep the Service continuously available, but do not guarantee 100% uptime.
• We may perform scheduled maintenance that may temporarily interrupt access.
• We are not responsible for interruptions caused by factors beyond our control (network failures, hosting providers, etc.).`,
      },
      {
        heading: '8. Limitation of Liability',
        body: `• The Service is provided "as is" and "as available".
• We do not warrant that the Service will be error-free or uninterrupted.
• In no event shall we be liable for indirect, incidental, or consequential damages arising from the use of the Service.
• Our maximum liability is limited to the amount paid for the Service in the last 12 months, if applicable.`,
      },
      {
        heading: '9. Termination',
        body: `• We may suspend or cancel your access to the Service if you breach these Terms.
• You may request deletion of your account by contacting us at ${CONTACT_EMAIL}.
• Upon termination, your data will be deleted as described in our Privacy Policy.`,
      },
      {
        heading: '10. Modifications',
        body: `We may modify these Terms of Service at any time. We will post changes on this page with the update date. Continued use of the Service after modifications constitutes your acceptance of the updated terms.`,
      },
      {
        heading: '11. Contact',
        body: `For questions about these Terms of Service:

• **Email**: ${CONTACT_EMAIL}
• **Platform**: ${APP_NAME} — ${APP_DOMAIN}`,
      },
    ],
  },
  de: {
    title: 'Nutzungsbedingungen',
    backToLogin: 'Zurück zur Startseite',
    sections: [
      {
        heading: '1. Annahme der Bedingungen',
        body: `Durch den Zugang zu und die Nutzung von ${APP_NAME} unter ${APP_DOMAIN} (der "Dienst") stimmen Sie diesen Nutzungsbedingungen zu. Wenn Sie mit einer dieser Bedingungen nicht einverstanden sind, dürfen Sie den Dienst nicht nutzen.`,
      },
      {
        heading: '2. Beschreibung des Dienstes',
        body: `${APP_NAME} ist eine CRM-Plattform zur Verwaltung von Kunden, Interessenten, Content-Publikationen, Marketingplänen, Social-Media-Metriken, Aufgaben, Ideen, Dokumenten und Kalenderereignissen. Der Dienst umfasst Integrationen mit Drittanbieterdiensten wie Google Calendar, LinkedIn, Meta, TikTok und Google Analytics.`,
      },
      {
        heading: '3. Benutzerkonten',
        body: `• Der Zugang zum Dienst erfolgt nur auf Einladung. Konten werden von einem Administrator erstellt.
• Sie sind für die Vertraulichkeit Ihrer Zugangsdaten verantwortlich.
• Sie müssen jede unbefugte Nutzung Ihres Kontos sofort melden.
• Sie dürfen Ihre Zugangsdaten nicht an Dritte weitergeben.`,
      },
      {
        heading: '4. Akzeptable Nutzung',
        body: `Bei der Nutzung des Dienstes verpflichten Sie sich:

• Den Dienst nur für legitime Geschäftsverwaltungszwecke zu nutzen.
• Nicht zu versuchen, ohne Genehmigung auf Daten anderer Benutzer zuzugreifen.
• Den Dienst nicht zurückzuentwickeln, zu dekompilieren oder den Quellcode zu extrahieren.
• Den Dienst nicht zur Speicherung oder Übertragung illegaler, verleumderischer oder rechtsverletzender Inhalte zu nutzen.
• Die Infrastruktur des Dienstes nicht absichtlich zu überlasten.`,
      },
      {
        heading: '5. Benutzerinhalte',
        body: `• Sie behalten alle Rechte an Inhalten, die Sie im Dienst hochladen oder erstellen (Dokumente, Publikationen, Notizen usw.).
• Sie gewähren uns eine begrenzte Lizenz zur Speicherung, Verarbeitung und Anzeige Ihrer Inhalte ausschließlich zur Bereitstellung des Dienstes.
• Sie sind dafür verantwortlich, dass Ihre Inhalte keine geistigen Eigentumsrechte Dritter verletzen.`,
      },
      {
        heading: '6. Drittanbieter-Integrationen',
        body: `Der Dienst ermöglicht die Verbindung von Konten von Drittanbieterplattformen (Google Calendar, LinkedIn, Meta, TikTok, Google Analytics).

• Diese Integrationen unterliegen den Nutzungsbedingungen der jeweiligen Plattform.
• Sie können diese Integrationen jederzeit verbinden und trennen.
• Wir sind nicht verantwortlich für Änderungen, Unterbrechungen oder Einschränkungen in Drittanbieter-APIs.
• Die Nutzung von Daten aus Google APIs entspricht der Google API Services User Data Policy.`,
      },
      {
        heading: '7. Verfügbarkeit des Dienstes',
        body: `• Wir bemühen uns, den Dienst kontinuierlich verfügbar zu halten, garantieren jedoch keine 100%ige Verfügbarkeit.
• Wir können geplante Wartungsarbeiten durchführen, die den Zugang vorübergehend unterbrechen können.
• Wir sind nicht verantwortlich für Unterbrechungen durch Faktoren außerhalb unserer Kontrolle (Netzwerkausfälle, Hosting-Anbieter usw.).`,
      },
      {
        heading: '8. Haftungsbeschränkung',
        body: `• Der Dienst wird "wie besehen" und "nach Verfügbarkeit" bereitgestellt.
• Wir garantieren nicht, dass der Dienst fehlerfrei oder unterbrechungsfrei ist.
• In keinem Fall haften wir für indirekte, zufällige oder Folgeschäden, die aus der Nutzung des Dienstes entstehen.
• Unsere maximale Haftung ist auf den für den Dienst in den letzten 12 Monaten gezahlten Betrag beschränkt, falls zutreffend.`,
      },
      {
        heading: '9. Kündigung',
        body: `• Wir können Ihren Zugang zum Dienst aussetzen oder kündigen, wenn Sie gegen diese Bedingungen verstoßen.
• Sie können die Löschung Ihres Kontos beantragen, indem Sie uns unter ${CONTACT_EMAIL} kontaktieren.
• Bei Kündigung werden Ihre Daten wie in unserer Datenschutzrichtlinie beschrieben gelöscht.`,
      },
      {
        heading: '10. Änderungen',
        body: `Wir können diese Nutzungsbedingungen jederzeit ändern. Wir werden Änderungen auf dieser Seite mit dem Aktualisierungsdatum veröffentlichen. Die fortgesetzte Nutzung des Dienstes nach Änderungen stellt Ihre Zustimmung zu den aktualisierten Bedingungen dar.`,
      },
      {
        heading: '11. Kontakt',
        body: `Bei Fragen zu diesen Nutzungsbedingungen:

• **E-Mail**: ${CONTACT_EMAIL}
• **Plattform**: ${APP_NAME} — ${APP_DOMAIN}`,
      },
    ],
  },
}

export default function TermsOfService() {
  return <LegalPage content={content} lastUpdated="2026-04-07" />
}
