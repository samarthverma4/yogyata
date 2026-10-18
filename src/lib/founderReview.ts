import { supabase } from './supabase';
import { scopedKey } from './storageScope';
import type { SubmissionStatus as DbStatus } from './database.types';
import type { SubmissionStatus, TaskSubmission } from '../founder-workspace/types';

// The workspace uses hyphenated statuses; the database uses underscores.
const toUi = (s: DbStatus) => s.replace('_', '-') as SubmissionStatus;
const toDb = (s: SubmissionStatus) => s.replace('-', '_') as DbStatus;

// Internal founder notes never reach the database, because seekers can read their own submission rows.
const NOTES_KEY = 'yogyata-founder-review-notes';
function readNotes(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(scopedKey(NOTES_KEY)) || '{}');
  } catch {
    return {};
  }
}
function writeNote(id: string, note: string) {
  try {
    const all = readNotes();
    if (note) all[id] = note;
    else delete all[id];
    localStorage.setItem(scopedKey(NOTES_KEY), JSON.stringify(all));
  } catch {
    /* storage unavailable: the note is simply not kept */
  }
}

/** Submissions to the signed-in founder's tasks. `taskId` is the workspace task id (`client_id`). */
export async function listFounderSubmissions(): Promise<TaskSubmission[]> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) return [];

  const { data, error } = await supabase
    .from('submissions')
    .select('*, task:tasks!inner(client_id, title, founder_id)')
    .eq('task.founder_id', me)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  const rows = data as unknown as Array<
    (typeof data)[number] & { task: { client_id: string; title: string; founder_id: string } }
  >;
  if (!rows.length) return [];

  const seekerIds = [...new Set(rows.map((r) => r.seeker_id))];
  const [profiles, endorsed] = await Promise.all([
    supabase.from('profiles').select('id, full_name').in('id', seekerIds),
    supabase
      .from('passport_skills')
      .select('skill_name, source_submission_id')
      .eq('level', 'verified')
      .in('source_submission_id', rows.map((r) => r.id)),
  ]);
  const name = new Map((profiles.data ?? []).map((p) => [p.id, p.full_name]));
  const skillBySub = new Map((endorsed.data ?? []).map((s) => [s.source_submission_id, s.skill_name]));
  const notes = readNotes();

  return rows.map((r) => ({
    id: r.id,
    taskId: r.task.client_id,
    taskTitle: r.task.title,
    candidateId: r.seeker_id,
    candidateName: name.get(r.seeker_id) || 'Seeker',
    candidateEmail: '',
    submittedAt: r.created_at,
    deliverableUrl: r.deliverable_url,
    deliverableNotes: r.notes,
    status: toUi(r.status),
    feedback: r.feedback ?? undefined,
    rating: r.rating ?? undefined,
    reviewedAt: r.reviewed_at ?? undefined,
    reviewNotes: notes[r.id],
    endorsedSkill: skillBySub.get(r.id),
    isVerifiedEndorsed: skillBySub.has(r.id),
  }));
}

/** Saves the decision, feedback and rating; endorses a skill when asked and the work is accepted. */
export async function saveFounderReview(sub: TaskSubmission): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('submissions')
    .update({
      status: toDb(sub.status),
      feedback: sub.feedback || null,
      rating: sub.rating ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', sub.id);
  if (error) return { error: error.message };
  writeNote(sub.id, sub.reviewNotes ?? '');

  if (sub.isVerifiedEndorsed && sub.endorsedSkill && sub.status === 'accepted') {
    const { error: rpcError } = await supabase.rpc('endorse_submission_skill', {
      p_submission: sub.id,
      p_skill: sub.endorsedSkill,
    });
    if (rpcError) return { error: rpcError.message };
  }
  return {};
}
