import { supabase } from './supabase';
import type { ApplicationStatus, JobApplication, JobPosting, PassportSkill, PostingStatus } from './database.types';

const friendly = (message: string) =>
  /job_applications_posting_id_seeker_id_key|duplicate key/i.test(message)
    ? 'You have already applied to this role.'
    : /violates row-level security|permission denied/i.test(message)
      ? 'This role is no longer open, or you do not have permission.'
      : /only withdraw|only the applicant/i.test(message)
        ? message.replace(/^.*?(You can|Only)/, '$1')
        : message;

/** How an application status reads to people (both sides use it). */
export const APPLICATION_LABEL: Record<ApplicationStatus, string> = {
  applied: 'New',
  in_review: 'In review',
  interview: 'Interviewing',
  offer: 'Offer',
  rejected: 'Not selected',
  withdrawn: 'Withdrawn',
};

type Result = Promise<{ error?: string }>;
const done = (error: { message: string } | null): { error?: string } => (error ? { error: friendly(error.message) } : {});

export type PostingDraft = Pick<
  JobPosting,
  'title' | 'category' | 'description' | 'required_skills' | 'experience' | 'work_arrangement' | 'location' | 'compensation' | 'deadline' | 'status'
>;

export const EMPTY_POSTING: PostingDraft = {
  title: '',
  category: 'job',
  description: '',
  required_skills: [],
  experience: '',
  work_arrangement: 'hybrid',
  location: '',
  compensation: '',
  deadline: null,
  status: 'draft',
};

// ─── Recruiter side ─────────────────────────────────────────────────────────

export type PostingWithCounts = JobPosting & { applicants: number; newApplicants: number };

export async function listMyPostings(recruiterId: string): Promise<PostingWithCounts[]> {
  const { data, error } = await supabase
    .from('job_postings')
    .select('*, job_applications(status)')
    .eq('recruiter_id', recruiterId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(friendly(error.message));
  return (data as (JobPosting & { job_applications: { status: ApplicationStatus }[] })[]).map(({ job_applications: apps, ...p }) => ({
    ...p,
    applicants: apps.filter((a) => a.status !== 'withdrawn').length,
    newApplicants: apps.filter((a) => a.status === 'applied').length,
  }));
}

export async function savePosting(recruiterId: string, draft: PostingDraft, id?: string): Result {
  const row = { ...draft, title: draft.title.trim(), description: draft.description.trim(), deadline: draft.deadline || null };
  return done(
    id
      ? (await supabase.from('job_postings').update({ ...row, updated_at: new Date().toISOString() }).eq('id', id)).error
      : (await supabase.from('job_postings').insert({ ...row, recruiter_id: recruiterId })).error,
  );
}

export async function setPostingStatus(id: string, status: PostingStatus): Result {
  return done((await supabase.from('job_postings').update({ status, updated_at: new Date().toISOString() }).eq('id', id)).error);
}

export async function deletePosting(id: string): Result {
  return done((await supabase.from('job_postings').delete().eq('id', id)).error);
}

export type Applicant = JobApplication & { name: string; skills: Pick<PassportSkill, 'skill_name' | 'level'>[] };

export async function listApplicants(postingId: string): Promise<Applicant[]> {
  const { data, error } = await supabase
    .from('job_applications')
    .select('*')
    .eq('posting_id', postingId)
    .neq('status', 'withdrawn')
    .order('created_at', { ascending: false });
  if (error) throw new Error(friendly(error.message));
  const ids = data.map((a) => a.seeker_id);
  if (!ids.length) return [];
  const [names, skills] = await Promise.all([
    supabase.from('profiles').select('id, full_name').in('id', ids),
    supabase.from('passport_skills').select('seeker_id, skill_name, level').in('seeker_id', ids),
  ]);
  const name = new Map((names.data ?? []).map((n) => [n.id, n.full_name]));
  return data.map((a) => ({
    ...a,
    name: name.get(a.seeker_id) || 'Applicant',
    skills: (skills.data ?? []).filter((s) => s.seeker_id === a.seeker_id),
  }));
}

export async function setApplicationStatus(id: string, status: Exclude<ApplicationStatus, 'withdrawn'>): Result {
  return done((await supabase.from('job_applications').update({ status }).eq('id', id)).error);
}

// ─── Seeker side ────────────────────────────────────────────────────────────

export type OpenPosting = JobPosting & { company: string; companyLocation: string };

export async function listOpenPostings(): Promise<OpenPosting[]> {
  const { data, error } = await supabase
    .from('job_postings')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: false });
  if (error) throw new Error(friendly(error.message));
  const ids = [...new Set(data.map((p) => p.recruiter_id))];
  const companies = ids.length
    ? ((await supabase.from('recruiter_profiles').select('id, company_name, location').in('id', ids)).data ?? [])
    : [];
  const of = new Map(companies.map((c) => [c.id, c]));
  const today = new Date().toISOString().slice(0, 10);
  return data
    .filter((p) => !p.deadline || p.deadline >= today)
    .map((p) => ({ ...p, company: of.get(p.recruiter_id)?.company_name || 'Hiring company', companyLocation: of.get(p.recruiter_id)?.location ?? '' }));
}

export type MyApplication = JobApplication & { posting: Pick<JobPosting, 'id' | 'title' | 'category' | 'status'> | null };

export async function listMyApplications(seekerId: string): Promise<MyApplication[]> {
  const { data, error } = await supabase
    .from('job_applications')
    .select('*, posting:job_postings(id, title, category, status)')
    .eq('seeker_id', seekerId)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(friendly(error.message));
  return data as unknown as MyApplication[];
}

export async function applyToPosting(seekerId: string, postingId: string, coverNote: string): Result {
  return done(
    (await supabase.from('job_applications').insert({ seeker_id: seekerId, posting_id: postingId, cover_note: coverNote.trim() })).error,
  );
}

export async function withdrawApplication(id: string): Result {
  return done((await supabase.from('job_applications').update({ status: 'withdrawn' }).eq('id', id)).error);
}
