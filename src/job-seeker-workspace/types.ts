import type { OnboardingState } from '../onboarding/types';

export type JobSeekerWorkspaceTab =
  | 'overview'
  | 'profile'
  | 'skill-passport'
  | 'assessments'
  | 'career-roadmap'
  | 'opportunities'
  | 'applications'
  | 'settings';

// ─── Profile Types ────────────────────────────────────────────────────────────

export interface JobSeekerProfile {
  fullName: string;
  email: string;
  headline: string;
  bio: string;
  country: string;
  city: string;
  status: string;
  experience: string;
  currentTitle: string;
  currentCompany: string;
  education: {
    level: string;
    degree: string;
    fieldOfStudy: string;
    institution: string;
    graduationYear: string;
  };
  resumeFile: {
    name: string;
    sizeBytes: number;
    uploadedAt: string;
  } | null;
  careerGoals: {
    primaryRole: string;
    additionalRoles: string[];
  };
  jobPrefs: {
    opportunityTypes: string[];
    workModes: string[];
    preferredLocations: string[];
    expectedSalary: string;
    noticePeriod: string;
    availability: string;
  };
}

// ─── Skill Passport Types ─────────────────────────────────────────────────────

export type SkillTier = 'declared' | 'assessed' | 'verified';

export interface JobSeekerSkill {
  id: string;
  name: string;
  category: string;
  tier: SkillTier;
  description: string;
  source: string;
  dateAdded: string;
  relatedProjectOrAssessment?: string;
  scoreOrOutcome?: string;
  verifiedBy?: string;
  verifierNote?: string;
  evidenceUrl?: string;
}

// ─── Assessment Types ─────────────────────────────────────────────────────────

export interface AssessmentQuestion {
  id: string;
  questionText: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
}

export interface SkillAssessment {
  id: string;
  title: string;
  skillCategory: string;
  associatedSkill: string;
  durationMinutes: number;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  description: string;
  instructions: string[];
  questions: AssessmentQuestion[];
}

export interface AssessmentAttempt {
  id: string;
  assessmentId: string;
  assessmentTitle: string;
  associatedSkill: string;
  date: string;
  scorePercent: number;
  passed: boolean;
  totalQuestions: number;
  correctCount: number;
  userAnswers: Record<string, number>;
}

// ─── Career Roadmap Types ─────────────────────────────────────────────────────

export type RoadmapCategory = 'foundation' | 'core-skills' | 'practical-project' | 'assessment' | 'career';

export interface RoadmapMilestone {
  id: string;
  title: string;
  description: string;
  category: RoadmapCategory;
  completed: boolean;
  completedDate?: string;
  isPersonalGoal?: boolean;
  targetDate?: string;
}

// ─── Opportunity & Application Types ──────────────────────────────────────────

export type OpportunityCategory = 'job' | 'internship' | 'startup-project' | 'practical-challenge';
export type WorkArrangement = 'remote' | 'hybrid' | 'on-site';

export interface Opportunity {
  id: string;
  title: string;
  organization: string;
  category: OpportunityCategory;
  description: string;
  requiredSkills: string[];
  experienceRequirement: string;
  workArrangement: WorkArrangement;
  location: string;
  deadline: string;
  isSaved: boolean;
  stipendOrCompensation?: string;
}

export type ApplicationStatus =
  | 'applied'
  | 'in-review'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'withdrawn';

export interface JobApplication {
  id: string;
  opportunityId: string;
  opportunityTitle: string;
  organization: string;
  category: OpportunityCategory;
  appliedDate: string;
  status: ApplicationStatus;
  lastUpdated: string;
  nextAction?: string;
  coverNote?: string;
}

// ─── Settings & Workspace State ───────────────────────────────────────────────

export interface JobSeekerSettings {
  profileVisibility: 'discoverable' | 'private';
  recruiterSharingConsent: boolean;
  collegeSharingConsent: boolean;
  emailAlerts: boolean;
  opportunityAlerts: boolean;
}

export interface JobSeekerWorkspaceState {
  profile: JobSeekerProfile;
  skills: JobSeekerSkill[];
  assessments: SkillAssessment[];
  assessmentAttempts: AssessmentAttempt[];
  roadmap: RoadmapMilestone[];
  opportunities: Opportunity[];
  applications: JobApplication[];
  settings: JobSeekerSettings;
  activeTab?: JobSeekerWorkspaceTab;
}

export type { OnboardingState };
