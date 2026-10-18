import type {
  RecruiterWorkspaceState,
  CandidateProfile,
  PipelineCandidate,
  Interview,
  Scorecard,
} from './types';
import type { RecruiterOnboardingState } from '../recruiter-onboarding/types';

export const RECRUITER_WORKSPACE_KEY = 'yogyata_recruiter_workspace_data';

export const INITIAL_DEMO_CANDIDATES: CandidateProfile[] = [
  {
    id: 'cand-101',
    name: 'Aarav Patel',
    avatarInitials: 'AP',
    headline: 'Senior Frontend Architect | React & TypeScript Specialist',
    location: 'Bengaluru, India (Open to Hybrid)',
    experienceYears: 5,
    experienceRange: 'Senior (5-8 yrs)',
    skills: ['React', 'TypeScript', 'Next.js', 'System Design', 'Tailwind CSS', 'GraphQL'],
    declaredSkills: ['Tailwind CSS', 'GraphQL', 'Webpack'],
    assessedSkills: ['System Design (Level 4)', 'Algorithms & Data Structures'],
    verifiedSkills: ['React Architecture', 'TypeScript Core'],
    skillEvidence: [
      {
        skillName: 'React Architecture',
        tier: 'verified',
        evidenceType: 'project-submission',
        description: 'Built high-concurrency real-time dashboard module with virtualized DOM and custom hooks. Code reviewed and accepted in YOGYATA verified ecosystem challenge.',
        verifiedDate: '2026-08-14',
        score: '96 / 100',
        sourceUrl: 'https://github.com/aarav-patel/react-performance-suite',
        verifierNote: 'Verified by Principal Engineer via automated test harness and architectural peer audit.',
      },
      {
        skillName: 'TypeScript Core',
        tier: 'verified',
        evidenceType: 'code-challenge',
        description: 'Implemented type-safe AST parser with recursive generics and zero type assertions.',
        verifiedDate: '2026-09-02',
        score: '100% Pass',
        sourceUrl: 'https://github.com/aarav-patel/ts-ast-challenge',
        verifierNote: 'Verified against 48 strict edge-case unit tests.',
      },
      {
        skillName: 'System Design (Level 4)',
        tier: 'assessed',
        evidenceType: 'assessment-test',
        description: 'Standardized assessment on caching, distributed event queues, and multi-region resilience.',
        verifiedDate: '2026-07-20',
        score: '92nd Percentile',
      },
      {
        skillName: 'Tailwind CSS',
        tier: 'declared',
        evidenceType: 'self-claim',
        description: 'Declared on professional portfolio; 4+ years of responsive design usage.',
      },
      {
        skillName: 'GraphQL',
        tier: 'declared',
        evidenceType: 'self-claim',
        description: 'Self-reported schema design and Apollo Client integration.',
      },
    ],
    employmentPreferences: ['Full-Time', 'Hybrid (2-3 days)'],
    careerInterests: ['Fintech Infrastructure', 'Design Systems at Scale'],
    bio: 'Product-minded frontend architect passionate about micro-frontends, rendering optimization, and accessible UI engineering.',
    isSaved: true,
  },
  {
    id: 'cand-102',
    name: 'Priya Sundaram',
    avatarInitials: 'PS',
    headline: 'Full-Stack Engineer | Distributed Systems & Node.js / Go',
    location: 'Hyderabad, India (Remote Available)',
    experienceYears: 4,
    experienceRange: 'Mid-Level (3-5 yrs)',
    skills: ['Node.js', 'Go', 'PostgreSQL', 'Docker', 'Redis', 'AWS'],
    declaredSkills: ['AWS', 'Kubernetes', 'Redis'],
    assessedSkills: ['SQL Query Optimization (Advanced)', 'API Security & OAuth2'],
    verifiedSkills: ['Distributed Message Broker (Go)', 'PostgreSQL Performance'],
    skillEvidence: [
      {
        skillName: 'Distributed Message Broker (Go)',
        tier: 'verified',
        evidenceType: 'project-submission',
        description: 'Developed persistent append-only event broker capable of 45k msg/sec with zero message loss under partition simulation.',
        verifiedDate: '2026-09-19',
        score: 'Verified Benchmark',
        sourceUrl: 'https://github.com/priya-s/go-partition-broker',
        verifierNote: 'Verified benchmark stress-test completed in isolated sandbox environment.',
      },
      {
        skillName: 'PostgreSQL Performance',
        tier: 'verified',
        evidenceType: 'work-evidence',
        description: 'Production query indexing, partitioned table schemas, and connection pooling tuning.',
        verifiedDate: '2026-08-30',
        score: 'Excellence',
      },
      {
        skillName: 'SQL Query Optimization (Advanced)',
        tier: 'assessed',
        evidenceType: 'assessment-test',
        description: 'Proctored assessment covering EXPLAIN ANALYZE, B-Tree vs GIN indexes, and CTE planning.',
        verifiedDate: '2026-06-12',
        score: '89 / 100',
      },
      {
        skillName: 'AWS',
        tier: 'declared',
        evidenceType: 'self-claim',
        description: 'Self-reported experience managing ECS, S3, and CloudFront distributions.',
      },
    ],
    employmentPreferences: ['Full-Time', 'Remote First'],
    careerInterests: ['Real-time Streaming', 'High-throughput Cloud Backends'],
    bio: 'Backend specialist focused on deterministic data pipelines, resilient database modeling, and scalable microservices.',
    isSaved: false,
  },
  {
    id: 'cand-103',
    name: 'Rohan Mehra',
    avatarInitials: 'RM',
    headline: 'Machine Learning Engineer | PyTorch, MLOps & NLP',
    location: 'Bengaluru, India (Hybrid)',
    experienceYears: 3,
    experienceRange: 'Mid-Level (3-5 yrs)',
    skills: ['Python', 'PyTorch', 'FastAPI', 'MLOps', 'Docker', 'HuggingFace'],
    declaredSkills: ['HuggingFace', 'FastAPI'],
    assessedSkills: ['Vector Search & Embeddings', 'Deep Learning Foundations'],
    verifiedSkills: ['Transformer Quantization & Inference Pipeline'],
    skillEvidence: [
      {
        skillName: 'Transformer Quantization & Inference Pipeline',
        tier: 'verified',
        evidenceType: 'project-submission',
        description: 'Built ONNX Runtime INT8 quantization service reducing LLM inference latency by 62% on CPU nodes.',
        verifiedDate: '2026-09-28',
        score: 'Top 5% Practical Challenge',
        sourceUrl: 'https://github.com/rohanm/llm-int8-quant-service',
        verifierNote: 'Verified latency benchmarks validated with automated benchmark runner.',
      },
      {
        skillName: 'Vector Search & Embeddings',
        tier: 'assessed',
        evidenceType: 'assessment-test',
        description: 'Covered HNSW graphs, cosine similarity thresholds, and hybrid sparse-dense retrieval.',
        verifiedDate: '2026-08-01',
        score: '95th Percentile',
      },
      {
        skillName: 'Python',
        tier: 'declared',
        evidenceType: 'self-claim',
        description: 'Self-reported 4 years production scripting, data analysis, and microservices.',
      },
    ],
    employmentPreferences: ['Full-Time'],
    careerInterests: ['Edge AI Inference', 'Domain-Specific LLM Fine-tuning'],
    bio: 'ML engineer bridging the gap between research models and sub-50ms low-latency production APIs.',
    isSaved: true,
  },
  {
    id: 'cand-104',
    name: 'Ananya Deshmukh',
    avatarInitials: 'AD',
    headline: 'Junior Frontend Developer | React & Clean UI Engineering',
    location: 'Pune, India (Open to Relocation)',
    experienceYears: 1.5,
    experienceRange: 'Early Career / Junior (1-3 yrs)',
    skills: ['React', 'JavaScript', 'CSS Modules', 'Git', 'Accessibility'],
    declaredSkills: ['Git', 'Accessibility / WCAG'],
    assessedSkills: ['Modern JavaScript (ES6+)', 'DOM Manipulation'],
    verifiedSkills: ['Accessible Design System Component Library'],
    skillEvidence: [
      {
        skillName: 'Accessible Design System Component Library',
        tier: 'verified',
        evidenceType: 'project-submission',
        description: 'Created 14 WCAG AAA compliant components with keyboard traps, ARIA live regions, and automated axe tests.',
        verifiedDate: '2026-10-05',
        score: '100% Axe Audit',
        sourceUrl: 'https://github.com/ananya-d/accessible-ui-kit',
        verifierNote: 'Screen reader navigation and contrast ratios independently verified in YOGYATA audit.',
      },
      {
        skillName: 'Modern JavaScript (ES6+)',
        tier: 'assessed',
        evidenceType: 'assessment-test',
        description: 'Covered closures, prototypes, EventLoop microtasks, and async generators.',
        verifiedDate: '2026-09-10',
        score: '91 / 100',
      },
    ],
    employmentPreferences: ['Full-Time', 'Hybrid', 'Remote'],
    careerInterests: ['Design Systems', 'Micro-interactions', 'Frontend Accessibility'],
    bio: 'Dedicated junior engineer focused on pixel-perfect, accessible web interfaces and clean component composition.',
    isSaved: false,
  },
  {
    id: 'cand-105',
    name: 'Karan Varma',
    avatarInitials: 'KV',
    headline: 'DevOps & Cloud Reliability Engineer | Kubernetes, Terraform & AWS',
    location: 'Mumbai, India (Remote First)',
    experienceYears: 6,
    experienceRange: 'Senior (5-8 yrs)',
    skills: ['Kubernetes', 'Terraform', 'AWS', 'Prometheus', 'CI/CD', 'Linux'],
    declaredSkills: ['Prometheus', 'Grafana', 'Linux Internals'],
    assessedSkills: ['Kubernetes Cluster Troubleshooting', 'IaC Security Scanning'],
    verifiedSkills: ['Zero-Downtime Blue-Green Deployment Controller'],
    skillEvidence: [
      {
        skillName: 'Zero-Downtime Blue-Green Deployment Controller',
        tier: 'verified',
        evidenceType: 'project-submission',
        description: 'Engineered custom Kubernetes operator managing canary rollouts with automated Prometheus metric health rollbacks.',
        verifiedDate: '2026-07-15',
        score: 'Verified Production Grade',
        sourceUrl: 'https://github.com/karanv/k8s-canary-operator',
        verifierNote: 'Automated chaotic network loss tests passed successfully.',
      },
      {
        skillName: 'IaC Security Scanning',
        tier: 'assessed',
        evidenceType: 'assessment-test',
        description: 'Score based on policy-as-code OPA rules and tfsec misconfiguration remediation.',
        verifiedDate: '2026-05-20',
        score: '93 / 100',
      },
    ],
    employmentPreferences: ['Full-Time', 'Contract / C2H'],
    careerInterests: ['Platform Engineering', 'GitOps at Scale'],
    bio: 'Reliability specialist building self-healing infrastructure, observability stacks, and automated security guardrails.',
    isSaved: false,
  },
];

