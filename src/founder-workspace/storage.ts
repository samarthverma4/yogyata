import type {
  FounderWorkspaceState,
  Project,
  WorkspaceTask,
  TaskSubmission,
  CandidateProfile,
} from './types';
import type { FounderOnboardingState } from '../founder-onboarding/types';

export const WORKSPACE_STORAGE_KEY = 'yogyata_founder_workspace_data';
export const WORKSPACE_STORAGE_VERSION = 1;

// ─── Clearly Labeled Demo Candidates for Talent Discovery ────────────────────
export const DEMO_CANDIDATES: CandidateProfile[] = [
  {
    id: 'cand-demo-1',
    fullName: 'Aarav Sharma',
    headline: 'Full-Stack Engineer & Open Source Builder',
    location: 'Bengaluru, India',
    experienceLevel: 'Experienced',
    availability: 'Immediately',
    preferredWorkMode: 'Remote',
    bio: 'Passionate about building scalable TypeScript backends and React frontends. 4 years of hands-on experience developing SaaS products.',
    skills: [
      {
        skillName: 'React',
        level: 'verified',
        evidenceSource: 'Verified by TechLead on Micro-SaaS Dashboard Challenge',
        verifiedAt: '2025-08-14',
      },
      {
        skillName: 'TypeScript',
        level: 'assessed',
        evidenceSource: 'Algorithm & Type System Assessment (Score: 94%)',
      },
      {
        skillName: 'Node.js',
        level: 'assessed',
        evidenceSource: 'REST API & Streaming Assessment (Score: 88%)',
      },
      {
        skillName: 'Docker',
        level: 'declared',
        evidenceSource: 'Self-declared on resume & GitHub profile',
      },
      {
        skillName: 'PostgreSQL',
        level: 'declared',
        evidenceSource: 'Self-declared on resume',
      },
    ],
    completedChallengesCount: 3,
    githubUrl: 'https://github.com/demo-aarav',
    portfolioUrl: 'https://aarav-portfolio.demo',
  },
  {
    id: 'cand-demo-2',
    fullName: 'Priya Iyer',
    headline: 'Frontend Architect & UI/UX Specialist',
    location: 'Mumbai, India',
    experienceLevel: 'Intermediate',
    availability: 'Within 2 weeks',
    preferredWorkMode: 'Hybrid',
    bio: 'Specializes in accessible component systems, performance optimization, and responsive design. Design systems enthusiast.',
    skills: [
      {
        skillName: 'UI/UX Design',
        level: 'verified',
        evidenceSource: 'Verified via Design System Component Audit Challenge',
        verifiedAt: '2025-09-02',
      },
      {
        skillName: 'React',
        level: 'assessed',
        evidenceSource: 'Frontend Benchmark Test (Score: 91%)',
      },
      {
        skillName: 'CSS / SCSS',
        level: 'assessed',
        evidenceSource: 'Responsive Layouts & Animation Benchmark (Score: 96%)',
      },
      {
        skillName: 'Figma',
        level: 'verified',
        evidenceSource: 'Verified Design Token Spec Review',
        verifiedAt: '2025-07-20',
      },
      {
        skillName: 'Next.js',
        level: 'declared',
        evidenceSource: 'Self-declared on resume',
      },
    ],
    completedChallengesCount: 4,
    githubUrl: 'https://github.com/demo-priya',
    portfolioUrl: 'https://priya-designs.demo',
  },
  {
    id: 'cand-demo-3',
    fullName: 'Rohan Verma',
    headline: 'AI / Machine Learning Engineer',
    location: 'Hyderabad, India',
    experienceLevel: 'Experienced',
    availability: 'Flexible',
    preferredWorkMode: 'Remote',
    bio: 'Focused on LLM orchestration, retrieval-augmented generation (RAG), and model fine-tuning. Contributor to open-source agent frameworks.',
    skills: [
      {
        skillName: 'Python',
        level: 'verified',
        evidenceSource: 'Verified in Model Inference Pipeline Challenge',
        verifiedAt: '2025-09-18',
      },
      {
        skillName: 'AI / Machine Learning',
        level: 'assessed',
        evidenceSource: 'Deep Learning & NLP Benchmark (Score: 89%)',
      },
      {
        skillName: 'FastAPI',
        level: 'assessed',
        evidenceSource: 'Asynchronous API Performance Assessment (Score: 92%)',
      },
      {
        skillName: 'PyTorch',
        level: 'declared',
        evidenceSource: 'Self-declared on resume & research papers',
      },
      {
        skillName: 'Vector Databases',
        level: 'declared',
        evidenceSource: 'Self-declared on project portfolio',
      },
    ],
    completedChallengesCount: 2,
    githubUrl: 'https://github.com/demo-rohan',
    portfolioUrl: 'https://rohan-ai.demo',
  },
  {
    id: 'cand-demo-4',
    fullName: 'Ananya Deshmukh',
    headline: 'Junior Frontend Developer & CS Graduate',
    location: 'Pune, India',
    experienceLevel: 'Beginner',
    availability: 'Immediately',
    preferredWorkMode: 'Remote',
    bio: 'Motivated early-career developer eager to contribute to fast-paced startup projects. Strong fundamentals in JavaScript and modern web standards.',
    skills: [
      {
        skillName: 'JavaScript',
        level: 'assessed',
        evidenceSource: 'ES6+ Core Assessment (Score: 85%)',
      },
      {
        skillName: 'HTML / CSS',
        level: 'assessed',
        evidenceSource: 'Semantic Web & Accessibility Test (Score: 90%)',
      },
      {
        skillName: 'React',
        level: 'declared',
        evidenceSource: 'Self-declared coursework & portfolio projects',
      },
      {
        skillName: 'Git',
        level: 'declared',
        evidenceSource: 'Self-declared on GitHub profile',
      },
    ],
    completedChallengesCount: 1,
    githubUrl: 'https://github.com/demo-ananya',
  },
];

