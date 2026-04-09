import nodemailer from 'nodemailer';

import type { Env } from '../config.js';
import { recordEmailNotification } from '../metrics/metrics.js';

export interface EmailNotifier {
  sendSubscriptionConfirmationEmail(input: {
    to: string;
    repository: string;
    confirmUrl: string;
    unsubscribeUrl: string;
  }): Promise<void>;
  sendNewReleaseEmail(input: {
    to: string;
    repository: string;
    tagName: string;
    releaseUrl: string;
  }): Promise<void>;
}

export class SmtpEmailNotifier implements EmailNotifier {
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;
  private static readonly SEND_TIMEOUT_MS = 15_000;

  constructor(env: Env) {
    if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS || !env.SMTP_FROM) {
      throw new Error(
        'SMTP_HOST, SMTP_USER, SMTP_PASS and SMTP_FROM are required for SMTP notifier.'
      );
    }

    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
      connectionTimeout: SmtpEmailNotifier.SEND_TIMEOUT_MS,
      greetingTimeout: SmtpEmailNotifier.SEND_TIMEOUT_MS,
      socketTimeout: SmtpEmailNotifier.SEND_TIMEOUT_MS,
    });
    this.from = env.SMTP_FROM;
  }

  public async sendNewReleaseEmail(input: {
    to: string;
    repository: string;
    tagName: string;
    releaseUrl: string;
  }): Promise<void> {
    try {
      await this.sendMailWithTimeout({
        from: this.from,
        to: input.to,
        subject: `New release in ${input.repository}: ${input.tagName}`,
        text: [
          `A new release was published in ${input.repository}.`,
          `Tag: ${input.tagName}`,
          `URL: ${input.releaseUrl}`,
        ].join('\n'),
      });
      recordEmailNotification({ type: 'release', result: 'success' });
    } catch (error) {
      recordEmailNotification({ type: 'release', result: 'failed' });
      throw error;
    }
  }

  public async sendSubscriptionConfirmationEmail(input: {
    to: string;
    repository: string;
    confirmUrl: string;
    unsubscribeUrl: string;
  }): Promise<void> {
    try {
      await this.sendMailWithTimeout({
        from: this.from,
        to: input.to,
        subject: `Confirm subscription for ${input.repository}`,
        text: [
          `You requested release notifications for ${input.repository}.`,
          `Confirm subscription: ${input.confirmUrl}`,
          `Unsubscribe: ${input.unsubscribeUrl}`,
        ].join('\n'),
        html: createConfirmationEmailHtml({
          repository: input.repository,
          confirmUrl: input.confirmUrl,
          unsubscribeUrl: input.unsubscribeUrl,
        }),
      });
      recordEmailNotification({ type: 'confirmation', result: 'success' });
    } catch (error) {
      recordEmailNotification({ type: 'confirmation', result: 'failed' });
      throw error;
    }
  }

  private async sendMailWithTimeout(
    message: nodemailer.SendMailOptions
  ): Promise<void> {
    await Promise.race([
      this.transporter.sendMail(message).then(() => undefined),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('SMTP send timeout exceeded.'));
        }, SmtpEmailNotifier.SEND_TIMEOUT_MS);
      }),
    ]);
  }
}

function createConfirmationEmailHtml(input: {
  repository: string;
  confirmUrl: string;
  unsubscribeUrl: string;
}): string {
  const repository = escapeHtml(input.repository);
  const confirmUrl = escapeHtml(input.confirmUrl);
  const unsubscribeUrl = escapeHtml(input.unsubscribeUrl);

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#0f1728;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="620" cellspacing="0" cellpadding="0" style="max-width:620px;width:100%;background:#ffffff;border:1px solid #dde5f0;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:24px 24px 10px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#475569;font-weight:700;">
                GitHub Release Alerts
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px 8px;font-size:34px;line-height:1;letter-spacing:-0.03em;font-weight:800;color:#0f1728;">
                Confirm Subscription
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px 20px;font-size:16px;line-height:1.5;color:#475569;">
                You requested release notifications for <strong>${repository}</strong>.
                Confirm once to activate updates.
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px 20px;">
                <a href="${confirmUrl}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#0f172a;color:#f8fafc;text-decoration:none;font-weight:700;">Confirm subscription</a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px 12px;font-size:14px;line-height:1.5;color:#64748b;">
                If you did not request this, you can unsubscribe immediately:
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px 24px;">
                <a href="${unsubscribeUrl}" style="font-size:14px;color:#0f4fa8;text-decoration:underline;">Unsubscribe</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export class NoopEmailNotifier implements EmailNotifier {
  public async sendSubscriptionConfirmationEmail(input: {
    to: string;
    repository: string;
    confirmUrl: string;
    unsubscribeUrl: string;
  }): Promise<void> {
    void input;
    recordEmailNotification({ type: 'confirmation', result: 'skipped' });
    // Intentionally no-op for environments without SMTP config.
  }

  public async sendNewReleaseEmail(input: {
    to: string;
    repository: string;
    tagName: string;
    releaseUrl: string;
  }): Promise<void> {
    void input;
    recordEmailNotification({ type: 'release', result: 'skipped' });
    // Intentionally no-op for environments without SMTP config.
  }
}