export const INITIAL_DEMO_PIPELINE: PipelineCandidate[] = [
  {
    id: 'pipe-1',
    candidateId: 'cand-101',
    candidateName: 'Aarav Patel',
    targetRole: 'Senior Frontend Architect',
    stage: 'interview',
    priority: 'high',
    dateAdded: '2026-10-10',
    lastUpdated: '2026-10-16',
    recruiterNotes: 'Exceptional TypeScript and React evidence. System design round scheduled with Lead Architect.',
    nextAction: 'Conduct System Architecture Interview on Oct 22',
    tags: ['Verified React', 'Strong Communicator', 'Immediate Joiner'],
  },
  {
    id: 'pipe-2',
    candidateId: 'cand-102',
    candidateName: 'Priya Sundaram',
    targetRole: 'Senior Backend Engineer (Go / Distributed)',
    stage: 'screening',
    priority: 'high',
    dateAdded: '2026-10-12',
    lastUpdated: '2026-10-15',
    recruiterNotes: 'Verified Go broker project proves deep concurrency skills. Initial recruiter phone screen completed.',
    nextAction: 'Send technical coding challenge invitation',
    tags: ['Distributed Systems', 'Remote First'],
  },
  {
    id: 'pipe-3',
    candidateId: 'cand-103',
    candidateName: 'Rohan Mehra',
    targetRole: 'ML Systems Engineer',
    stage: 'offer',
    priority: 'high',
    dateAdded: '2026-09-28',
    lastUpdated: '2026-10-14',
    recruiterNotes: 'Cleared all rounds with 4.8/5 aggregate scorecard ratings. Drafting formal compensation package.',
    nextAction: 'Finalize equity and base package with Finance Lead',
    tags: ['Strong Hire', 'PyTorch Verified'],
  },
  {
    id: 'pipe-4',
    candidateId: 'cand-104',
    candidateName: 'Ananya Deshmukh',
    targetRole: 'Associate Frontend Developer',
    stage: 'sourced',
    priority: 'medium',
    dateAdded: '2026-10-15',
    lastUpdated: '2026-10-15',
    recruiterNotes: 'Sourced from YOGYATA verified accessibility challenge. Impressive WCAG compliance toolkit.',
    nextAction: 'Review resume and schedule intro screen',
    tags: ['Design Systems', 'Early Career'],
  },
];

