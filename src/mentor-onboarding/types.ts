// ─── Mentor Onboarding Types ────────────────────────────────────────────────

export type MentorOnboardingView =
  | 'account'
  | 'verify-email'
  | 'profile'
  | 'expertise'
  | 'tracks'
  | 'review'
  | 'complete';

export interface MentorAccount {
  fullName: string;
  email: string;
  password?: string;
  confirmPassword?: string;
  agreedToTerms: boolean;
}

export interface MentorProfile {
  headline: string;
  currentRole: string;
  organization?: string;
  yearsOfExperience: number | '';
  bio: string;
  linkedInUrl?: string;
  portfolioUrl?: string;
  avatarUrl?: string;
}

export interface MentorExpertise {
  expertiseAreas: string[];
  technicalSkills: string[];
  industries: string[];
  languages: string[];
  experienceLevel: 'Senior' | 'Lead / Staff' | 'Principal / Director' | 'Executive / Founder';
}

export type SessionFormat = 'online' | 'flexible';
export type SessionFrequency = 'weekly' | 'biweekly' | 'monthly' | 'as-needed';
export type PricingModel = 'free' | 'paid' | 'selective-scholarship';

export interface MentorshipPreferences {
  selectedTracks: string[];
  preferredMenteeLevels: ('Beginner' | 'Intermediate' | 'Advanced')[];
  sessionFormat: SessionFormat;
  sessionDurationMinutes: number; // 30, 45, 60
  sessionFrequency: SessionFrequency;
  weeklyAvailabilityHours: number;
  maxActiveMentees: number;
  pricingModel: PricingModel;
  hourlyRate?: string;
}

export interface MentorOnboardingState {
  account: MentorAccount;
  profile: MentorProfile;
  expertise: MentorExpertise;
  preferences: MentorshipPreferences;
}

export const INITIAL_MENTOR_ONBOARDING_STATE: MentorOnboardingState = {
  account: {
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreedToTerms: false,
  },
  profile: {
    headline: '',
    currentRole: '',
    organization: '',
    yearsOfExperience: '',
    bio: '',
    linkedInUrl: '',
    portfolioUrl: '',
    avatarUrl: '',
  },
  expertise: {
    expertiseAreas: ['System Design', 'Web Development'],
    technicalSkills: ['React', 'TypeScript', 'Node.js'],
    industries: ['Software / SaaS', 'AI & Machine Learning'],
    languages: ['English'],
    experienceLevel: 'Lead / Staff',
  },
  preferences: {
    selectedTracks: [
      'Technical Interview Preparation',
      'Project Guidance',
      'Full-Stack Development',
    ],
    preferredMenteeLevels: ['Beginner', 'Intermediate'],
    sessionFormat: 'online',
    sessionDurationMinutes: 45,
    sessionFrequency: 'weekly',
    weeklyAvailabilityHours: 4,
    maxActiveMentees: 3,
    pricingModel: 'free',
    hourlyRate: '',
  },
};

export const POPULAR_EXPERTISE_AREAS = [
  'System Design',
  'Frontend Architecture',
  'Backend & Microservices',
  'AI & Machine Learning',
  'Data Science & Analytics',
  'Product Strategy',
  'Career Transition',
  'DevOps & Cloud',
  'UI/UX Design Systems',
  'Engineering Leadership',
];

export const POPULAR_TECHNICAL_SKILLS = [
  'React',
  'TypeScript',
  'Node.js',
  'Python',
  'Go',
  'Java',
  'SQL & Databases',
  'Docker & K8s',
  'AWS / GCP',
  'GraphQL',
  'REST APIs',
  'Tailwind CSS',
  'Next.js',
  'PyTorch',
];

export const POPULAR_INDUSTRIES = [
  'Software / SaaS',
  'AI & DeepTech',
  'FinTech',
  'HealthTech',
  'E-Commerce',
  'EdTech',
  'CleanTech',
  'Enterprise Software',
];

export const AVAILABLE_MENTORSHIP_TRACKS = [
  {
    id: 'career-launch',
    title: 'Career Launch & Early Guidance',
    description: 'Help new graduates and career switchers break into tech with clarity and momentum.',
  },
  {
    id: 'tech-interview-prep',
    title: 'Technical Interview Preparation',
    description: 'Mock interviews, algorithmic problem solving, and architecture case studies.',
  },
  {
    id: 'project-guidance',
    title: 'Practical Project Guidance',
    description: 'Code reviews, architectural critique, and delivery support for portfolio projects.',
  },
  {
    id: 'resume-portfolio',
    title: 'Resume & Portfolio Review',
    description: 'Actionable feedback to turn standard resumes into evidenced proof of capability.',
  },
  {
    id: 'ai-ml-career',
    title: 'AI / ML Career Path',
    description: 'Guidance on model building, data pipelines, LLM integration, and ML engineering.',
  },
  {
    id: 'fullstack-dev',
    title: 'Full-Stack Development Mastery',
    description: 'Hands-on pairing on robust frontend, secure backend APIs, and modern toolchains.',
  },
  {
    id: 'startup-thinking',
    title: 'Startup & Product Thinking',
    description: 'Fostering product intuition, customer discovery, and pragmatic MVP scoping.',
  },
  {
    id: 'leadership-growth',
    title: 'Communication & Leadership Growth',
    description: 'Soft skills, cross-functional stakeholder management, and transition to senior roles.',
  },
];
