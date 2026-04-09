import nodemailer from 'nodemailer';

import type { Env } from '../config.js';

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
    });
    this.from = env.SMTP_FROM;
  }

  public async sendNewReleaseEmail(input: {
    to: string;
    repository: string;
    tagName: string;
    releaseUrl: string;
  }): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: input.to,
      subject: `New release in ${input.repository}: ${input.tagName}`,
      text: [
        `A new release was published in ${input.repository}.`,
        `Tag: ${input.tagName}`,
        `URL: ${input.releaseUrl}`,
      ].join('\n'),
    });
  }

  public async sendSubscriptionConfirmationEmail(input: {
    to: string;
    repository: string;
    confirmUrl: string;
    unsubscribeUrl: string;
  }): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: input.to,
      subject: `Confirm subscription for ${input.repository}`,
      text: [
        `You requested release notifications for ${input.repository}.`,
        `Confirm subscription: ${input.confirmUrl}`,
        `Unsubscribe: ${input.unsubscribeUrl}`,
      ].join('\n'),
    });
  }
}

export class NoopEmailNotifier implements EmailNotifier {
  public async sendSubscriptionConfirmationEmail(input: {
    to: string;
    repository: string;
    confirmUrl: string;
    unsubscribeUrl: string;
  }): Promise<void> {
    void input;
    // Intentionally no-op for environments without SMTP config.
  }

  public async sendNewReleaseEmail(input: {
    to: string;
    repository: string;
    tagName: string;
    releaseUrl: string;
  }): Promise<void> {
    void input;
    // Intentionally no-op for environments without SMTP config.
  }
}
