import { supabase } from './supabase';

// Calls the yogyata-ai service. In development Vite proxies /ai to it; elsewhere set
// VITE_AI_URL to where it runs. The user's Supabase token goes along so the service
// reads only what this user may see.
const BASE = (import.meta.env.VITE_AI_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export class AiError extends Error {}

async function call<T>(path: string, init?: { method?: 'GET' | 'POST'; body?: unknown }): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new AiError('Sign in first.');
  let res: Response;
  try {
    res = await fetch(`${BASE}/ai${path}`, {
      method: init?.method ?? 'GET',
      headers: { Authorization: `Bearer ${token}`, ...(init?.body ? { 'Content-Type': 'application/json' } : {}) },
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new AiError('The AI service is not running. Start it with: npm run ai');
  }
  if (res.status === 502 || res.status === 504) throw new AiError('The AI service is not running. Start it with: npm run ai');
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new AiError((json && (json.detail as string)) || `The AI service answered ${res.status}.`);
  return json as T;
}

// ─── Response shapes (the parts the screens use) ────────────────────────────

export interface AiRole {
  id: string;
  title: string;
  skills: string[];
}

export interface SkillRow {
  skill: string;
  importance: number;
  status: string;
  priority: number;
  explanation: string;
  evidence_state: string;
}

export interface Readiness {
  role_id: string;
  role_title: string;
  readiness_score: number;
  readiness_min: number;
  readiness_max: number;
  verified_coverage: number;
  assessed_coverage: number;
  skills: SkillRow[];
  priority_gaps: SkillRow[];
  met: string[];
  evidence_states: Record<string, string[]>;
  notes: string[];
  score_meaning: string;
}

export interface RoadmapItem {
  order: number;
  activity_id: string;
  skill: string;
  type: string;
  title: string;
  hours: number;
  start_week: number | null;
  end_week: number | null;
  objective: string;
  reason: string;
  expected_evidence: string;
  completion_criteria: string;
  requires_review: boolean;
}

export interface AiRoadmap {
  role_title: string;
  items: RoadmapItem[];
  total_hours: number;
  weeks_used: number;
  schedule: { projected_completion_week: number | null; capacity_respected: boolean; unscheduled_hours: number };
  conflicts: { message?: string; description?: string }[];
  notes: string[];
  disclaimer: string;
}

export interface RankedOpportunity {
  opportunity_id: string;
  type: string;
  title: string;
  score: number;
  eligibility_status: string;
  matched_skills: { skill: string; level: string }[];
  missing_skills: string[];
  explanation: string[];
  score_meaning: string;
}

export interface RankedMentor {
  mentor_id: string;
  score: number;
  matched_skills: { skill: string; mentor_depth: number; student_status: string }[];
  reasons: string[];
}

export interface Matches {
  role_id: string;
  opportunities: { ranked: RankedOpportunity[]; excluded: { opportunity_id: string; reason?: string; reasons?: string[] }[] };
  mentors: { ranked: RankedMentor[] };
}

export interface InterviewQuestion {
  question: { id: string; type: string; topic: string; difficulty: number; text: string } | null;
  reason: string;
}

export interface InterviewEvaluation {
  evaluation: {
    question_id: string;
    topic: string;
    overall: number;
    confidence: string;
    scores: Record<string, number>;
    strengths: string[];
    improvements: string[];
  };
}

export interface ResumeResult {
  role_id: string;
  analysis: {
    overall_score: number;
    components: Record<string, number>;
    suggestions: string[];
    warnings: string[];
    information_gaps: string[];
    parsed: { skills: { name: string; category: string; support: string }[]; word_count: number; quantified_bullet_count: number; bullet_count: number };
  };
}

export interface TaskCheck {
  status: string;
  skills: string[];
  difficulty: string | null;
  estimated_hours: number | null;
  deliverables: string[];
  draft_rubric: unknown[];
  warnings: string[];
}

export interface ProposedAction {
  id: string;
  kind: string;
  target_id: string;
  status: string;
  message?: string;
}

export interface AssistantReply {
  session: Record<string, unknown> & { pending_actions?: ProposedAction[] };
  summary: string;
  stages_run: string[];
  needs_input: string[];
  refused_requests: { kind: string; explanation: string }[];
  proposed_actions: ProposedAction[];
  verification: { passed: boolean };
}

// ─── Calls ──────────────────────────────────────────────────────────────────

export const ai = {
  roles: () => call<AiRole[]>('/roles'),
  readiness: (role?: string) => call<Readiness>(`/readiness${role ? `?role=${encodeURIComponent(role)}` : ''}`),
  roadmap: (role: string | undefined, weekly_hours: number, timeline_weeks: number) =>
    call<AiRoadmap>('/roadmap', { method: 'POST', body: { role, weekly_hours, timeline_weeks } }),
  matches: (role?: string) => call<Matches>(`/matches${role ? `?role=${encodeURIComponent(role)}` : ''}`),
  nextQuestion: (role: string | undefined, kind: string, history: string[]) =>
    call<InterviewQuestion>(
      `/interview/next?kind=${encodeURIComponent(kind)}&history=${encodeURIComponent(history.join(','))}${role ? `&role=${encodeURIComponent(role)}` : ''}`,
    ),
  evaluate: (question_id: string, answer_text: string) =>
    call<InterviewEvaluation>('/interview/evaluate', { method: 'POST', body: { question_id, answer_text } }),
  resume: (resume_text: string, role?: string) => call<ResumeResult>('/resume', { method: 'POST', body: { resume_text, role } }),
  taskCheck: (title: string, text: string) => call<TaskCheck>('/task-check', { method: 'POST', body: { title, text } }),
  assistant: (user_message: string, session: Record<string, unknown>, role?: string) =>
    call<AssistantReply>('/assistant', { method: 'POST', body: { user_message, session, role } }),
  confirm: (session: Record<string, unknown>, action_id: string, user_confirmed: boolean) =>
    call<Record<string, unknown>>('/assistant/confirm', { method: 'POST', body: { session, action_id, user_confirmed } }),
};
