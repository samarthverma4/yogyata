import type {
  MentorProfile,
  MentorExpertise,
  MentorshipPreferences,
  SessionFormat,
  SessionFrequency,
} from '../mentor-onboarding/types';

export type MentorWorkspaceTab =
  | 'overview'
  | 'requests'
  | 'mentees'
  | 'sessions'
  | 'feedback'
  | 'profile'
  | 'settings';

export type RequestStatus = 'pending' | 'accepted' | 'declined';

export interface MentorshipRequest {
  id: string;
  menteeName: string;
  menteeEmail: string;
  careerGoal: string;
  relevantSkills: string[];
  requestedTrack: string;
  introMessage: string;
  preferredTime: string;
  status: RequestStatus;
  submittedAt: string;
  responseNote?: string;
  isDemoRecord?: boolean;
}

export type MenteeRelationshipStatus = 'active' | 'completed' | 'on-hold';

export interface MenteeActionItem {
  id: string;
  text: string;
  completed: boolean;
  dueDate?: string;
}

export interface MenteeRelationship {
  id: string;
  requestId?: string;
  menteeName: string;
  menteeEmail: string;
  careerGoal: string;
  mentorshipTrack: string;
  status: MenteeRelationshipStatus;
  startDate: string;
  goals: string[];
  actionItems: MenteeActionItem[];
  privateNotes: string; // Strictly private to mentor
  lastSessionDate?: string;
  nextSessionDate?: string;
  isDemoRecord?: boolean;
}

export type SessionStatus = 'scheduled' | 'completed' | 'cancelled';

export interface MentorshipSession {
  id: string;
  menteeId: string;
  menteeName: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  durationMinutes: number;
  sessionFormat: SessionFormat;
  agenda: string;
  prepNotes?: string;
  status: SessionStatus;
  postSessionNotes?: string;
  actionItemsAdded?: string[];
  isDemoRecord?: boolean;
}

export type FeedbackVisibility = 'shared-with-mentee' | 'private-mentor-note';

export interface LearningFeedback {
  id: string;
  menteeId: string;
  menteeName: string;
  sessionId?: string;
  feedbackDate: string;
  strengthsObserved: string;
  improvementAreas: string;
  recommendedNextSteps: string;
  privateMentorReflection?: string;
  visibility: FeedbackVisibility;
  isDemoRecord?: boolean;
}

export interface MentorSettings {
  maxActiveMentees: number;
  weeklyAvailabilityHours: number;
  sessionDurationMinutes: number;
  sessionFrequency: SessionFrequency;
  profileVisibility: 'public' | 'mentees-only' | 'private';
  notifyNewRequests: boolean;
  notifyUpcomingSessions: boolean;
  weeklyDigest: boolean;
}

export interface MentorWorkspaceState {
  version: number;
  mentor: MentorProfile & { fullName: string; email: string };
  expertise: MentorExpertise;
  preferences: MentorshipPreferences;
  requests: MentorshipRequest[];
  mentees: MenteeRelationship[];
  sessions: MentorshipSession[];
  feedback: LearningFeedback[];
  settings: MentorSettings;
  createdAt: string;
  lastUpdatedAt: string;
}
