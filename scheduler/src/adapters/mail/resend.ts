/**
 * ResendMailer — echte e-mail via Resend (https://resend.com). Verstuurt
 * bevestigingen + .ics-bijlage. Klaar om in te pluggen met RESEND_API_KEY.
 */
import type { Mailer } from '../../ports/index';

export interface ResendConfig {
  apiKey: string;
  from: string; // bv. "SIRCLE Planner <afspraken@jouwdomein.nl>"
}

export class ResendMailer implements Mailer {
  constructor(private config: ResendConfig) {}

  async send(params: {
    to: string;
    subject: string;
    text: string;
    icsAttachment?: { filename: string; content: string };
  }): Promise<void> {
    const body: Record<string, unknown> = {
      from: this.config.from,
      to: [params.to],
      subject: params.subject,
      text: params.text,
    };
    if (params.icsAttachment) {
      body.attachments = [
        {
          filename: params.icsAttachment.filename,
          content: Buffer.from(params.icsAttachment.content).toString('base64'),
        },
      ];
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`Resend ${res.status}: ${t}`);
    }
  }
}