// ─── Initial Demo Submissions Helper ─────────────────────────────────────────
export function createInitialDemoSubmissions(tasks: WorkspaceTask[]): TaskSubmission[] {
  const publishedTask = tasks.find((t) => t.status === 'published') || tasks[0];
  const taskId = publishedTask ? publishedTask.id : 'task-1';
  const taskTitle = publishedTask ? publishedTask.title : 'Alpha Challenge Deliverable';

  return [
    {
      id: 'sub-demo-1',
      taskId,
      taskTitle,
      candidateId: 'cand-demo-1',
      candidateName: 'Aarav Sharma',
      candidateEmail: 'aarav.sharma@example.demo',
      submittedAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
      deliverableUrl: 'https://github.com/demo-aarav/yogyata-task-deliverable',
      deliverableNotes:
        'Completed the challenge deliverables including full test coverage, TypeScript strict mode compliance, and a live deployment on Vercel.',
      status: 'submitted',
      isDemoRecord: true,
    },
    {
      id: 'sub-demo-2',
      taskId,
      taskTitle,
      candidateId: 'cand-demo-2',
      candidateName: 'Priya Iyer',
      candidateEmail: 'priya.iyer@example.demo',
      submittedAt: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
      deliverableUrl: 'https://figma.com/@demo-priya/prototype-spec',
      deliverableNotes:
        'Prepared the complete UI architecture specs and accessible color contrast variants adhering to WCAG 2.1 AA specifications.',
      status: 'under-review',
      reviewNotes: 'Initial inspection looks very promising. Reviewing color tokens now.',
      isDemoRecord: true,
    },
  ];
}

