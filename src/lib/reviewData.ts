import { supabase } from './supabase';
import type { SkillReview, SkillReviewStatus } from './database.types';

export type ReviewWithSeeker = SkillReview & { seekerName: string };

const friendly = (message: string) =>
  /skill_reviews_one_open|duplicate key/i.test(message)
    ? 'A mentor review for this skill is already open.'
    : /evidence_url_check/i.test(message)
      ? 'The link must start with http:// or https://.'
      : /violates row-level security|permission denied/i.test(message)
        ? 'You do not have permission to do that.'
        : message;

// ─── Seeker side ────────────────────────────────────────────────────────────

export async function listMyReviewRequests(userId: string): Promise<SkillReview[]> {
  const { data, error } = await supabase
    .from('skill_reviews')
    .select('*')
    .eq('seeker_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(friendly(error.message));
  return data;
}

export async function requestMentorReview(
  userId: string,
  skill: { id: string; skill_name: string },
  evidenceUrl: string,
  note: string,
): Promise<{ error?: string }> {
  const { error } = await supabase.from('skill_reviews').insert({
    seeker_id: userId,
    skill_id: skill.id,
    skill_name: skill.skill_name,
    evidence_url: evidenceUrl.trim(),
    note: note.trim(),
  });
  return error ? { error: friendly(error.message) } : {};
}

export async function cancelReviewRequest(id: string): Promise<{ error?: string }> {
  const { error } = await supabase.from('skill_reviews').delete().eq('id', id).eq('status', 'requested');
  return error ? { error: friendly(error.message) } : {};
}

// ─── Mentor side ────────────────────────────────────────────────────────────

async function withNames(rows: SkillReview[]): Promise<ReviewWithSeeker[]> {
  const ids = [...new Set(rows.map((r) => r.seeker_id))];
  if (!ids.length) return [];
  const { data } = await supabase.from('profiles').select('id, full_name').in('id', ids);
  const name = new Map((data ?? []).map((p) => [p.id, p.full_name]));
  return rows.map((r) => ({ ...r, seekerName: name.get(r.seeker_id) || 'Seeker' }));
}

/** Open requests (oldest first) and the mentor's own past decisions (newest first). */
export async function listMentorReviews(mentorId: string): Promise<{ queue: ReviewWithSeeker[]; history: ReviewWithSeeker[] }> {
  const [open, done] = await Promise.all([
    supabase.from('skill_reviews').select('*').eq('status', 'requested').order('created_at', { ascending: true }),
    supabase.from('skill_reviews').select('*').eq('mentor_id', mentorId).order('reviewed_at', { ascending: false }),
  ]);
  if (open.error) throw new Error(friendly(open.error.message));
  if (done.error) throw new Error(friendly(done.error.message));
  // a mentor who is also asking for reviews never sees their own requests in the queue
  const queue = open.data.filter((r) => r.seeker_id !== mentorId);
  const [q, h] = await Promise.all([withNames(queue), withNames(done.data)]);
  return { queue: q, history: h };
}

export async function decideReview(
  id: string,
  decision: Extract<SkillReviewStatus, 'assessed' | 'declined'>,
  feedback: string,
): Promise<{ error?: string }> {
  const { error } = await supabase.rpc('mentor_review_skill', { p_review: id, p_decision: decision, p_feedback: feedback.trim() });
  return error ? { error: friendly(error.message) } : {};
}
