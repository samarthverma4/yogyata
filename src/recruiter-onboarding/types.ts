export type RecruiterOnboardingStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface RecruiterAccount {
  fullName: string;
  workEmail: string;
  password?: string;
  confirmPassword?: string;
  isSimulatedVerified: boolean;
  verificationCode?: string;
}

export interface RecruiterProfile {
  recruiterName: string;
  jobTitle: string;
  recruitingExperience: string;
  hiringSpecialization: string;
  professionalBio: string;
  linkedInUrl: string;
}

export interface CompanyProfile {
  companyName: string;
  industry: string;
  companySize: string;
  website: string;
  description: string;
  location: string;
  hiringDomains: string[];
  companyStage: string;
  workCultureSummary: string;
}

export interface HiringPreferences {
  rolesCommonlyHired: string[];
  technicalSkillsSought: string[];
  experienceRanges: string[];
  employmentTypes: string[];
  workArrangements: string[];
  preferredLocations: string[];
  hiringPriorities: string[];
}

export interface RecruiterOnboardingState {
  currentStep: RecruiterOnboardingStep;
  account: RecruiterAccount;
  profile: RecruiterProfile;
  company: CompanyProfile;
  hiring: HiringPreferences;
  agreedToGuidelines: boolean;
  isComplete: boolean;
}

export const POPULAR_HIRING_DOMAINS = [
  'Frontend Engineering',
  'Backend Engineering',
  'Full-Stack Development',
  'Data Science & Analytics',
  'Machine Learning & AI',
  'DevOps & Cloud',
  'Product Management',
  'UI/UX Design',
  'Mobile Development (iOS/Android)',
  'Cybersecurity',
  'Quality Assurance',
  'Sales & Business Development',
];

export const POPULAR_TECHNICAL_SKILLS = [
  'React',
  'TypeScript',
  'Node.js',
  'Python',
  'Java',
  'Go',
  'PostgreSQL',
  'MongoDB',
  'AWS',
  'Docker',
  'Kubernetes',
  'GraphQL',
  'FastAPI',
  'Next.js',
  'Tailwind CSS',
  'System Design',
  'CI/CD Pipelines',
  'Data Engineering',
];

export const POPULAR_EXPERIENCE_RANGES = [
  'Intern / Fresher (0-1 yrs)',
  'Early Career / Junior (1-3 yrs)',
  'Mid-Level (3-5 yrs)',
  'Senior (5-8 yrs)',
  'Lead / Staff (8-12 yrs)',
  'Leadership / Director (12+ yrs)',
];

export const EMPLOYMENT_TYPE_OPTIONS = [
  'Full-Time',
  'Contract / C2H',
  'Part-Time',
  'Internship',
  'Freelance / Project-based',
];

export const WORK_ARRANGEMENT_OPTIONS = [
  'Remote First',
  'Hybrid (2-3 days in office)',
  'On-Site / In-Office',
  'Flexible / Location Agnostic',
];

export const HIRING_PRIORITIES_OPTIONS = [
  'Evidenced Practical Skills',
  'Fast-paced Execution',
  'Problem-solving & CS Fundamentals',
  'Domain & Industry Experience',
  'Collaborative Team Spirit',
  'Immediate Joiners',
];

export const INITIAL_RECRUITER_ONBOARDING_STATE: RecruiterOnboardingState = {
  currentStep: 1,
  account: {
    fullName: '',
    workEmail: '',
    password: '',
    confirmPassword: '',
    isSimulatedVerified: false,
    verificationCode: '',
  },
  profile: {
    recruiterName: '',
    jobTitle: 'Technical Talent Acquisition Lead',
    recruitingExperience: '3-5 years',
    hiringSpecialization: 'Engineering & Product',
    professionalBio: '',
    linkedInUrl: '',
  },
  company: {
    companyName: '',
    industry: 'Technology / SaaS',
    companySize: '51-200 employees',
    website: '',
    description: '',
    location: 'Bengaluru, India (Hybrid)',
    hiringDomains: ['Frontend Engineering', 'Backend Engineering'],
    companyStage: 'Series A / Growth',
    workCultureSummary: '',
  },
  hiring: {
    rolesCommonlyHired: ['Senior Frontend Engineer', 'Full-Stack Developer'],
    technicalSkillsSought: ['React', 'TypeScript', 'Node.js', 'PostgreSQL'],
    experienceRanges: ['Mid-Level (3-5 yrs)', 'Senior (5-8 yrs)'],
    employmentTypes: ['Full-Time'],
    workArrangements: ['Hybrid (2-3 days in office)', 'Remote First'],
    preferredLocations: ['Bengaluru', 'Remote (India)', 'Hyderabad'],
    hiringPriorities: ['Evidenced Practical Skills', 'Problem-solving & CS Fundamentals'],
  },
  agreedToGuidelines: false,
  isComplete: false,
};