// ─── Workspace Initialization from Onboarding ────────────────────────────────
export function initializeWorkspaceFromOnboarding(
  onboarding: FounderOnboardingState
): FounderWorkspaceState {
  const now = new Date().toISOString();

  // 1. Initial Project derived from onboarding business goals
  const initialProjects: Project[] = [];
  const projectTitle =
    onboarding.goals.primaryGoal && onboarding.goals.primaryGoal !== 'Other'
      ? onboarding.goals.primaryGoal
      : onboarding.goals.customPrimaryGoal || `${onboarding.startup.startupName || 'Venture'} Alpha Milestone`;

  const initialProject: Project = {
    id: 'proj-1',
    title: projectTitle,
    description:
      onboarding.goals.projectDescription ||
      `Core deliverables and business objectives for ${onboarding.startup.startupName || 'our startup'}.`,
    category: onboarding.goals.projectCategory || 'Software / Web',
    projectUrl: onboarding.goals.projectLink || onboarding.startup.websiteUrl || '',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
  initialProjects.push(initialProject);

  // 2. Initial Task derived from onboarding task draft if created
  const initialTasks: WorkspaceTask[] = [];
  if (!onboarding.taskDraft.isSkipped && onboarding.taskDraft.taskTitle.trim()) {
    initialTasks.push({
      id: 'task-1',
      projectId: 'proj-1',
      title: onboarding.taskDraft.taskTitle,
      problemStatement: onboarding.taskDraft.problemStatement,
      requiredSkills: onboarding.taskDraft.requiredSkills,
      expectedDeliverable: onboarding.taskDraft.expectedDeliverable,
      evaluationCriteria: onboarding.taskDraft.evaluationCriteria,
      deadline: onboarding.taskDraft.deadline || '',
      compensationType: onboarding.taskDraft.compensationModel || 'unspecified',
      rewardDetails: onboarding.taskDraft.rewardDetails || '',
      status: 'published',
      createdAt: now,
      updatedAt: now,
    });
  } else {
    // Provide a sample draft task to guide the founder
    initialTasks.push({
      id: 'task-1',
      projectId: 'proj-1',
      title: 'Implement Core Authentication & Protected Route Guard',
      problemStatement:
        'Build a resilient frontend route protection system that handles session expiration and graceful redirection.',
      requiredSkills: ['React', 'TypeScript', 'State Management'],
      expectedDeliverable:
        'A clean React route guard component with test specifications and mock authentication states.',
      evaluationCriteria:
        'Clean TypeScript interfaces, zero console warnings, and proper handling of edge-case token invalidation.',
      deadline: '2026-11-15',
      compensationType: 'paid',
      rewardDetails: 'USD $350 completion bounty',
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    });
  }

  // 3. Initial Submissions
  const initialSubmissions = createInitialDemoSubmissions(initialTasks);

  return {
    version: WORKSPACE_STORAGE_VERSION,
    founder: onboarding.profile,
    accountEmail: onboarding.account.email,
    startup: onboarding.startup,
    goals: onboarding.goals,
    talentRequirements: onboarding.talentRequirements,
    privacy: onboarding.privacy,
    projects: initialProjects,
    tasks: initialTasks,
    submissions: initialSubmissions,
    settings: {
      emailNotifications: true,
      contributorAlerts: true,
      weeklyDigest: true,
      stealthMode: onboarding.privacy.profileVisibility === 'private',
      allowPublicApplications: onboarding.privacy.receiveContributorExpressions,
    },
    createdAt: now,
    lastUpdatedAt: now,
  };
}

// ─── Local Storage Operations ────────────────────────────────────────────────
export function saveFounderWorkspace(workspace: FounderWorkspaceState): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;

  try {
    const payload = {
      ...workspace,
      lastUpdatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (err) {
    console.warn('Failed to save founder workspace to localStorage:', err);
    return false;
  }
}

export function loadFounderWorkspace(): FounderWorkspaceState | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;

  try {
    const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<FounderWorkspaceState>;
    if (!parsed || typeof parsed !== 'object' || parsed.version !== WORKSPACE_STORAGE_VERSION) {
      return null;
    }

    if (!parsed.founder || !parsed.startup || !Array.isArray(parsed.projects)) {
      return null;
    }

    return parsed as FounderWorkspaceState;
  } catch {
    return null;
  }
}

export function clearFounderWorkspace(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(WORKSPACE_STORAGE_KEY);
  } catch {
    // Ignore cleanup errors
  }
}
