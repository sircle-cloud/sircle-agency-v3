/** ConsoleMailer — dev/tests: print de mail naar de console i.p.v. te versturen. */
import type { Mailer } from '../../ports/index';

export class ConsoleMailer implements Mailer {
  public sent: Array<{ to: string; subject: string; text: string }> = [];

  async send(params: {
    to: string;
    subject: string;
    text: string;
    icsAttachment?: { filename: string; content: string };
  }): Promise<void> {
    this.sent.push({ to: params.to, subject: params.subject, text: params.text });
    console.log(
      `\n[mail] → ${params.to}\n[mail] onderwerp: ${params.subject}\n${params.text}\n` +
        (params.icsAttachment ? `[mail] bijlage: ${params.icsAttachment.filename}\n` : ''),
    );
  }
}
