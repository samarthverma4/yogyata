import type {
  RecruiterProfile,
  CompanyProfile,
  HiringPreferences,
} from '../recruiter-onboarding/types';

export type {
  RecruiterProfile,
  CompanyProfile,
  HiringPreferences,
};

export type RecruiterWorkspaceTab =
  | 'overview'
  | 'talent-search'
  | 'postings'
  | 'invitations'
  | 'pipeline'
  | 'interviews'
  | 'scorecards'
  | 'company'
  | 'settings';

export type SkillTier = 'declared' | 'assessed' | 'verified';

export interface SkillEvidence {
  skillName: string;
  tier: SkillTier;
  evidenceType:
    | 'project-submission'
    | 'assessment-test'
    | 'code-challenge'
    | 'work-evidence'
    | 'self-claim';
  description: string;
  verifiedDate?: string;
  score?: string;
  sourceUrl?: string;
  verifierNote?: string;
}

export interface CandidateProfile {
  id: string;
  name: string;
  avatarInitials: string;
  headline: string;
  location: string;
  experienceYears: number;
  experienceRange: string;
  skills: string[];
  skillEvidence: SkillEvidence[];
  declaredSkills: string[];
  assessedSkills: string[];
  verifiedSkills: string[];
  employmentPreferences: string[];
  careerInterests: string[];
  bio: string;
  isSaved?: boolean;
}

export type PipelineStage =
  | 'sourced'
  | 'screening'
  | 'interview'
  | 'offer'
  | 'hired'
  | 'archived';

export type PipelinePriority = 'low' | 'medium' | 'high';

export interface PipelineCandidate {
  id: string;
  candidateId: string;
  candidateName: string;
  targetRole: string;
  stage: PipelineStage;
  priority: PipelinePriority;
  dateAdded: string;
  lastUpdated: string;
  recruiterNotes: string;
  nextAction: string;
  tags: string[];
}

export type InterviewRound =
  | 'initial-screening'
  | 'technical-deep-dive'
  | 'system-design'
  | 'culture-fit'
  | 'final-round';

export type InterviewStatus = 'scheduled' | 'completed' | 'cancelled';

export type InterviewFormat = 'video' | 'phone' | 'onsite';

export interface Interview {
  id: string;
  candidateId: string;
  candidateName: string;
  targetRole: string;
  round: InterviewRound;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  durationMinutes: number;
  format: InterviewFormat;
  locationOrLink: string;
  assignedInterviewers: string[];
  agenda: string;
  prepNotes: string;
  status: InterviewStatus;
  cancellationReason?: string;
}

export type Recommendation = 'strong-hire' | 'hire' | 'hold' | 'no-hire';

export interface Scorecard {
  id: string;
  candidateId: string;
  candidateName: string;
  interviewId?: string;
  targetRole: string;
  round: InterviewRound;
  interviewerName: string;
  technicalRating: number; // 1 to 5
  problemSolvingRating: number; // 1 to 5
  communicationRating: number; // 1 to 5
  roleAlignmentRating: number; // 1 to 5
  strengths: string;
  areasOfConcern: string;
  interviewNotes: string;
  recommendation: Recommendation;
  submittedAt: string;
}

export interface RecruiterSettings {
  defaultInterviewDuration: number;
  defaultInterviewFormat: InterviewFormat;
  defaultHiringFilterRole: string;
  simulatedNotifications: {
    newApplications: boolean;
    interviewReminders: boolean;
    scorecardAlerts: boolean;
  };
  candidateVisibility: 'public' | 'shortlist-only';
}

export interface RecruiterWorkspaceState {
  recruiter: RecruiterProfile;
  company: CompanyProfile;
  hiring: HiringPreferences;
  candidates: CandidateProfile[];
  pipeline: PipelineCandidate[];
  interviews: Interview[];
  scorecards: Scorecard[];
  settings: RecruiterSettings;
}

export const ROUND_LABELS: Record<InterviewRound, string> = {
  'initial-screening': 'Initial Screening',
  'technical-deep-dive': 'Technical Deep Dive',
  'system-design': 'System Architecture',
  'culture-fit': 'Culture & Values Fit',
  'final-round': 'Final Leadership Round',
};

export const STAGE_LABELS: Record<PipelineStage, string> = {
  sourced: 'Sourced',
  screening: 'Screening',
  interview: 'Interview',
  offer: 'Offer in Progress',
  hired: 'Hired',
  archived: 'Archived',
};

export const RECOMMENDATION_LABELS: Record<Recommendation, { label: string; color: string; bg: string }> = {
  'strong-hire': { label: 'Strong Hire', color: '#15803D', bg: '#DCFCE7' },
  hire: { label: 'Hire', color: '#166534', bg: '#F0FDF4' },
  hold: { label: 'Hold / Needs Review', color: '#B45309', bg: '#FEF3C7' },
  'no-hire': { label: 'No Hire', color: '#B91C1C', bg: '#FEE2E2' },
};
