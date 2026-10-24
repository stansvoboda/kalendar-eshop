import type { ReactElement } from 'react'
import { Resend } from 'resend'

// Mailer port: e-mails are React Email components (see src/emails/), the adapter renders and sends them.
export interface Mailer {
  send(mail: { to: string; subject: string; react: ReactElement }): Promise<void>
}

export function resendMailer(apiKey: string, from: string): Mailer {
  const resend = new Resend(apiKey)
  return {
    async send(mail) {
      const { error } = await resend.emails.send({ from, ...mail })
      if (error) throw new Error(`Resend: ${error.message}`)
    },
  }
}