export const INITIAL_DEMO_INTERVIEWS: Interview[] = [
  {
    id: 'int-201',
    candidateId: 'cand-101',
    candidateName: 'Aarav Patel',
    targetRole: 'Senior Frontend Architect',
    round: 'system-design',
    date: '2026-10-24',
    startTime: '15:30',
    durationMinutes: 60,
    format: 'video',
    locationOrLink: 'https://meet.google.com/xyz-recruiter-demo',
    assignedInterviewers: ['Shalini Menon (Lead Recruiter)', 'Devendra Sharma (VP Engineering)'],
    agenda: 'Deep dive into micro-frontends architecture, web vitals optimization, and state caching.',
    prepNotes: 'Review Aarav verified React performance benchmark repo prior to the call.',
    status: 'scheduled',
  },
  {
    id: 'int-202',
    candidateId: 'cand-103',
    candidateName: 'Rohan Mehra',
    targetRole: 'ML Systems Engineer',
    round: 'technical-deep-dive',
    date: '2026-10-08',
    startTime: '11:00',
    durationMinutes: 60,
    format: 'video',
    locationOrLink: 'https://meet.google.com/demo-ml-deepdive',
    assignedInterviewers: ['Shalini Menon', 'Dr. Alok Verma (Chief AI Scientist)'],
    agenda: 'Quantization trade-offs, INT8 matrix engines, and real-time streaming tokens.',
    prepNotes: 'Evaluated hands-on inference profiling code.',
    status: 'completed',
  },
  {
    id: 'int-203',
    candidateId: 'cand-102',
    candidateName: 'Priya Sundaram',
    targetRole: 'Senior Backend Engineer (Go / Distributed)',
    round: 'initial-screening',
    date: '2026-10-11',
    startTime: '16:00',
    durationMinutes: 30,
    format: 'phone',
    locationOrLink: '+91 98765 43210',
    assignedInterviewers: ['Shalini Menon'],
    agenda: 'Discuss current career trajectory, compensation expectations, and notice period.',
    prepNotes: 'Candidate is currently on a 30-day notice period.',
    status: 'completed',
  },
];

