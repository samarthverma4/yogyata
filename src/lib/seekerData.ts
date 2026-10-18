import { supabase } from './supabase';
import type { Json, PassportSkill, SubmissionRow, TaskRow } from './database.types';
import type { OnboardingState } from '../onboarding/types';

export type SubmissionWithTask = SubmissionRow & { task: Pick<TaskRow, 'id' | 'title' | 'org_name' | 'status'> | null };

const friendly = (message: string) =>
  /duplicate key|passport_skills_unique_name/i.test(message)
    ? 'That skill is already in your passport.'
    : /violates row-level security/i.test(message)
      ? 'You do not have permission to do that.'
      : message;

export async function hasCompletedOnboarding(userId: string): Promise<boolean> {
  const { data } = await supabase.from('seeker_details').select('id').eq('id', userId).maybeSingle();
  return Boolean(data);
}

/** Stores onboarding answers (never the account or password fields) and turns declared skills into passport entries. */
export async function saveSeekerOnboarding(userId: string, state: OnboardingState): Promise<{ error?: string }> {
  const { professional, education, careerGoals, jobPrefs, privacy, resumeSkills } = state;
  const answers = {
    professional,
    education,
    careerGoals,
    jobPrefs,
    privacy,
    resumeFileName: resumeSkills.resumeFile?.name ?? null,
  } as unknown as Json;
  const headline = (professional.headline || professional.currentTitle || '').slice(0, 200);
  const location = [professional.city, professional.country].filter(Boolean).join(', ');

  const exists = await hasCompletedOnboarding(userId);
  const { error } = exists
    ? await supabase.from('seeker_details').update({ headline, location, answers }).eq('id', userId)
    : await supabase.from('seeker_details').insert({ id: userId, headline, location, answers });
  if (error) return { error: friendly(error.message) };

  for (const s of resumeSkills.skills) {
    const res = await declareSkill(userId, s.name, s.category, 'Declared during onboarding');
    if (res.error && !/already in your passport/.test(res.error)) return res;
  }
  return {};
}

export async function listPassport(userId: string): Promise<PassportSkill[]> {
  const { data, error } = await supabase
    .from('passport_skills')
    .select('*')
    .eq('seeker_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(friendly(error.message));
  return data;
}

export async function declareSkill(userId: string, name: string, category = '', evidence = ''): Promise<{ error?: string }> {
  const skill_name = name.trim();
  if (!skill_name) return { error: 'Enter a skill name.' };
  const { error } = await supabase.from('passport_skills').insert({ seeker_id: userId, skill_name, category, evidence });
  return error ? { error: friendly(error.message) } : {};
}

export async function removeDeclaredSkill(id: string): Promise<{ error?: string }> {
  const { error } = await supabase.from('passport_skills').delete().eq('id', id).eq('level', 'declared');
  return error ? { error: friendly(error.message) } : {};
}

export async function listOpenTasks(): Promise<TaskRow[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('status', 'published')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(friendly(error.message));
  return data;
}

export async function listMySubmissions(userId: string): Promise<SubmissionWithTask[]> {
  const { data, error } = await supabase
    .from('submissions')
    .select('*, task:tasks(id, title, org_name, status)')
    .eq('seeker_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(friendly(error.message));
  return data as SubmissionWithTask[];
}

export async function submitWork(
  userId: string,
  taskId: string,
  deliverableUrl: string,
  notes: string,
  existingId?: string,
): Promise<{ error?: string }> {
  const payload = { deliverable_url: deliverableUrl.trim(), notes: notes.trim() };
  const { error } = existingId
    ? await supabase.from('submissions').update(payload).eq('id', existingId)
    : await supabase.from('submissions').insert({ ...payload, seeker_id: userId, task_id: taskId });
  if (!error) return {};
  if (/deliverable_url_check/.test(error.message)) return { error: 'The link must start with http:// or https://.' };
  if (/duplicate key/.test(error.message)) return { error: 'You have already submitted work for this task.' };
  return { error: friendly(error.message) };
}

export async function withdrawSubmission(id: string): Promise<{ error?: string }> {
  const { error } = await supabase.from('submissions').delete().eq('id', id).eq('status', 'submitted');
  return error ? { error: friendly(error.message) } : {};
}
