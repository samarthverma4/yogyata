export type RoleId = 'job-seeker' | 'founder' | 'mentor' | 'recruiter';

export interface RoleOption {
  id: RoleId;
  title: string;
  badge?: string;
  description: string;
  contextualAction: string;
}

export interface NotificationState {
  id: string;
  type: 'info' | 'success';
  title: string;
  message: string;
}