export const INITIAL_DEMO_SCORECARDS: Scorecard[] = [
  {
    id: 'sc-301',
    candidateId: 'cand-103',
    candidateName: 'Rohan Mehra',
    interviewId: 'int-202',
    targetRole: 'ML Systems Engineer',
    round: 'technical-deep-dive',
    interviewerName: 'Dr. Alok Verma (Chief AI Scientist)',
    technicalRating: 5,
    problemSolvingRating: 5,
    communicationRating: 4,
    roleAlignmentRating: 5,
    strengths: 'Outstanding grasp of low-level GPU memory alignment and ONNX graph optimization. Answered every edge case with clear experimental evidence.',
    areasOfConcern: 'Slightly less familiarity with older distributed Celery queues, but eager to standardize on Ray/KubeFlow.',
    interviewNotes: 'Strongest ML systems interview this year. Demonstrated real benchmarks from his verified portfolio project.',
    recommendation: 'strong-hire',
    submittedAt: '2026-10-08T12:15:00.000Z',
  },
  {
    id: 'sc-302',
    candidateId: 'cand-102',
    candidateName: 'Priya Sundaram',
    interviewId: 'int-203',
    targetRole: 'Senior Backend Engineer (Go / Distributed)',
    round: 'initial-screening',
    interviewerName: 'Shalini Menon (Lead Recruiter)',
    technicalRating: 4,
    problemSolvingRating: 4,
    communicationRating: 5,
    roleAlignmentRating: 4,
    strengths: 'Articulate communicator with clear career milestones. Demonstrated deep curiosity about our microservices scaling roadmap.',
    areasOfConcern: 'Requires full remote arrangement or max 1 day/mo in office.',
    interviewNotes: 'Recommended advancing to deep dive technical round. Culture and communication skills are top tier.',
    recommendation: 'hire',
    submittedAt: '2026-10-11T16:45:00.000Z',
  },
];

