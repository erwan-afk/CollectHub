/**
 * Mailer — Nodemailer + Handlebars.
 *
 * En dev : Mailhog (SMTP sur port 1025, interface web sur 8025).
 * En prod : remplacer par SendGrid / SES via la même interface.
 *
 * Templates disponibles :
 *  - invoice-validated  : { invoiceId, invoiceNumber, orgName }
 *  - invoice-rejected   : { invoiceId, invoiceNumber, reason, orgName }
 *  - password-reset     : { resetUrl, expiresIn }
 */
import nodemailer from 'nodemailer';
import Handlebars from 'handlebars';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  // Mailhog n'a pas d'auth
  auth: undefined,
});

// ─── Templates inline (Handlebars) ───────────────────────────────────────────

const TEMPLATES: Record<string, { subject: string; html: string; text: string }> = {
  'invoice-validated': {
    subject: '[Yooz] Facture validée — {{invoiceNumber}}',
    html: `<p>La facture <strong>{{invoiceNumber}}</strong> (ID: {{invoiceId}}) a été validée.</p>`,
    text: `Facture {{invoiceNumber}} (ID: {{invoiceId}}) validée.`,
  },
  'invoice-rejected': {
    subject: '[Yooz] Facture rejetée — {{invoiceNumber}}',
    html: `<p>La facture <strong>{{invoiceNumber}}</strong> (ID: {{invoiceId}}) a été rejetée.<br>Raison : {{reason}}</p>`,
    text: `Facture {{invoiceNumber}} (ID: {{invoiceId}}) rejetée. Raison : {{reason}}`,
  },
  'password-reset': {
    subject: '[Yooz] Réinitialisation de mot de passe',
    html: `<p>Cliquez <a href="{{resetUrl}}">ici</a> pour réinitialiser votre mot de passe (expire dans {{expiresIn}}).</p>`,
    text: `Réinitialisez votre mot de passe : {{resetUrl}} (expire dans {{expiresIn}})`,
  },
};

export async function sendEmail(
  to: string,
  template: keyof typeof TEMPLATES,
  data: Record<string, unknown>,
): Promise<void> {
  const tpl = TEMPLATES[template];
  if (!tpl) throw new Error(`Unknown email template: ${template}`);

  const subject = Handlebars.compile(tpl.subject)(data);
  const html = Handlebars.compile(tpl.html)(data);
  const text = Handlebars.compile(tpl.text)(data);

  await transporter.sendMail({
    from: 'noreply@yooz.local',
    to,
    subject,
    html,
    text,
  });

  logger.info('email.sent', { to, template });
}
