import { supabase } from './supabase';

// Client for the yogyata-ai service (yogyata-ai/service). It runs separately from Supabase
// because the models are Python; Edge Functions are Deno and cannot host them.
// Every call carries the signed-in user's access token, and the service reads Supabase under
// that same token, so row level security decides what the models are allowed to see.

const BASE = import.meta.env.VITE_AI_SERVICE_URL?.replace(/\/$/, '') ?? '';

export const aiServiceConfigured = Boolean(BASE);

/** Roles the model catalog can score. Anything else comes back as `unsupported_role`. */
export type AiRoleId = 'data_analyst' | 'full_stack_developer' | 'ml_engineer';

export interface AiNotes {
  /** Skills on the passport that fall outside the 46-skill taxonomy, so no score can see them. */
  unmapped_skills: string[];
  weekly_hours_supplied: boolean;
  timeline_weeks_supplied: boolean;
  cgpa_known: boolean;
}

export interface AiResult<T> {
  result: T;
  notes?: AiNotes & Record<string, unknown>;
}

export interface ProfileOptions {
  target_role?: string;
  weekly_hours?: number;
  timeline_weeks?: number;
}

/** Thrown when the target role has no reviewed skill catalog, so no score is produced. */
export class UnsupportedRoleError extends Error {
  readonly requested: string | null;
  readonly supported: string[];

  constructor(requested: string | null, supported: string[]) {
    super(
      `Readiness scoring is not available for ${requested || 'this role'} yet. Supported: ${supported.join(', ')}.`,
    );
    this.name = 'UnsupportedRoleError';
    this.requested = requested;
    this.supported = supported;
  }
}

async function call<T>(path: string, body?: unknown, method: 'GET' | 'POST' = 'POST'): Promise<T> {
  if (!BASE) throw new Error('The AI service is not configured. Set VITE_AI_SERVICE_URL.');

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Log in again to use this.');

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      },
      body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
    });
  } catch {
    throw new Error('Could not reach the AI service. Check your connection and try again.');
  }

  if (res.ok) return (await res.json()) as T;

  const payload = await res.json().catch(() => null);
  const detail = (payload as { detail?: unknown } | null)?.detail;
  if (res.status === 422 && detail && typeof detail === 'object' && 'error' in detail) {
    const d = detail as { error: string; requested?: string; supported?: string[] };
    if (d.error === 'unsupported_role') throw new UnsupportedRoleError(d.requested ?? null, d.supported ?? []);
  }
  if (res.status === 401) throw new Error('Your session expired. Log in again.');
  if (res.status === 403) throw new Error('Your account does not have access to this.');
  throw new Error(typeof detail === 'string' ? detail : 'The AI service could not complete that request.');
}

/** The profile the service derives from your Supabase rows, and what it could not translate. */
export const getAiProfile = (opts: ProfileOptions = {}) =>
  call<AiResult<unknown> & { role_id: AiRoleId }>('/me/profile', opts);

/** Evidence-based readiness, per-skill status and priorities for the seeker's target role. */
export const getSkillGap = (opts: ProfileOptions = {}) => call<AiResult<Record<string, unknown>>>('/skill-gap', opts);

/** A plan ordered by prerequisites and fitted to weekly hours; anything that will not fit is deferred. */
export const getRoadmap = (opts: ProfileOptions = {}) => call<AiResult<Record<string, unknown>>>('/roadmap', opts);

/** Ranks the open job postings the seeker is allowed to see. Fit is an indicator, not a hiring chance. */
export const matchOpportunities = (opts: ProfileOptions = {}) =>
  call<AiResult<Record<string, unknown>>>('/opportunities/match', opts);

/** Ranks listed mentors against the seeker's weakest role skills. Books nothing. */
export const recommendMentors = (opts: ProfileOptions = {}) =>
  call<AiResult<Record<string, unknown>>>('/mentors/recommend', opts);

/** Practical tasks aimed at open gaps, respecting prerequisites and time budget. */
export const recommendTasks = (opts: ProfileOptions = {}) =>
  call<AiResult<Record<string, unknown>>>('/tasks/recommend', opts);

export const analyzeResume = (resumeText: string, jobDescription?: string) =>
  call<AiResult<Record<string, unknown>>>('/resume/analyze', {
    resume_text: resumeText,
    job_description: jobDescription,
  });

export const listInterviewQuestions = () => call<AiResult<unknown>>('/interview/questions', undefined, 'GET');

export const nextInterviewQuestion = (role: string, interviewType: string, history: unknown[] = []) =>
  call<AiResult<Record<string, unknown>>>('/interview/next', {
    role,
    interview_type: interviewType,
    history,
  });

/**
 * Scores a practice answer. Always `automated_unverified`: it can never promote a skill on
 * its own, which is why there is no write path back to the passport here.
 */
export const evaluateInterviewAnswer = (questionId: string, answerText: string) =>
  call<AiResult<Record<string, unknown>>>('/interview/evaluate', {
    question_id: questionId,
    answer_text: answerText,
  });

/** Preliminary feedback on a draft submission. Always flagged `human_review_required`. */
export const evaluateTaskDraft = (taskId: string, submissionText: string) =>
  call<AiResult<Record<string, unknown>>>('/tasks/evaluate', {
    task_id: taskId,
    submission_text: submissionText,
  });

export const runCareerAgent = (payload: Record<string, unknown> = {}, opts: ProfileOptions = {}) =>
  call<AiResult<Record<string, unknown>>>('/agent/run', { ...opts, payload });