export function createInitialRecruiterDemoData(): RecruiterWorkspaceState {
  return {
    recruiter: {
      recruiterName: 'Shalini Menon',
      jobTitle: 'Lead Technical Talent Partner',
      recruitingExperience: '5-8 years',
      hiringSpecialization: 'Engineering & Product',
      professionalBio: 'Specializing in connecting high-caliber software architects, full-stack builders, and data specialists with mission-driven tech teams.',
      linkedInUrl: 'https://linkedin.com/in/shalini-menon-demo',
    },
    company: {
      companyName: 'HyperScale Cloud Labs',
      industry: 'Technology / SaaS',
      companySize: '51-200 employees',
      website: 'https://hyperscalelabs.io',
      description: 'Building next-generation distributed database tooling and edge observability infrastructure for modern cloud-native enterprises.',
      location: 'Bengaluru, India (Hybrid)',
      hiringDomains: ['Frontend Engineering', 'Backend Engineering', 'Cloud, DevOps & Security'],
      companyStage: 'Series A / Growth',
      workCultureSummary: 'High-autonomy engineering culture with heavy emphasis on verifiable skills, open-source contributions, and engineering excellence.',
    },
    hiring: {
      rolesCommonlyHired: ['Senior Frontend Architect', 'Senior Backend Engineer (Go / Distributed)', 'ML Systems Engineer'],
      technicalSkillsSought: ['React', 'TypeScript', 'Node.js', 'Go', 'Kubernetes', 'System Design'],
      experienceRanges: ['Mid-Level (3-5 yrs)', 'Senior (5-8 yrs)'],
      employmentTypes: ['Full-Time'],
      workArrangements: ['Hybrid (2-3 days in office)', 'Remote First'],
      preferredLocations: ['Bengaluru', 'Remote (India)', 'Hyderabad'],
      hiringPriorities: ['Evidenced Practical Skills', 'Problem-solving & CS Fundamentals'],
    },
    candidates: INITIAL_DEMO_CANDIDATES,
    pipeline: INITIAL_DEMO_PIPELINE,
    interviews: INITIAL_DEMO_INTERVIEWS,
    scorecards: INITIAL_DEMO_SCORECARDS,
    settings: {
      defaultInterviewDuration: 60,
      defaultInterviewFormat: 'video',
      defaultHiringFilterRole: 'All Roles',
      simulatedNotifications: {
        newApplications: true,
        interviewReminders: true,
        scorecardAlerts: true,
      },
      candidateVisibility: 'public',
    },
  };
}

/**
 * Initializes workspace state using data gathered in Recruiter Onboarding.
 */
