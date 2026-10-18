import { supabase } from './supabase';
import type {
  ActionItem,
  AssessmentAttempt,
  AssessmentQuestion,
  AssessmentRow,
  InterviewRow,
  MentorFeedback,
  MentorProfileRow,
  Mentorship,
  MentorshipRequest,
  MentorshipSession,
  RoadmapMilestone,
} from './database.types';

const friendly = (message: string) =>
  /mentorship_requests_one_pending|duplicate key/i.test(message)
    ? 'You already have a pending request with this mentor.'
    : /message.*check|char_length/i.test(message)
      ? 'Write a short message (at least 20 characters) about what you want help with.'
      : /violates row-level security|permission denied/i.test(message)
        ? 'This mentor is not taking requests right now.'
        : message;

type Result = Promise<{ error?: string }>;
const done = (error: { message: string } | null): { error?: string } => (error ? { error: friendly(error.message) } : {});

// ─── Assessments (graded in the database) ───────────────────────────────────

export type Assessment = Omit<AssessmentRow, 'questions'> & { questions: AssessmentQuestion[] };

export async function listAssessments(seekerId: string): Promise<{ assessments: Assessment[]; attempts: AssessmentAttempt[] }> {
  const [a, t] = await Promise.all([
    supabase.from('assessments').select('*').order('title'),
    supabase.from('assessment_attempts').select('*').eq('seeker_id', seekerId).order('created_at', { ascending: false }),
  ]);
  if (a.error) throw new Error(a.error.message);
  if (t.error) throw new Error(t.error.message);
  return {
    assessments: a.data.map((x) => ({ ...x, questions: x.questions as unknown as AssessmentQuestion[] })),
    attempts: t.data,
  };
}

export async function submitAssessment(assessmentId: string, answers: Record<string, number>): Promise<{ attempt?: AssessmentAttempt; error?: string }> {
  const { data, error } = await supabase.rpc('submit_assessment', { p_assessment: assessmentId, p_answers: answers });
  return error ? { error: error.message } : { attempt: data as AssessmentAttempt };
}

// ─── Career roadmap ─────────────────────────────────────────────────────────

const DEFAULT_ROADMAP = (role: string): Pick<RoadmapMilestone, 'title' | 'description' | 'category'>[] => [
  {
    title: 'Complete your profile and declare your skills',
    description: 'Add your headline, education and the skills you already have to start your Skill Passport.',
    category: 'foundation',
  },
  {
    title: 'Pass your first skill assessment',
    description: 'Take a 15-minute assessment to move a skill from Declared to Assessed.',
    category: 'assessment',
  },
  {
    title: 'Ask a mentor to review a project',
    description: 'Share work that shows a declared skill; a mentor can mark it Assessed and give feedback.',
    category: 'core-skills',
  },
  {
    title: 'Solve a founder task to earn a Verified skill',
    description: 'Submit work for a real startup problem. Accepted work makes the skill Verified.',
    category: 'practical-project',
  },
  {
    title: `Apply to three ${role || 'relevant'} roles`,
    description: 'Apply to open roles with your Skill Passport as proof.',
    category: 'career',
  },
];

export async function listRoadmap(seekerId: string, primaryRole: string): Promise<RoadmapMilestone[]> {
  const { data, error } = await supabase.from('roadmap_milestones').select('*').eq('seeker_id', seekerId).order('position');
  if (error) throw new Error(error.message);
  if (data.length) return data;
  // first visit: start from a sensible default the seeker can edit
  const seed = DEFAULT_ROADMAP(primaryRole).map((m, i) => ({ ...m, position: i }));
  const ins = await supabase.from('roadmap_milestones').insert(seed).select('*');
  if (ins.error) throw new Error(ins.error.message);
  return ins.data.sort((a, b) => a.position - b.position);
}

export async function toggleMilestone(m: RoadmapMilestone): Result {
  return done(
    (await supabase
      .from('roadmap_milestones')
      .update({ completed: !m.completed, completed_at: m.completed ? null : new Date().toISOString() })
      .eq('id', m.id)).error,
  );
}

export async function addMilestone(title: string, description: string, targetDate: string | null, position: number): Result {
  return done(
    (await supabase
      .from('roadmap_milestones')
      .insert({ title: title.trim(), description: description.trim(), target_date: targetDate || null, personal: true, category: 'career', position })).error,
  );
}

export async function deleteMilestone(id: string): Result {
  return done((await supabase.from('roadmap_milestones').delete().eq('id', id)).error);
}

// ─── Mentors ────────────────────────────────────────────────────────────────

export type ListedMentor = MentorProfileRow & { name: string; organization: string | null; activeMentees?: number };

export async function listMentors(): Promise<ListedMentor[]> {
  const { data, error } = await supabase.from('mentor_profiles').select('*').eq('listed', true).order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  if (!data.length) return [];
  const names = await supabase.from('profiles').select('id, full_name, organization').in('id', data.map((m) => m.id));
  const of = new Map((names.data ?? []).map((n) => [n.id, n]));
  return data.map((m) => ({ ...m, name: of.get(m.id)?.full_name ?? 'Mentor', organization: of.get(m.id)?.organization ?? null }));
}

