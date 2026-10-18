import type { UserRole } from './database.types';

/** Roles whose powers switch on only after a Yogyata admin approves the account. */
export const GATED_ROLES: readonly UserRole[] = ['mentor', 'recruiter'];
export const isGatedRole = (role: string | undefined) => GATED_ROLES.includes(role as UserRole);

// Mirrors private.is_free_email in the database, which is the rule that actually decides.
const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'yahoo.in', 'ymail.com', 'rocketmail.com',
  'outlook.com', 'outlook.in', 'hotmail.com', 'hotmail.co.in', 'live.com', 'live.in', 'msn.com',
  'icloud.com', 'me.com', 'mac.com', 'aol.com', 'proton.me', 'protonmail.com', 'pm.me',
  'gmx.com', 'gmx.net', 'yandex.com', 'yandex.ru', 'mail.com', 'zoho.com', 'zohomail.in',
  'rediffmail.com', 'tutanota.com', 'tuta.io', 'fastmail.com', 'hey.com', 'duck.com', 'inbox.com',
]);

export const isFreeEmail = (email: string) => FREE_EMAIL_DOMAINS.has(email.trim().toLowerCase().split('@')[1] ?? '');

export const ROLE_NAME: Record<UserRole, string> = {
  entrepreneur: 'Entrepreneur',
  seeker: 'Seeker',
  mentor: 'Mentor',
  recruiter: 'Recruiter',
};
