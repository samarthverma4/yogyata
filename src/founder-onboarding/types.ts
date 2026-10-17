// ─── Founder Onboarding Types ──────────────────────────────────────────────────
// Strongly-typed state structures for the Founder / Entrepreneur onboarding journey.

export type FounderOnboardingView =
  | 'signup'         // Step 1: Founder Signup
  | 'verify-email'   // Step 2: Email Verification Prototype
  | 'profile'        // Step 3: Founder Personal Profile
  | 'startup'        // Step 4: Startup / Venture Details
  | 'goals'          // Step 5: Business Goals
  | 'talent'         // Step 6: Talent & Team Requirements
  | 'task'           // Step 7: Optional Project Task Creation
  | 'review'         // Step 8 & 9: Privacy & Final Review
  | 'complete';      // Step 10: Onboarding Completion

// ─── Account Data ─────────────────────────────────────────────────────────────
export interface FounderAccount {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  phoneNumber?: string;
  agreedToTerms: boolean;
}

// ─── Founder Profile ──────────────────────────────────────────────────────────
export interface FounderProfile {
  fullName: string;
  professionalTitle: string;
  profilePhotoName?: string;
  profilePhotoUrl?: string;
  bio?: string;
  linkedInUrl?: string;
  country: string;
  city: string;
}

// ─── Startup Profile ──────────────────────────────────────────────────────────
export type StartupStage =
  | 'Idea Stage'
  | 'Pre-seed'
  | 'Seed'
  | 'Early-stage'
  | 'Growing Business'
  | 'Other'
  | '';

export type TeamSize =
  | 'Just me'
  | '2–5'
  | '6–10'
  | '11–25'
  | '26+'
  | '';

export type FounderWorkMode = 'remote' | 'hybrid' | 'on-site' | '';

export interface StartupProfile {
  startupName: string;
  logoName?: string;
  logoUrl?: string;
  industry: string;
  customIndustry?: string;
  websiteUrl?: string;
  description: string;
  stage: StartupStage;
  teamSize: TeamSize;
  country: string;
  city: string;
  workMode: FounderWorkMode;
}

// ─── Business Goals ───────────────────────────────────────────────────────────
export interface BusinessGoal {
  primaryGoal: string;
  customPrimaryGoal?: string;
  projectDescription: string;
  projectCategory: string;
  projectLink?: string;
}

// ─── Talent Requirements ──────────────────────────────────────────────────────
export type ExperiencePreference = 'beginner' | 'intermediate' | 'experienced' | 'flexible';
export type RequirementWorkArrangement = 'remote' | 'hybrid' | 'on-site' | 'flexible';
export type EngagementType = 'project-based' | 'part-time' | 'full-time' | 'freelance' | 'co-founder';
export type CompensationType = 'paid' | 'unpaid' | 'to-be-discussed';

export interface TalentRequirement {
  id: string;
  roleTitle: string;
  requiredSkills: string[];
  contributorsCount: string;
  experiencePreference: ExperiencePreference;
  workArrangement: RequirementWorkArrangement;
  engagementType: EngagementType;
  compensation: CompensationType;
  duration?: string;
  startDate?: string;
}

// ─── Project Task Draft (Optional) ───────────────────────────────────────────
export interface ProjectTaskDraft {
  isSkipped: boolean;
  taskTitle: string;
  problemStatement: string;
  requiredSkills: string[];
  expectedDeliverable: string;
  evaluationCriteria: string;
  deadline?: string;
  compensationModel: 'paid' | 'unpaid' | 'unspecified';
  rewardDetails?: string;
  relatedProjectLink?: string;
}

// ─── Privacy & Visibility ─────────────────────────────────────────────────────
export type FounderProfileVisibility = 'private' | 'discoverable';
export type ProjectVisibility = 'private' | 'discoverable';

export interface FounderPrivacyPreferences {
  profileVisibility: FounderProfileVisibility;
  projectVisibility: ProjectVisibility;
  allowContactSharing: boolean;
  receiveContributorExpressions: boolean;
}

// ─── Top-Level State ──────────────────────────────────────────────────────────
export interface FounderOnboardingState {
  account: FounderAccount;
  profile: FounderProfile;
  startup: StartupProfile;
  goals: BusinessGoal;
  talentRequirements: TalentRequirement[];
  taskDraft: ProjectTaskDraft;
  privacy: FounderPrivacyPreferences;
}

export const INITIAL_FOUNDER_ONBOARDING_STATE: FounderOnboardingState = {
  account: {
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phoneNumber: '',
    agreedToTerms: false,
  },
  profile: {
    fullName: '',
    professionalTitle: '',
    profilePhotoName: '',
    profilePhotoUrl: '',
    bio: '',
    linkedInUrl: '',
    country: '',
    city: '',
  },
  startup: {
    startupName: '',
    logoName: '',
    logoUrl: '',
    industry: '',
    customIndustry: '',
    websiteUrl: '',
    description: '',
    stage: '',
    teamSize: '',
    country: '',
    city: '',
    workMode: '',
  },
  goals: {
    primaryGoal: '',
    customPrimaryGoal: '',
    projectDescription: '',
    projectCategory: '',
    projectLink: '',
  },
  talentRequirements: [],
  taskDraft: {
    isSkipped: true,
    taskTitle: '',
    problemStatement: '',
    requiredSkills: [],
    expectedDeliverable: '',
    evaluationCriteria: '',
    deadline: '',
    compensationModel: 'unspecified',
    rewardDetails: '',
    relatedProjectLink: '',
  },
  privacy: {
    profileVisibility: 'private',
    projectVisibility: 'private',
    allowContactSharing: false,
    receiveContributorExpressions: true,
  },
};