export async function requestMentorship(
  seekerId: string,
  mentorId: string,
  r: { track: string; careerGoal: string; skills: string[]; message: string; preferredTime: string },
): Result {
  return done(
    (await supabase.from('mentorship_requests').insert({
      seeker_id: seekerId,
      mentor_id: mentorId,
      track: r.track,
      career_goal: r.careerGoal.trim(),
      skills: r.skills,
      message: r.message.trim(),
      preferred_time: r.preferredTime.trim(),
    })).error,
  );
}

export async function withdrawMentorshipRequest(id: string): Result {
  return done((await supabase.from('mentorship_requests').update({ status: 'withdrawn' }).eq('id', id)).error);
}

export interface MyMentorship extends Mentorship {
  mentorName: string;
  sessions: MentorshipSession[];
  actionItems: ActionItem[];
  feedback: MentorFeedback[];
}

export async function listMyMentoring(seekerId: string): Promise<{ requests: (MentorshipRequest & { mentorName: string })[]; mentorships: MyMentorship[] }> {
  const [reqs, ships] = await Promise.all([
    supabase.from('mentorship_requests').select('*').eq('seeker_id', seekerId).order('created_at', { ascending: false }),
    supabase.from('mentorships').select('*').eq('seeker_id', seekerId).order('started_at', { ascending: false }),
  ]);
  if (reqs.error) throw new Error(reqs.error.message);
  if (ships.error) throw new Error(ships.error.message);
  const ids = ships.data.map((m) => m.id);
  const mentorIds = [...new Set([...reqs.data.map((r) => r.mentor_id), ...ships.data.map((m) => m.mentor_id)])];
  const [names, sessions, items, feedback] = await Promise.all([
    mentorIds.length ? supabase.from('profiles').select('id, full_name').in('id', mentorIds) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from('mentorship_sessions').select('*').in('mentorship_id', ids).order('starts_at') : Promise.resolve({ data: [] }),
    ids.length ? supabase.from('mentorship_action_items').select('*').in('mentorship_id', ids).order('created_at') : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from('mentor_feedback').select('*').in('mentorship_id', ids).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);
  const nameOf = new Map(((names.data ?? []) as { id: string; full_name: string }[]).map((n) => [n.id, n.full_name]));
  return {
    requests: reqs.data.filter((r) => r.status !== 'accepted').map((r) => ({ ...r, mentorName: nameOf.get(r.mentor_id) ?? 'Mentor' })),
    mentorships: ships.data.map((m) => ({
      ...m,
      mentorName: nameOf.get(m.mentor_id) ?? 'Mentor',
      sessions: ((sessions.data ?? []) as MentorshipSession[]).filter((s) => s.mentorship_id === m.id),
      actionItems: ((items.data ?? []) as ActionItem[]).filter((i) => i.mentorship_id === m.id),
      feedback: ((feedback.data ?? []) as MentorFeedback[]).filter((f) => f.mentorship_id === m.id),
    })),
  };
}

export async function toggleActionItem(item: ActionItem): Result {
  return done((await supabase.from('mentorship_action_items').update({ completed: !item.completed }).eq('id', item.id)).error);
}

// ─── Interviews recruiters scheduled with me ────────────────────────────────

export type MyInterview = InterviewRow & { company: string };

export async function listMyInterviews(seekerId: string): Promise<MyInterview[]> {
  const { data, error } = await supabase.from('interviews').select('*').eq('seeker_id', seekerId).order('starts_at');
  if (error) throw new Error(error.message);
  const ids = [...new Set(data.map((i) => i.recruiter_id))];
  const names = ids.length ? ((await supabase.from('profiles').select('id, full_name, organization').in('id', ids)).data ?? []) : [];
  const of = new Map(names.map((n) => [n.id, n.organization || n.full_name]));
  return data.map((i) => ({ ...i, company: of.get(i.recruiter_id) ?? 'Recruiter' }));
}

/** Adds AI-planned steps to the end of the seeker's roadmap (only after they click to confirm). */
export async function importRoadmapSteps(steps: { title: string; description: string; type: string; weeks?: string }[]): Result {
  const { data } = await supabase.from('roadmap_milestones').select('position').order('position', { ascending: false }).limit(1);
  const start = (data?.[0]?.position ?? -1) + 1;
  const category = (t: string) =>
    /learn/.test(t) ? 'core-skills' : /project|practice|task/.test(t) ? 'practical-project' : /interview|assess/.test(t) ? 'assessment' : 'career';
  const rows = steps.slice(0, 30).map((s, i) => ({
    title: s.title.slice(0, 160),
    description: [s.description, s.weeks].filter(Boolean).join(' · ').slice(0, 1000),
    category: category(s.type),
    position: start + i,
  }));
  return done((await supabase.from('roadmap_milestones').insert(rows)).error);
}
