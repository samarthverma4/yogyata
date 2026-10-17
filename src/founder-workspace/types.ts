// ─── Founder Workspace Type Definitions ────────────────────────────────────────
import type {
  FounderProfile,
  StartupProfile,
  BusinessGoal,
  TalentRequirement,
  FounderPrivacyPreferences,
} from '../founder-onboarding/types';

export type WorkspaceTab =
  | 'overview'
  | 'startup'
  | 'projects'
  | 'tasks'
  | 'talent'
  | 'submissions'
  | 'settings';

export type ProjectStatus = 'draft' | 'active' | 'on-hold' | 'completed';

export interface Project {
  id: string;
  title: string;
  description: string;
  category: string;
  projectUrl?: string;
  status: ProjectStatus;
  createdAt: string; // ISO string
  updatedAt: string;
}

export type TaskStatus = 'draft' | 'published' | 'closed';
export type TaskCompensation = 'paid' | 'unpaid' | 'unspecified';

export interface WorkspaceTask {
  id: string;
  projectId: string; // References Project.id
  title: string;
  problemStatement: string;
  requiredSkills: string[];
  expectedDeliverable: string;
  evaluationCriteria: string;
  deadline?: string;
  compensationType: TaskCompensation;
  rewardDetails?: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

// ─── Skill Passport & Candidate Discovery (Prototype Demo Data) ───────────────
export type SkillEvidenceLevel = 'declared' | 'assessed' | 'verified';

export interface SkillPassportItem {
  skillName: string;
  level: SkillEvidenceLevel;
  evidenceSource: string; // e.g. "Self-declared on resume", "Assessment score 94%", "Verified by TechLead in Challenge #12"
  verifiedAt?: string;
}

export interface CandidateProfile {
  id: string;
  fullName: string;
  headline: string;
  location: string;
  experienceLevel: 'Beginner' | 'Intermediate' | 'Experienced';
  availability: 'Immediately' | 'Within 2 weeks' | 'Flexible';
  preferredWorkMode: 'Remote' | 'Hybrid' | 'On-site';
  bio: string;
  skills: SkillPassportItem[];
  completedChallengesCount: number;
  githubUrl?: string;
  portfolioUrl?: string;
}

// ─── Task Submission & Review ────────────────────────────────────────────────
export type SubmissionStatus =
  | 'submitted'
  | 'under-review'
  | 'accepted'
  | 'revision-requested'
  | 'rejected';

export interface TaskSubmission {
  id: string;
  taskId: string;
  taskTitle: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  submittedAt: string;
  deliverableUrl: string;
  deliverableNotes: string;
  status: SubmissionStatus;
  reviewNotes?: string;
  feedback?: string;
  rating?: number; // 1 to 5
  reviewedAt?: string;
  endorsedSkill?: string; // The specific skill verified during review
  isVerifiedEndorsed?: boolean;
  isDemoRecord?: boolean;
}

// ─── Workspace Settings ──────────────────────────────────────────────────────
export interface WorkspaceSettings {
  emailNotifications: boolean;
  contributorAlerts: boolean;
  weeklyDigest: boolean;
  stealthMode: boolean;
  allowPublicApplications: boolean;
}

// ─── Top-Level Workspace State ───────────────────────────────────────────────
export interface FounderWorkspaceState {
  version: number;
  founder: FounderProfile;
  accountEmail: string;
  startup: StartupProfile;
  goals: BusinessGoal;
  talentRequirements: TalentRequirement[];
  privacy: FounderPrivacyPreferences;
  projects: Project[];
  tasks: WorkspaceTask[];
  submissions: TaskSubmission[];
  settings: WorkspaceSettings;
  createdAt: string;
  lastUpdatedAt: string;
}
