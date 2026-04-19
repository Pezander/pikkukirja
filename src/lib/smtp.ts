import nodemailer from "nodemailer";
import { readSmtpConfig } from "./smtp-config";

function getSmtpSettings() {
  // Env vars take precedence; fall back to JSON config file
  const json = readSmtpConfig();
  return {
    host: process.env.SMTP_HOST ?? json.host ?? "",
    port: parseInt(process.env.SMTP_PORT ?? String(json.port ?? 587)),
    secure: process.env.SMTP_SECURE === "true" || (json.secure ?? false),
    user: process.env.SMTP_USER ?? json.user ?? "",
    pass: process.env.SMTP_PASS ?? json.pass ?? "",
    from: process.env.SMTP_FROM ?? json.from ?? "",
  };
}

export function isSmtpConfigured(): boolean {
  const s = getSmtpSettings();
  return !!(s.host && s.user && s.pass);
}

export function createTransport() {
  const s = getSmtpSettings();
  return nodemailer.createTransport({
    host: s.host,
    port: s.port,
    secure: s.secure,
    auth: { user: s.user, pass: s.pass },
  });
}

export const SMTP_FROM = () => {
  const s = getSmtpSettings();
  return s.from || s.user || "kirjanpito@example.com";
};
