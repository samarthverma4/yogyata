// ─── Onboarding Types ───────────────────────────────────────────────────────
// Central type definitions for the Job Seeker signup and onboarding flow.

export type OnboardingView =
  | 'landing'          // Role-selection landing page
  | 'signup'           // Step 1: Create account
  | 'verify-email'     // Step 2: OTP verification prototype
  | 'profile'          // Step 3: Professional profile + education
  | 'resume-skills'    // Step 4: Resume upload + declared skills
  | 'career-goals'     // Step 5: Target roles
  | 'job-prefs'        // Step 6: Job preferences
  | 'privacy'          // Step 7: Privacy & visibility (shown inside Review)
  | 'review'           // Step 8: Profile review
  | 'complete';        // Step 9: Completion screen

// ─── Account ─────────────────────────────────────────────────────────────────

export interface AccountData {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  agreedToTerms: boolean;
}

// ─── Professional Profile ────────────────────────────────────────────────────

export type ProfessionalStatus =
  | 'employed'
  | 'actively-looking'
  | 'open-to-opportunities'
  | 'freelancer'
  | 'career-switcher'
  | '';

export type ExperienceLevel =
  | 'fresher'
  | 'less-than-1'
  | '1-2'
  | '3-5'
  | '6-10'
  | 'more-than-10'
  | '';

export interface ProfessionalData {
  status: ProfessionalStatus;
  experience: ExperienceLevel;
  currentTitle: string;
  currentCompany: string;
  headline: string;
  country: string;
  city: string;
}

// ─── Education ───────────────────────────────────────────────────────────────

export type EducationLevel =
  | 'high-school'
  | 'diploma'
  | 'associate'
  | 'bachelor'
  | 'master'
  | 'phd'
  | 'other'
  | '';

export interface EducationData {
  level: EducationLevel;
  degree: string;
  fieldOfStudy: string;
  institution: string;
  graduationYear: string;
  skipEducation: boolean;
}

// ─── Resume & Skills ─────────────────────────────────────────────────────────

export interface ResumeFile {
  name: string;
  sizeBytes: number;
  type: string;
}

export interface DeclaredSkill {
  id: string;
  name: string;
  category: string;
}

export interface ResumeSkillsData {
  resumeFile: ResumeFile | null;
  skills: DeclaredSkill[];
}

// ─── Career Goals ────────────────────────────────────────────────────────────

export interface CareerGoalsData {
  primaryRole: string;
  customPrimaryRole: string;   // When primaryRole === 'other'
  additionalRoles: string[];
}

// ─── Job Preferences ─────────────────────────────────────────────────────────

export type OpportunityType = 'full-time' | 'internship' | 'contract' | 'part-time';
export type WorkMode = 'remote' | 'hybrid' | 'on-site';
export type Availability =
  | 'immediately'
  | 'within-30'
  | 'within-60'
  | 'flexible'
  | '';

export interface JobPrefsData {
  opportunityTypes: OpportunityType[];
  workModes: WorkMode[];
  preferredLocations: string[];
  expectedSalary: string;
  noticePeriod: string;
  availability: Availability;
}

// ─── Privacy ─────────────────────────────────────────────────────────────────

export type VisibilityOption = 'private' | 'discoverable';

export interface PrivacyData {
  visibility: VisibilityOption;
  recruiterSharingConsent: boolean;
  collegeSharingConsent: boolean;
}

// ─── Top-Level Onboarding State ───────────────────────────────────────────────

export interface OnboardingState {
  account: AccountData;
  professional: ProfessionalData;
  education: EducationData;
  resumeSkills: ResumeSkillsData;
  careerGoals: CareerGoalsData;
  jobPrefs: JobPrefsData;
  privacy: PrivacyData;
}

export const INITIAL_ONBOARDING_STATE: OnboardingState = {
  account: {
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreedToTerms: false,
  },
  professional: {
    status: '',
    experience: '',
    currentTitle: '',
    currentCompany: '',
    headline: '',
    country: '',
    city: '',
  },
  education: {
    level: '',
    degree: '',
    fieldOfStudy: '',
    institution: '',
    graduationYear: '',
    skipEducation: false,
  },
  resumeSkills: {
    resumeFile: null,
    skills: [],
  },
  careerGoals: {
    primaryRole: '',
    customPrimaryRole: '',
    additionalRoles: [],
  },
  jobPrefs: {
    opportunityTypes: [],
    workModes: [],
    preferredLocations: [],
    expectedSalary: '',
    noticePeriod: '',
    availability: '',
  },
  privacy: {
    visibility: 'private',
    recruiterSharingConsent: false,
    collegeSharingConsent: false,
  },
};