export function initializeRecruiterWorkspaceFromOnboarding(
  onboarding: RecruiterOnboardingState
): RecruiterWorkspaceState {
  const base = createInitialRecruiterDemoData();
  return {
    ...base,
    recruiter: {
      recruiterName: onboarding.profile.recruiterName || onboarding.account.fullName || 'Recruiter Lead',
      jobTitle: onboarding.profile.jobTitle || 'Technical Talent Acquisition Lead',
      recruitingExperience: onboarding.profile.recruitingExperience || '3-5 years',
      hiringSpecialization: onboarding.profile.hiringSpecialization || 'Engineering & Product',
      professionalBio: onboarding.profile.professionalBio || 'Building world-class technical teams through evidence-based candidate discovery.',
      linkedInUrl: onboarding.profile.linkedInUrl || '',
    },
    company: {
      companyName: onboarding.company.companyName || 'Your Company',
      industry: onboarding.company.industry || 'Technology / SaaS',
      companySize: onboarding.company.companySize || '51-200 employees',
      website: onboarding.company.website || 'https://example.com',
      description: onboarding.company.description || 'Forward-thinking tech organization hiring verified talent.',
      location: onboarding.company.location || 'Bengaluru, India',
      hiringDomains: onboarding.company.hiringDomains.length > 0 ? onboarding.company.hiringDomains : ['Frontend Engineering', 'Backend Engineering'],
      companyStage: onboarding.company.companyStage || 'Series A / Growth',
      workCultureSummary: onboarding.company.workCultureSummary || 'Collaborative, evidence-first engineering team.',
    },
    hiring: {
      rolesCommonlyHired: onboarding.hiring.rolesCommonlyHired.length > 0 ? onboarding.hiring.rolesCommonlyHired : ['Senior Frontend Engineer'],
      technicalSkillsSought: onboarding.hiring.technicalSkillsSought.length > 0 ? onboarding.hiring.technicalSkillsSought : ['React', 'TypeScript'],
      experienceRanges: onboarding.hiring.experienceRanges.length > 0 ? onboarding.hiring.experienceRanges : ['Mid-Level (3-5 yrs)'],
      employmentTypes: onboarding.hiring.employmentTypes.length > 0 ? onboarding.hiring.employmentTypes : ['Full-Time'],
      workArrangements: onboarding.hiring.workArrangements.length > 0 ? onboarding.hiring.workArrangements : ['Hybrid (2-3 days in office)'],
      preferredLocations: onboarding.hiring.preferredLocations.length > 0 ? onboarding.hiring.preferredLocations : ['Bengaluru'],
      hiringPriorities: onboarding.hiring.hiringPriorities.length > 0 ? onboarding.hiring.hiringPriorities : ['Evidenced Practical Skills'],
    },
  };
}

/**
 * Loads the recruiter workspace state from localStorage.
 */
export function loadRecruiterWorkspace(): RecruiterWorkspaceState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(RECRUITER_WORKSPACE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.recruiter || !parsed.company || !Array.isArray(parsed.pipeline)) {
      return null;
    }
    return parsed as RecruiterWorkspaceState;
  } catch (err) {
    console.warn('[RecruiterWorkspace] Corrupted storage, falling back:', err);
    return null;
  }
}

/**
 * Saves the recruiter workspace state to localStorage.
 */
export function saveRecruiterWorkspace(state: RecruiterWorkspaceState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(RECRUITER_WORKSPACE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('[RecruiterWorkspace] Error saving workspace state:', err);
  }
}

/**
 * Resets the recruiter workspace state to factory seed demo data.
 */
export function resetRecruiterWorkspaceToDemo(): RecruiterWorkspaceState {
  const demo = createInitialRecruiterDemoData();
  saveRecruiterWorkspace(demo);
  return demo;
}

/**
 * Clears the recruiter workspace from localStorage.
 */
export function clearRecruiterWorkspace(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(RECRUITER_WORKSPACE_KEY);
  } catch (err) {
    console.error('[RecruiterWorkspace] Error clearing workspace state:', err);
  }
}
