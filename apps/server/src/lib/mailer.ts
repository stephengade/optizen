import nodemailer from 'nodemailer'
import type { SmtpConfig } from '@launchpad/shared'

export async function sendEmail(options: {
  smtp: SmtpConfig
  subject: string
  text: string
  html: string
}) {
  const { smtp, subject, text, html } = options

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: {
      user: smtp.user,
      pass: smtp.password,
    },
  })

  await transporter.sendMail({
    from: smtp.from,
    to: smtp.to.join(', '),
    subject,
    text,
    html,
  })
}
