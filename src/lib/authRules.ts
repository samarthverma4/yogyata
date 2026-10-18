import type { UserRole } from './database.types';

export const ROLE_NAME: Record<UserRole, string> = {
  entrepreneur: 'Entrepreneur',
  seeker: 'Seeker',
  mentor: 'Mentor',
  recruiter: 'Recruiter',
};
