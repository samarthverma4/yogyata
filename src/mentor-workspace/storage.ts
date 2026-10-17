import type {
  MentorWorkspaceState,
  MentorshipRequest,
  MenteeRelationship,
  MentorshipSession,
  LearningFeedback,
} from './types';
import type { MentorOnboardingState } from '../mentor-onboarding/types';

export const MENTOR_WORKSPACE_STORAGE_KEY = 'yogyata_mentor_workspace_data';
export const MENTOR_WORKSPACE_STORAGE_VERSION = 1;

/**
 * Sanitizes URLs to prevent unsafe schemes (e.g. javascript: or data:).
 */
export function sanitizeUrl(url?: string): string {
  if (!url || typeof url !== 'string') return '#';
  const trimmed = url.trim();
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

/**
 * Generates realistic, clearly labeled initial demo data for a newly initialized mentor workspace.
 */
export function createInitialMentorDemoData(): {
  requests: MentorshipRequest[];
  mentees: MenteeRelationship[];
  sessions: MentorshipSession[];
  feedback: LearningFeedback[];
} {
  const now = new Date();
  const pastDateStr = new Date(now.getTime() - 4 * 24 * 3600 * 1000).toISOString().split('T')[0];
  const futureDate = new Date(now.getTime() + 3 * 24 * 3600 * 1000);
  const futureDateStr = futureDate.toISOString().split('T')[0];

  const requests: MentorshipRequest[] = [
    {
      id: 'req-demo-1',
      menteeName: 'Rahul Verma',
      menteeEmail: 'rahul.verma@example.com',
      careerGoal: 'Transition from Junior Frontend to Senior Full-Stack Engineer',
      relevantSkills: ['React', 'JavaScript', 'Node.js', 'SQL'],
      requestedTrack: 'Technical Interview Preparation',
      introMessage:
        'Hi! I am preparing for tier-1 product company interviews. I would love structured feedback on system design questions and algorithmic pairing.',
      preferredTime: 'Weekday evenings (IST) or Saturday mornings',
      status: 'pending',
      submittedAt: new Date(now.getTime() - 24 * 3600 * 1000).toISOString(),
      isDemoRecord: true,
    },
    {
      id: 'req-demo-2',
      menteeName: 'Ananya Sen',
      menteeEmail: 'ananya.sen@example.com',
      careerGoal: 'Launch an Open Source developer tool & prepare architecture',
      relevantSkills: ['TypeScript', 'Go', 'Docker', 'REST APIs'],
      requestedTrack: 'Practical Project Guidance',
      introMessage:
        'I am building an open-source API telemetry proxy. Looking for architectural review and guidance on concurrent request pipeline design.',
      preferredTime: 'Sunday afternoons or flexible async reviews',
      status: 'pending',
      submittedAt: new Date(now.getTime() - 48 * 3600 * 1000).toISOString(),
      isDemoRecord: true,
    },
  ];

  const mentees: MenteeRelationship[] = [
    {
      id: 'mentee-demo-1',
      requestId: 'req-archived-0',
      menteeName: 'Aarav Patel',
      menteeEmail: 'aarav.patel@example.com',
      careerGoal: 'Architect high-throughput React & TypeScript applications',
      mentorshipTrack: 'Full-Stack Development Mastery',
      status: 'active',
      startDate: new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString(),
      goals: [
        'Master React 19 server actions and state isolation',
        'Refactor existing monolithic dashboard into micro-frontends',
        'Improve unit test coverage to >85%',
      ],
      actionItems: [
        {
          id: 'act-1',
          text: 'Implement custom caching hook with optimistic updates in challenge project',
          completed: true,
          dueDate: pastDateStr,
        },
        {
          id: 'act-2',
          text: 'Draft architecture diagram for decoupled notification service',
          completed: false,
          dueDate: futureDateStr,
        },
      ],
      privateNotes:
        'Aarav is very strong on component design. Needs more focus on edge-case error boundaries and network fallback states.',
      lastSessionDate: pastDateStr,
      nextSessionDate: futureDateStr,
      isDemoRecord: true,
    },
    {
      id: 'mentee-demo-2',
      menteeName: 'Meera Iyer',
      menteeEmail: 'meera.iyer@example.com',
      careerGoal: 'Break into Engineering Management and distributed system leadership',
      mentorshipTrack: 'Communication & Leadership Growth',
      status: 'active',
      startDate: new Date(now.getTime() - 14 * 24 * 3600 * 1000).toISOString(),
      goals: [
        'Practice stakeholder alignment presentations',
        'Structure cross-team RFCs for technical migration',
      ],
      actionItems: [
        {
          id: 'act-3',
          text: 'Review draft RFC on microservice database tenancy',
          completed: false,
        },
      ],
      privateNotes: 'Excellent communication. Focus our next session on conflict resolution models in agile teams.',
      lastSessionDate: undefined,
      nextSessionDate: undefined,
      isDemoRecord: true,
    },
  ];

  const sessions: MentorshipSession[] = [
    {
      id: 'sess-demo-1',
      menteeId: 'mentee-demo-1',
      menteeName: 'Aarav Patel',
      title: 'State Architecture & Concurrent React Review',
      date: pastDateStr,
      startTime: '18:30',
      durationMinutes: 45,
      sessionFormat: 'online',
      agenda: 'Review custom caching hook, discuss memory leak prevention in WebSocket listeners.',
      prepNotes: 'Aarav sent PR link #42 ahead of time.',
      status: 'completed',
      postSessionNotes:
        'Great session. Walked through hook lifecycles. Aarav addressed the re-render issue effectively.',
      actionItemsAdded: ['Draft architecture diagram for decoupled notification service'],
      isDemoRecord: true,
    },
    {
      id: 'sess-demo-2',
      menteeId: 'mentee-demo-1',
      menteeName: 'Aarav Patel',
      title: 'Decoupled Notification Architecture Discussion',
      date: futureDateStr,
      startTime: '19:00',
      durationMinutes: 45,
      sessionFormat: 'online',
      agenda: 'Evaluate draft RFC on pub/sub event pipeline and fallback polling.',
      prepNotes: 'Review system design block diagram before call.',
      status: 'scheduled',
      isDemoRecord: true,
    },
  ];

  const feedback: LearningFeedback[] = [
    {
      id: 'fb-demo-1',
      menteeId: 'mentee-demo-1',
      menteeName: 'Aarav Patel',
      sessionId: 'sess-demo-1',
      feedbackDate: pastDateStr,
      strengthsObserved:
        'Strong grasp of TypeScript generics and composable hook patterns. Excellent receptiveness to code review.',
      improvementAreas:
        'Consider writing integration test harnesses earlier before building deep UI components.',
      recommendedNextSteps:
        'Read the React 19 concurrency RFC and implement test assertions using React Testing Library.',
      privateMentorReflection:
        'Candidate is progressing rapidly. Will likely be ready for senior technical challenge assessments next month.',
      visibility: 'shared-with-mentee',
      isDemoRecord: true,
    },
  ];

  return { requests, mentees, sessions, feedback };
}

/**
 * Transforms completed onboarding data into a fully initialized Mentor Workspace state.
 */
export function initializeMentorWorkspaceFromOnboarding(
  onboarding: MentorOnboardingState
): MentorWorkspaceState {
  const { requests, mentees, sessions, feedback } = createInitialMentorDemoData();
  const now = new Date().toISOString();

  return {
    version: MENTOR_WORKSPACE_STORAGE_VERSION,
    mentor: {
      ...onboarding.profile,
      fullName: onboarding.account.fullName || 'Mentor',
      email: onboarding.account.email || '',
    },
    expertise: onboarding.expertise,
    preferences: onboarding.preferences,
    requests,
    mentees,
    sessions,
    feedback,
    settings: {
      maxActiveMentees: onboarding.preferences.maxActiveMentees || 3,
      weeklyAvailabilityHours: onboarding.preferences.weeklyAvailabilityHours || 4,
      sessionDurationMinutes: onboarding.preferences.sessionDurationMinutes || 45,
      sessionFrequency: onboarding.preferences.sessionFrequency || 'weekly',
      profileVisibility: 'public',
      notifyNewRequests: true,
      notifyUpcomingSessions: true,
      weeklyDigest: true,
    },
    createdAt: now,
    lastUpdatedAt: now,
  };
}

/**
 * Safely persists Mentor Workspace state to localStorage.
 */
export function saveMentorWorkspace(workspace: MentorWorkspaceState): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    const payload = {
      ...workspace,
      lastUpdatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(MENTOR_WORKSPACE_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (err) {
    console.warn('Failed to save mentor workspace to localStorage:', err);
    return false;
  }
}

/**
 * Loads and validates Mentor Workspace state from localStorage.
 */
export function loadMentorWorkspace(): MentorWorkspaceState | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(MENTOR_WORKSPACE_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.mentor) return null;

    // Structural validation with non-null arrays
    return {
      version: parsed.version || MENTOR_WORKSPACE_STORAGE_VERSION,
      mentor: parsed.mentor,
      expertise: parsed.expertise || {
        expertiseAreas: ['System Design'],
        technicalSkills: ['React', 'TypeScript'],
        industries: ['Software'],
        languages: ['English'],
        experienceLevel: 'Senior',
      },
      preferences: parsed.preferences || {
        selectedTracks: ['Technical Interview Preparation'],
        preferredMenteeLevels: ['Beginner', 'Intermediate'],
        sessionFormat: 'online',
        sessionDurationMinutes: 45,
        sessionFrequency: 'weekly',
        weeklyAvailabilityHours: 4,
        maxActiveMentees: 3,
        pricingModel: 'free',
      },
      requests: Array.isArray(parsed.requests) ? parsed.requests : [],
      mentees: Array.isArray(parsed.mentees) ? parsed.mentees : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      feedback: Array.isArray(parsed.feedback) ? parsed.feedback : [],
      settings: parsed.settings || {
        maxActiveMentees: 3,
        weeklyAvailabilityHours: 4,
        sessionDurationMinutes: 45,
        sessionFrequency: 'weekly',
        profileVisibility: 'public',
        notifyNewRequests: true,
        notifyUpcomingSessions: true,
        weeklyDigest: true,
      },
      createdAt: parsed.createdAt || new Date().toISOString(),
      lastUpdatedAt: parsed.lastUpdatedAt || new Date().toISOString(),
    };
  } catch (err) {
    console.warn('Failed to load mentor workspace from localStorage:', err);
    return null;
  }
}

/**
 * Completely clears mentor workspace data from localStorage.
 */
export function clearMentorWorkspace(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(MENTOR_WORKSPACE_STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear mentor workspace:', err);
  }
}
