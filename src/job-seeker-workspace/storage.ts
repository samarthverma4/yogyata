import type {
  JobSeekerWorkspaceState,
  JobSeekerSkill,
  SkillAssessment,
  RoadmapMilestone,
  Opportunity,
  JobApplication,
} from './types';
import type { OnboardingState } from '../onboarding/types';

export const JOB_SEEKER_WORKSPACE_KEY = 'yogyata_job_seeker_workspace_data';
export const JOB_SEEKER_ONBOARDING_DRAFT_KEY = 'yogyata_job_seeker_onboarding_draft';

// ─── Sanitization Utility ─────────────────────────────────────────────────────

export function sanitizeUrl(rawUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '#';
  const trimmed = rawUrl.trim();
  if (
    trimmed.toLowerCase().startsWith('javascript:') ||
    trimmed.toLowerCase().startsWith('data:') ||
    trimmed.toLowerCase().startsWith('vbscript:')
  ) {
    return '#';
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

// ─── Seed Assessments ─────────────────────────────────────────────────────────

export const SEED_ASSESSMENTS: SkillAssessment[] = [
  {
    id: 'assess-react',
    title: 'Frontend Architecture & Modern React',
    skillCategory: 'Frontend Development',
    associatedSkill: 'React',
    durationMinutes: 15,
    difficulty: 'Intermediate',
    description:
      'Evaluate component lifecycle, hooks mechanics, virtual DOM performance, and state container architecture.',
    instructions: [
      'Each question has 4 options with exactly one correct answer.',
      'You can navigate back and forth between questions before submitting.',
      'Your final score is calculated from your actual selected answers.',
      'Passing score: 75% or higher (at least 3 of 4 questions correct).',
    ],
    questions: [
      {
        id: 'q-react-1',
        questionText:
          'What is the primary architectural purpose of the useMemo hook in React?',
        options: [
          'To cache asynchronous network responses between page navigations',
          'To memoize the calculated result of an expensive calculation between re-renders',
          'To automatically prevent child components from ever re-rendering',
          'To trigger an effect immediately after DOM mutations occur',
        ],
        correctOptionIndex: 1,
        explanation:
          'useMemo caches the result of a synchronous calculation between renders unless its dependencies change.',
      },
      {
        id: 'q-react-2',
        questionText:
          'Why should you avoid using array indices as the key prop for dynamically changing lists?',
        options: [
          'It causes React to throw a fatal runtime compilation error',
          'Indices can cause reordering bugs and suboptimal reconciliation when items are inserted or removed',
          'Array keys are restricted to string types in strict TypeScript mode',
          'It slows down browser JavaScript garbage collection across render cycles',
        ],
        correctOptionIndex: 1,
        explanation:
          'Using indices can lead to UI bugs and state mix-ups when items are reordered, inserted, or removed because React matches elements by key.',
      },
      {
        id: 'q-react-3',
        questionText:
          'In a custom React hook, which of the following rules MUST be respected?',
        options: [
          'The hook name must start with "use" and call other hooks unconditionally at the top level',
          'The hook must always return a JSX element or null',
          'The hook must be wrapped inside React.memo or forwardRef',
          'Hooks must only be invoked inside async event listener handlers',
        ],
        correctOptionIndex: 0,
        explanation:
          'Hooks must follow the Rules of Hooks: start with "use" and only be called at the top level of function components or other hooks.',
      },
      {
        id: 'q-react-4',
        questionText:
          'What happens during the "commit" phase of React 18 Concurrent Rendering?',
        options: [
          'React calculates the virtual DOM diff and yields to the browser main thread',
          'React applies mutations to the actual DOM and synchronously runs useLayoutEffect',
          'React bundles the production JavaScript chunks into memory',
          'React cancels previous user input events in the queue',
        ],
        correctOptionIndex: 1,
        explanation:
          'The commit phase is synchronous and applies mutations directly to the host DOM tree and triggers layout effects.',
      },
    ],
  },
  {
    id: 'assess-ts',
    title: 'TypeScript Type Safety & Advanced Generics',
    skillCategory: 'Programming Languages',
    associatedSkill: 'TypeScript',
    durationMinutes: 15,
    difficulty: 'Advanced',
    description:
      'Benchmark your understanding of mapped types, conditional types, Discriminated Unions, and type narrowing.',
    instructions: [
      'Evaluate edge cases and compiler behavior for static typing.',
      'Four multiple-choice questions with full answer keys.',
      'Passing score: 75% or higher.',
    ],
    questions: [
      {
        id: 'q-ts-1',
        questionText:
          'What is the difference between "unknown" and "any" in TypeScript?',
        options: [
          '"unknown" is identical to "any" but only supported in TypeScript 5+',
          '"unknown" requires type narrowing before performing operations, whereas "any" bypasses all type checks',
          '"any" is type-safe whereas "unknown" disables the TypeScript type-checker completely',
          '"unknown" can only hold primitive strings and numbers',
        ],
        correctOptionIndex: 1,
        explanation:
          '"unknown" is the type-safe counterpart of any. Anything can be assigned to unknown, but no operations are allowed without narrowing first.',
      },
      {
        id: 'q-ts-2',
        questionText:
          'What does the conditional type expression "T extends U ? X : Y" evaluate when T is a union type?',
        options: [
          'It throws a compile-time syntax error unless parenthesized',
          'It distributes the condition over each member of the union (distributive conditional types)',
          'It evaluates only the first item in the union and discards the rest',
          'It collapses the union into the "never" type automatically',
        ],
        correctOptionIndex: 1,
        explanation:
          'When naked type parameters are checked in conditional types, they distribute over union types: (A | B) extends U ? X : Y => (A extends U ? X : Y) | (B extends U ? X : Y).',
      },
      {
        id: 'q-ts-3',
        questionText:
          'Which utility type constructs a type with all properties of T set to optional?',
        options: ['Required<T>', 'Partial<T>', 'Readonly<T>', 'Omit<T, undefined>'],
        correctOptionIndex: 1,
        explanation: 'Partial<T> makes all properties in T optional using mapped type syntax { [P in keyof T]?: T[P] }.',
      },
      {
        id: 'q-ts-4',
        questionText:
          'How does a Discriminated Union enable safe type narrowing in a switch statement?',
        options: [
          'By using a shared literal property (discriminant) present on all union variants',
          'By generating runtime regex assertions in the output JavaScript',
          'By converting all properties to strings at runtime',
          'By requiring an explicit "as const" cast on every case statement',
        ],
        correctOptionIndex: 0,
        explanation:
          'A discriminated union contains a common singleton property (like kind, type, or status) that the TypeScript compiler uses to narrow types in branches.',
      },
    ],
  },
  {
    id: 'assess-js',
    title: 'Modern JavaScript & Event Loop Mechanics',
    skillCategory: 'Core Web Engineering',
    associatedSkill: 'JavaScript',
    durationMinutes: 12,
    difficulty: 'Intermediate',
    description:
      'Test your knowledge of microtasks, Promises, closures, prototypal inheritance, and ES6+ features.',
    instructions: [
      'Focus on asynchronous execution order and memory reference rules.',
      'Passing score: 75%.',
    ],
    questions: [
      {
        id: 'q-js-1',
        questionText:
          'In what order do Promise callbacks (microtasks) and setTimeout callbacks (macrotasks) execute after synchronous code finishes?',
        options: [
          'All macrotasks run before any microtasks are checked',
          'All pending microtasks in the microtask queue run before the next macrotask is dequeued',
          'They alternate strictly one-by-one in FIFO order',
          'Order depends randomly on system CPU load',
        ],
        correctOptionIndex: 1,
        explanation:
          'The microtask queue is drained completely after the synchronous call stack empties and before the event loop picks the next macrotask.',
      },
      {
        id: 'q-js-2',
        questionText:
          'What happens when a variable declared with "const" holds an object and a property is mutated?',
        options: [
          'A TypeError is thrown because const makes the entire object deeply immutable',
          'The mutation succeeds because const prevents reassignment of the variable binding, not deep mutation',
          'The mutation is silently ignored in non-strict mode',
          'The object is automatically cloned into a new memory location',
        ],
        correctOptionIndex: 1,
        explanation:
          '"const" only guarantees that the identifier reference cannot be reassigned; nested properties of objects or arrays can still be mutated unless Object.freeze is used.',
      },
      {
        id: 'q-js-3',
        questionText:
          'What is a JavaScript closure?',
        options: [
          'A syntax for terminating loops early using the break keyword',
          'A function combined with references to its surrounding lexical state (lexical environment)',
          'A method to immediately destroy unused variables to prevent memory leaks',
          'An event listener attached to the window beforeunload event',
        ],
        correctOptionIndex: 1,
        explanation:
          'A closure is the combination of a function bundled together with references to its lexical environment, giving access to an outer function scope from an inner function.',
      },
      {
        id: 'q-js-4',
        questionText:
          'What is the return value of Promise.all() when one of the input promises rejects?',
        options: [
          'It waits for all other promises to resolve and ignores the rejection',
          'It immediately rejects with the reason of the first promise that rejected',
          'It returns an array with undefined for the rejected promise',
          'It automatically retries the rejected promise up to 3 times',
        ],
        correctOptionIndex: 1,
        explanation:
          'Promise.all fails-fast: as soon as any promise in the iterable rejects, the returned promise immediately rejects with that error.',
      },
    ],
  },
];

// ─── Seed Opportunities ───────────────────────────────────────────────────────

export const SEED_OPPORTUNITIES: Opportunity[] = [
  {
    id: 'opp-101',
    title: 'Frontend Engineer (React & TypeScript)',
    organization: 'Nexus AI Innovations',
    category: 'job',
    description:
      'Join our core talent platform team building real-time collaboration dashboards, interactive skill graphs, and responsive enterprise interfaces.',
    requiredSkills: ['React', 'TypeScript', 'CSS', 'System Design'],
    experienceRequirement: '1-3 years or evidenced skill projects',
    workArrangement: 'hybrid',
    location: 'Bengaluru, India (Hybrid)',
    deadline: '2026-11-15',
    isSaved: true,
    stipendOrCompensation: '₹14 - 18 LPA',
  },
  {
    id: 'opp-102',
    title: 'Full-Stack Developer Intern',
    organization: 'Apex Cloud Systems',
    category: 'internship',
    description:
      'Hands-on 6-month engineering internship working with Node.js microservices, PostgreSQL query optimization, and React client modules with mentorship.',
    requiredSkills: ['JavaScript', 'Node.js', 'PostgreSQL', 'React'],
    experienceRequirement: 'Fresher / Student with project portfolio',
    workArrangement: 'remote',
    location: 'Remote (India)',
    deadline: '2026-11-20',
    isSaved: false,
    stipendOrCompensation: '₹35,000 / month',
  },
  {
    id: 'opp-103',
    title: 'Ecosystem Challenge: AST Code Parser',
    organization: 'YOGYATA Skill Lab',
    category: 'practical-challenge',
    description:
      'Build a recursive TypeScript AST parser with custom linting rules. Passing automated edge-case test suites unlocks an official Verified Skill credential.',
    requiredSkills: ['TypeScript', 'Algorithms & Data Structures'],
    experienceRequirement: 'Open to all skill levels',
    workArrangement: 'remote',
    location: 'Online Assessment Lab',
    deadline: '2026-12-01',
    isSaved: false,
    stipendOrCompensation: 'Verified Skill Passport & Peer Audit',
  },
  {
    id: 'opp-104',
    title: 'Early Stage Startup: FinTech Ledger Module',
    organization: 'FinStack Labs',
    category: 'startup-project',
    description:
      'Collaborate directly with an early-stage founder on an open task brief: build an immutable transaction audit log UI with CSV exports.',
    requiredSkills: ['React', 'TypeScript', 'Tailwind CSS'],
    experienceRequirement: 'Project portfolio or assessed skills',
    workArrangement: 'remote',
    location: 'Remote',
    deadline: '2026-11-30',
    isSaved: false,
    stipendOrCompensation: '₹45,000 Milestone Bonus',
  },
  {
    id: 'opp-105',
    title: 'Junior Backend Engineer',
    organization: 'CodeCraft Studio',
    category: 'job',
    description:
      'Maintain REST & GraphQL APIs, implement automated unit and integration tests, and optimize database indexing pipelines.',
    requiredSkills: ['Node.js', 'PostgreSQL', 'JavaScript', 'Docker'],
    experienceRequirement: '1-2 years',
    workArrangement: 'on-site',
    location: 'Hyderabad, India',
    deadline: '2026-11-18',
    isSaved: false,
    stipendOrCompensation: '₹10 - 14 LPA',
  },
];

// ─── Default Roadmap Generator ────────────────────────────────────────────────

export function generateDefaultRoadmap(targetRole: string = 'Frontend Engineer'): RoadmapMilestone[] {
  return [
    {
      id: 'road-1',
      title: 'Complete Candidate Profile & Skill Self-Declaration',
      description: 'Detail your education, headline, and self-declare core skills to initialize your talent passport.',
      category: 'foundation',
      completed: true,
      completedDate: '2026-10-18',
    },
    {
      id: 'road-2',
      title: 'Take Frontend Architecture Skill Assessment',
      description: 'Complete the 15-minute diagnostic test to benchmark React skills from Declared to Assessed.',
      category: 'assessment',
      completed: false,
    },
    {
      id: 'road-3',
      title: 'Prove Practical Skills via AST Code Parser Challenge',
      description: 'Submit an accepted solution to the YOGYATA Skill Lab code challenge to earn your first Verified Skill credential.',
      category: 'practical-project',
      completed: false,
    },
    {
      id: 'road-4',
      title: 'Benchmark TypeScript Type Safety',
      description: 'Test advanced generics, conditional types, and union narrowing with the diagnostic assessment.',
      category: 'core-skills',
      completed: false,
    },
    {
      id: 'road-5',
      title: `Apply to 3 Verified Openings in ${targetRole}`,
      description: 'Explore opportunities on YOGYATA with verified organizations and submit applications backed by proof.',
      category: 'career',
      completed: false,
    },
  ];
}

// ─── Initial Demo Factory ─────────────────────────────────────────────────────

export function createDemoJobSeekerWorkspace(): JobSeekerWorkspaceState {
  const initialSkills: JobSeekerSkill[] = [
    {
      id: 'skill-react',
      name: 'React',
      category: 'Frontend Development',
      tier: 'verified',
      description:
        'Built virtualized performance dashboard with custom hooks and zero-regression automated test coverage.',
      source: 'YOGYATA Skill Lab Project Brief',
      dateAdded: '2026-09-12',
      scoreOrOutcome: 'Top 5% Performance (96/100)',
      verifiedBy: 'YOGYATA Architectural Peer Audit',
      verifierNote: 'Verified by Principal Engineer via automated test harness and architectural code review.',
      evidenceUrl: 'https://github.com/rahul-sharma/react-virtualized-suite',
    },
    {
      id: 'skill-ts',
      name: 'TypeScript',
      category: 'Programming Languages',
      tier: 'assessed',
      description:
        'Completed standardized diagnostic assessment on mapped types, conditional types, and generics.',
      source: 'YOGYATA Skill Diagnostic Assessment',
      dateAdded: '2026-09-28',
      scoreOrOutcome: 'Scored 100% (4/4 Correct)',
      relatedProjectOrAssessment: 'TypeScript Type Safety & Advanced Generics',
    },
    {
      id: 'skill-js',
      name: 'JavaScript',
      category: 'Core Web Engineering',
      tier: 'declared',
      description: 'Self-declared proficiency in ES6+, DOM manipulation, event loop mechanics, and Async/Await.',
      source: 'Self-Reported on Onboarding',
      dateAdded: '2026-10-18',
    },
    {
      id: 'skill-css',
      name: 'CSS & Responsive Design',
      category: 'Frontend Development',
      tier: 'declared',
      description: 'Experience building mobile-first responsive layouts, flexbox, grid, and CSS custom properties.',
      source: 'Self-Reported on Onboarding',
      dateAdded: '2026-10-18',
    },
    {
      id: 'skill-sql',
      name: 'PostgreSQL & SQL',
      category: 'Backend & Data',
      tier: 'declared',
      description: 'Basic relational database schema design, indexing, and join optimization.',
      source: 'Self-Reported on Onboarding',
      dateAdded: '2026-10-18',
    },
  ];

  const initialApplications: JobApplication[] = [
    {
      id: 'app-demo-1',
      opportunityId: 'opp-101',
      opportunityTitle: 'Frontend Engineer (React & TypeScript)',
      organization: 'Nexus AI Innovations',
      category: 'job',
      appliedDate: '2026-10-16',
      status: 'in-review',
      lastUpdated: '2026-10-17',
      nextAction: 'Recruiter review in progress',
      coverNote: 'Excited to apply with verified React proof credentials.',
    },
  ];

  return {
    profile: {
      fullName: 'Rahul Sharma',
      email: 'rahul.sharma@example.com',
      headline: 'Frontend Engineer | React & TypeScript Enthusiast',
      bio: 'Passionate software engineer focused on building fast, accessible web applications with proven engineering standards.',
      country: 'India',
      city: 'Bengaluru',
      status: 'actively-looking',
      experience: '1-2',
      currentTitle: 'Junior Frontend Developer',
      currentCompany: 'TechBridge Solutions',
      education: {
        level: 'bachelor',
        degree: 'Bachelor of Technology (B.Tech)',
        fieldOfStudy: 'Computer Science and Engineering',
        institution: 'National Institute of Technology',
        graduationYear: '2025',
      },
      resumeFile: {
        name: 'Rahul_Sharma_Frontend_Resume.pdf',
        sizeBytes: 245000,
        uploadedAt: '2026-10-18',
      },
      careerGoals: {
        primaryRole: 'Frontend Engineer',
        additionalRoles: ['Full-Stack Developer', 'UI Engineer'],
      },
      jobPrefs: {
        opportunityTypes: ['full-time', 'internship'],
        workModes: ['remote', 'hybrid'],
        preferredLocations: ['Bengaluru', 'Remote'],
        expectedSalary: '₹12 - 16 LPA',
        noticePeriod: 'Immediate / 15 Days',
        availability: 'immediately',
      },
    },
    skills: initialSkills,
    assessments: SEED_ASSESSMENTS,
    assessmentAttempts: [
      {
        id: 'att-1',
        assessmentId: 'assess-ts',
        assessmentTitle: 'TypeScript Type Safety & Advanced Generics',
        associatedSkill: 'TypeScript',
        date: '2026-09-28',
        scorePercent: 100,
        passed: true,
        totalQuestions: 4,
        correctCount: 4,
        userAnswers: {
          'q-ts-1': 1,
          'q-ts-2': 1,
          'q-ts-3': 1,
          'q-ts-4': 0,
        },
      },
    ],
    roadmap: generateDefaultRoadmap('Frontend Engineer'),
    opportunities: SEED_OPPORTUNITIES,
    applications: initialApplications,
    settings: {
      profileVisibility: 'discoverable',
      recruiterSharingConsent: true,
      collegeSharingConsent: false,
      emailAlerts: true,
      opportunityAlerts: true,
    },
    activeTab: 'overview',
  };
}

// ─── Initialize Workspace from Onboarding State ───────────────────────────────

export function initializeJobSeekerWorkspaceFromOnboarding(
  onboarding: OnboardingState
): JobSeekerWorkspaceState {
  const primaryRole =
    onboarding.careerGoals.primaryRole === 'other'
      ? onboarding.careerGoals.customPrimaryRole || 'Software Engineer'
      : onboarding.careerGoals.primaryRole || 'Software Engineer';

  // Map declared skills from onboarding
  const initialSkills: JobSeekerSkill[] = (onboarding.resumeSkills?.skills || []).map(
    (s, index) => ({
      id: s.id || `skill-${index}-${Date.now()}`,
      name: s.name,
      category: s.category || 'General',
      tier: 'declared', // CRITICAL: Always starts as Declared!
      description: 'Declared during initial onboarding profile setup.',
      source: 'Onboarding Self-Declaration',
      dateAdded: new Date().toISOString().split('T')[0],
    })
  );

  return {
    profile: {
      fullName: onboarding.account.fullName || 'Candidate',
      email: onboarding.account.email || 'candidate@example.com',
      headline:
        onboarding.professional.headline ||
        `${primaryRole} candidate on YOGYATA`,
      bio: 'Candidate focused on building practical, evidenced career achievements.',
      country: onboarding.professional.country || 'India',
      city: onboarding.professional.city || '',
      status: onboarding.professional.status || 'open-to-opportunities',
      experience: onboarding.professional.experience || 'fresher',
      currentTitle: onboarding.professional.currentTitle || '',
      currentCompany: onboarding.professional.currentCompany || '',
      education: {
        level: onboarding.education?.level || 'bachelor',
        degree: onboarding.education?.degree || '',
        fieldOfStudy: onboarding.education?.fieldOfStudy || '',
        institution: onboarding.education?.institution || '',
        graduationYear: onboarding.education?.graduationYear || '',
      },
      resumeFile: onboarding.resumeSkills?.resumeFile
        ? {
            name: onboarding.resumeSkills.resumeFile.name,
            sizeBytes: onboarding.resumeSkills.resumeFile.sizeBytes,
            uploadedAt: new Date().toISOString().split('T')[0],
          }
        : null,
      careerGoals: {
        primaryRole,
        additionalRoles: onboarding.careerGoals.additionalRoles || [],
      },
      jobPrefs: {
        opportunityTypes: onboarding.jobPrefs?.opportunityTypes || ['full-time'],
        workModes: onboarding.jobPrefs?.workModes || ['hybrid', 'remote'],
        preferredLocations: onboarding.jobPrefs?.preferredLocations || [],
        expectedSalary: onboarding.jobPrefs?.expectedSalary || '',
        noticePeriod: onboarding.jobPrefs?.noticePeriod || '',
        availability: onboarding.jobPrefs?.availability || 'immediately',
      },
    },
    skills: initialSkills.length > 0 ? initialSkills : [
      {
        id: 'skill-def-1',
        name: 'JavaScript',
        category: 'Core Web',
        tier: 'declared',
        description: 'Declared during profile setup.',
        source: 'Self-Reported',
        dateAdded: new Date().toISOString().split('T')[0],
      },
    ],
    assessments: SEED_ASSESSMENTS,
    assessmentAttempts: [],
    roadmap: generateDefaultRoadmap(primaryRole),
    opportunities: SEED_OPPORTUNITIES,
    applications: [],
    settings: {
      profileVisibility: onboarding.privacy?.visibility || 'discoverable',
      recruiterSharingConsent: Boolean(onboarding.privacy?.recruiterSharingConsent),
      collegeSharingConsent: Boolean(onboarding.privacy?.collegeSharingConsent),
      emailAlerts: true,
      opportunityAlerts: true,
    },
    activeTab: 'overview',
  };
}

// ─── Persistence API ──────────────────────────────────────────────────────────

export function loadJobSeekerWorkspace(): JobSeekerWorkspaceState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(JOB_SEEKER_WORKSPACE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.profile) return null;

    return {
      profile: parsed.profile,
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      assessments: Array.isArray(parsed.assessments) ? parsed.assessments : SEED_ASSESSMENTS,
      assessmentAttempts: Array.isArray(parsed.assessmentAttempts) ? parsed.assessmentAttempts : [],
      roadmap: Array.isArray(parsed.roadmap) ? parsed.roadmap : [],
      opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities : SEED_OPPORTUNITIES,
      applications: Array.isArray(parsed.applications) ? parsed.applications : [],
      settings: parsed.settings || {
        profileVisibility: 'discoverable',
        recruiterSharingConsent: true,
        collegeSharingConsent: false,
        emailAlerts: true,
        opportunityAlerts: true,
      },
      activeTab: parsed.activeTab || 'overview',
    };
  } catch (err) {
    console.warn('[JobSeekerWorkspace] Corrupted storage, falling back:', err);
    return null;
  }
}

export function saveJobSeekerWorkspace(state: JobSeekerWorkspaceState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(JOB_SEEKER_WORKSPACE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('[JobSeekerWorkspace] Failed to persist workspace state:', err);
  }
}

export function resetJobSeekerWorkspaceToDemo(): JobSeekerWorkspaceState {
  const demo = createDemoJobSeekerWorkspace();
  saveJobSeekerWorkspace(demo);
  return demo;
}

export function clearJobSeekerWorkspace(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(JOB_SEEKER_WORKSPACE_KEY);
  } catch (err) {
    console.error('[JobSeekerWorkspace] Failed to clear workspace state:', err);
  }
}
