import { supabase } from './supabase';
import { scopedKey } from './storageScope';
import type { Json, PassportSkill, PipelineEntry, RecruiterProfileRow, ScorecardRow, InterviewRow, TalentResult } from './database.types';
import type { RecruiterOnboardingState } from '../recruiter-onboarding/types';
import type {
  CandidateProfile,
  CompanyProfile,
  Interview,
  PipelineCandidate,
  PipelinePriority,
  PipelineStage,
  RecruiterSettings,
  RecruiterWorkspaceState,
  Scorecard,
  SkillEvidence,
} from '../recruiter-workspace/types';

// The recruiter workspace screens (from upstream) take one RecruiterWorkspaceState. Here it is
// built from Supabase: candidates come from talent search (opted-in seekers with proven skills)
// plus anyone already in this recruiter's pipeline or applying to their postings.

const friendly = (message: string) =>
  /pipeline_entries_recruiter_id_seeker_id_target_role_key|duplicate key/i.test(message)
    ? 'This person is already in your pipeline for that role.'
    : /violates row-level security|permission denied/i.test(message)
      ? 'This person is no longer open to recruiters, or you do not have permission.'
      : message;

const urlOrNull = (u?: string) => (u && /^https?:\/\//i.test(u.trim()) ? u.trim() : null);
const day = (iso: string) => iso.slice(0, 10);
const pad = (n: number) => String(n).padStart(2, '0');
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const toInstant = (date: string, time: string) => new Date(`${date}T${time || '09:00'}:00`).toISOString();
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';

const DEFAULT_SETTINGS: RecruiterSettings = {
  defaultInterviewDuration: 45,
  defaultInterviewFormat: 'video',
  defaultHiringFilterRole: '',
  simulatedNotifications: { newApplications: true, interviewReminders: true, scorecardAlerts: true },
  candidateVisibility: 'public',
};

// Bookmarks are a personal convenience, kept in this browser per account.
const SAVED_KEY = 'yogyata-recruiter-saved-candidates';
function readSaved(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(scopedKey(SAVED_KEY)) || '[]') as string[]);
  } catch {
    return new Set();
  }
}
export function toggleSavedCandidate(id: string) {
  const s = readSaved();
  if (s.has(id)) s.delete(id);
  else s.add(id);
  try {
    localStorage.setItem(scopedKey(SAVED_KEY), JSON.stringify([...s]));
  } catch {
    /* storage unavailable: the bookmark is not kept */
  }
}

// ─── Onboarding ─────────────────────────────────────────────────────────────

export async function hasRecruiterProfile(userId: string): Promise<boolean> {
  const { data } = await supabase.from('recruiter_profiles').select('id').eq('id', userId).maybeSingle();
  return Boolean(data);
}

const profileColumns = (p: RecruiterOnboardingState['profile'], c: CompanyProfile, h: RecruiterOnboardingState['hiring']) => ({
  job_title: p.jobTitle.trim(),
  recruiting_experience: p.recruitingExperience,
  specialization: p.hiringSpecialization,
  bio: p.professionalBio.trim(),
  linkedin_url: urlOrNull(p.linkedInUrl),
  company_name: c.companyName.trim(),
  industry: c.industry,
  company_size: c.companySize,
  website: urlOrNull(c.website),
  company_description: c.description.trim(),
  location: c.location.trim(),
  company_stage: c.companyStage,
  culture: c.workCultureSummary.trim(),
  hiring_domains: c.hiringDomains,
  roles_hired: h.rolesCommonlyHired,
  skills_sought: h.technicalSkillsSought,
  experience_ranges: h.experienceRanges,
  employment_types: h.employmentTypes,
  work_arrangements: h.workArrangements,
  preferred_locations: h.preferredLocations,
  priorities: h.hiringPriorities,
});

/** Saves onboarding answers (never account or password fields) as the recruiter's profile. */
export async function saveRecruiterOnboarding(userId: string, s: RecruiterOnboardingState): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('recruiter_profiles')
    .upsert({ id: userId, ...profileColumns(s.profile, s.company, s.hiring) });
  if (error) return { error: friendly(error.message) };
  if (s.company.companyName.trim()) {
    await supabase.from('profiles').update({ organization: s.company.companyName.trim() }).eq('id', userId);
  }
  return {};
}

// ─── Load ───────────────────────────────────────────────────────────────────

function toCandidate(
  id: string,
  name: string,
  headline: string,
  location: string,
  skills: { name: string; level: PassportSkill['level']; evidence?: string }[],
  saved: Set<string>,
): CandidateProfile {
  const of = (l: PassportSkill['level']) => skills.filter((s) => s.level === l).map((s) => s.name);
  const evidence: SkillEvidence[] = skills.map((s) => ({
    skillName: s.name,
    tier: s.level,
    evidenceType: s.level === 'verified' ? 'project-submission' : s.level === 'assessed' ? 'assessment-test' : 'self-claim',
    description:
      s.evidence ||
      (s.level === 'verified'
        ? 'Confirmed by a founder who reviewed submitted work.'
        : s.level === 'assessed'
          ? 'Passed a Yogyata assessment or a mentor review.'
          : 'Declared by the candidate.'),
  }));
  return {
    id,
    name,
    avatarInitials: initials(name),
    headline,
    location,
    experienceYears: 0,
    experienceRange: '',
    skills: skills.map((s) => s.name),
    skillEvidence: evidence,
    declaredSkills: of('declared'),
    assessedSkills: of('assessed'),
    verifiedSkills: of('verified'),
    employmentPreferences: [],
    careerInterests: [],
    bio: headline,
    isSaved: saved.has(id),
  };
}

export async function loadRecruiterWorkspace(userId: string): Promise<RecruiterWorkspaceState> {
  const [me, rp, talent, pipe, ints, cards] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', userId).single(),
    supabase.from('recruiter_profiles').select('*').eq('id', userId).single(),
    supabase.rpc('search_talent', { p_query: '', p_verified_only: false }),
    supabase.from('pipeline_entries').select('*').eq('recruiter_id', userId).order('updated_at', { ascending: false }),
    supabase.from('interviews').select('*').eq('recruiter_id', userId).order('starts_at', { ascending: false }),
    supabase.from('scorecards').select('*').eq('recruiter_id', userId).order('created_at', { ascending: false }),
  ]);
  for (const r of [me, rp, talent, pipe, ints, cards]) if (r.error) throw new Error(friendly(r.error.message));
  const p = rp.data as RecruiterProfileRow;
  const saved = readSaved();

  const found = (talent.data ?? []) as unknown as TalentResult[];
  const candidates = new Map(found.map((t) => [t.seeker_id, toCandidate(t.seeker_id, t.full_name, t.headline, t.location, t.skills, saved)]));

  // people already in the pipeline or interviewing may no longer show in search; load them directly
  const extra = [
    ...new Set([...(pipe.data as PipelineEntry[]).map((x) => x.seeker_id), ...(ints.data as InterviewRow[]).map((x) => x.seeker_id)]),
  ].filter((id) => !candidates.has(id));
  if (extra.length) {
    const [names, skills] = await Promise.all([
      supabase.from('profiles').select('id, full_name').in('id', extra),
      supabase.from('passport_skills').select('seeker_id, skill_name, level, evidence').in('seeker_id', extra),
    ]);
    for (const n of names.data ?? []) {
      const own = (skills.data ?? []).filter((s) => s.seeker_id === n.id).map((s) => ({ name: s.skill_name, level: s.level, evidence: s.evidence }));
      candidates.set(n.id, toCandidate(n.id, n.full_name, '', '', own, saved));
    }
  }
  const nameOf = (id: string) => candidates.get(id)?.name ?? 'Candidate';

  const pipeline: PipelineCandidate[] = (pipe.data as PipelineEntry[]).map((x) => ({
    id: x.id,
    candidateId: x.seeker_id,
    candidateName: nameOf(x.seeker_id),
    targetRole: x.target_role,
    stage: x.stage,
    priority: x.priority as PipelinePriority,
    dateAdded: day(x.created_at),
    lastUpdated: day(x.updated_at),
    recruiterNotes: x.notes,
    nextAction: x.next_action,
    tags: x.tags,
  }));

  const interviews: Interview[] = (ints.data as InterviewRow[]).map((i) => {
    const at = new Date(i.starts_at);
    return {
      id: i.id,
      candidateId: i.seeker_id,
      candidateName: nameOf(i.seeker_id),
      targetRole: i.target_role,
      round: i.round as Interview['round'],
      date: localDate(at),
      startTime: localTime(at),
      durationMinutes: i.duration_minutes,
      format: i.format as Interview['format'],
      locationOrLink: i.location_or_link,
      assignedInterviewers: i.interviewers,
      agenda: i.agenda,
      prepNotes: '',
      status: i.status,
      cancellationReason: i.cancellation_reason ?? undefined,
    };
  });

  const scorecards: Scorecard[] = (cards.data as ScorecardRow[]).map((c) => ({
    id: c.id,
    candidateId: c.seeker_id,
    candidateName: nameOf(c.seeker_id),
    interviewId: c.interview_id ?? undefined,
    targetRole: c.target_role,
    round: c.round as Scorecard['round'],
    interviewerName: c.interviewer_name,
    technicalRating: c.technical,
    problemSolvingRating: c.problem_solving,
    communicationRating: c.communication,
    roleAlignmentRating: c.role_alignment,
    strengths: c.strengths,
    areasOfConcern: c.concerns,
    interviewNotes: c.notes,
    recommendation: c.recommendation as Scorecard['recommendation'],
    submittedAt: c.created_at,
  }));

  return {
    recruiter: {
      recruiterName: me.data!.full_name,
      jobTitle: p.job_title,
      recruitingExperience: p.recruiting_experience,
      hiringSpecialization: p.specialization,
      professionalBio: p.bio,
      linkedInUrl: p.linkedin_url ?? '',
    },
    company: {
      companyName: p.company_name,
      industry: p.industry,
      companySize: p.company_size,
      website: p.website ?? '',
      description: p.company_description,
      location: p.location,
      hiringDomains: p.hiring_domains,
      companyStage: p.company_stage,
      workCultureSummary: p.culture,
    },
    hiring: {
      rolesCommonlyHired: p.roles_hired,
      technicalSkillsSought: p.skills_sought,
      experienceRanges: p.experience_ranges,
      employmentTypes: p.employment_types,
      workArrangements: p.work_arrangements,
      preferredLocations: p.preferred_locations,
      hiringPriorities: p.priorities,
    },
    candidates: [...candidates.values()],
    pipeline,
    interviews,
    scorecards,
    settings: { ...DEFAULT_SETTINGS, ...((p.settings ?? {}) as Partial<RecruiterSettings>) },
  };
}

// ─── Actions ────────────────────────────────────────────────────────────────

type Result = Promise<{ error?: string }>;
const done = (error: { message: string } | null): { error?: string } => (error ? { error: friendly(error.message) } : {});
const now = () => new Date().toISOString();

export async function addToPipeline(seekerId: string, role: string, stage: PipelineStage, tags: string[] = []): Result {
  return done(
    (await supabase.from('pipeline_entries').insert({
      seeker_id: seekerId,
      target_role: role,
      stage,
      tags,
      notes: 'Added to pipeline from Talent Search.',
      next_action: 'Review profile and schedule initial round',
    })).error,
  );
}

export async function updatePipeline(
  id: string,
  data: { stage?: PipelineStage; recruiterNotes?: string; nextAction?: string; priority?: PipelinePriority; tags?: string[] },
): Result {
  return done(
    (await supabase
      .from('pipeline_entries')
      .update({
        ...(data.stage && { stage: data.stage }),
        ...(data.recruiterNotes !== undefined && { notes: data.recruiterNotes }),
        ...(data.nextAction !== undefined && { next_action: data.nextAction }),
        ...(data.priority && { priority: data.priority }),
        ...(data.tags && { tags: data.tags }),
        updated_at: now(),
      })
      .eq('id', id)).error,
  );
}

export async function removeFromPipeline(id: string): Result {
  return done((await supabase.from('pipeline_entries').delete().eq('id', id)).error);
}

const interviewColumns = (i: Partial<Interview>) => ({
  ...(i.targetRole !== undefined && { target_role: i.targetRole }),
  ...(i.round && { round: i.round }),
  ...(i.date && { starts_at: toInstant(i.date, i.startTime ?? '09:00') }),
  ...(i.durationMinutes && { duration_minutes: i.durationMinutes }),
  ...(i.format && { format: i.format }),
  ...(i.locationOrLink !== undefined && { location_or_link: i.locationOrLink }),
  ...(i.assignedInterviewers && { interviewers: i.assignedInterviewers }),
  ...(i.agenda !== undefined && { agenda: [i.agenda, i.prepNotes].filter(Boolean).join('\n\n') }),
  ...(i.status && { status: i.status }),
  ...(i.cancellationReason !== undefined && { cancellation_reason: i.cancellationReason }),
});

export async function scheduleInterview(i: Omit<Interview, 'id'>): Result {
  return done(
    (await supabase.from('interviews').insert({
      seeker_id: i.candidateId,
      target_role: i.targetRole,
      starts_at: toInstant(i.date, i.startTime),
      ...interviewColumns(i),
    })).error,
  );
}

export async function updateInterview(id: string, updates: Partial<Interview>): Result {
  return done((await supabase.from('interviews').update(interviewColumns(updates)).eq('id', id)).error);
}

const scorecardColumns = (s: Partial<Scorecard>) => ({
  ...(s.interviewId !== undefined && { interview_id: s.interviewId || null }),
  ...(s.targetRole !== undefined && { target_role: s.targetRole }),
  ...(s.round && { round: s.round }),
  ...(s.interviewerName !== undefined && { interviewer_name: s.interviewerName }),
  ...(s.technicalRating && { technical: s.technicalRating }),
  ...(s.problemSolvingRating && { problem_solving: s.problemSolvingRating }),
  ...(s.communicationRating && { communication: s.communicationRating }),
  ...(s.roleAlignmentRating && { role_alignment: s.roleAlignmentRating }),
  ...(s.strengths !== undefined && { strengths: s.strengths }),
  ...(s.areasOfConcern !== undefined && { concerns: s.areasOfConcern }),
  ...(s.interviewNotes !== undefined && { notes: s.interviewNotes }),
  ...(s.recommendation && { recommendation: s.recommendation }),
});

export async function createScorecard(s: Omit<Scorecard, 'id' | 'submittedAt'>): Result {
  return done(
    (await supabase.from('scorecards').insert({
      seeker_id: s.candidateId,
      target_role: s.targetRole,
      round: s.round,
      interviewer_name: s.interviewerName,
      technical: s.technicalRating,
      problem_solving: s.problemSolvingRating,
      communication: s.communicationRating,
      role_alignment: s.roleAlignmentRating,
      recommendation: s.recommendation,
      ...scorecardColumns(s),
    })).error,
  );
}

export async function updateScorecard(id: string, updates: Partial<Scorecard>): Result {
  return done((await supabase.from('scorecards').update(scorecardColumns(updates)).eq('id', id)).error);
}

export async function deleteScorecard(id: string): Result {
  return done((await supabase.from('scorecards').delete().eq('id', id)).error);
}

export async function saveCompany(userId: string, c: CompanyProfile): Result {
  const { error } = await supabase
    .from('recruiter_profiles')
    .update({
      company_name: c.companyName.trim(),
      industry: c.industry,
      company_size: c.companySize,
      website: urlOrNull(c.website),
      company_description: c.description.trim(),
      location: c.location.trim(),
      company_stage: c.companyStage,
      culture: c.workCultureSummary.trim(),
      hiring_domains: c.hiringDomains,
      updated_at: now(),
    })
    .eq('id', userId);
  if (!error && c.companyName.trim()) {
    await supabase.from('profiles').update({ organization: c.companyName.trim() }).eq('id', userId);
  }
  return done(error);
}

export async function saveSettings(userId: string, s: RecruiterSettings): Result {
  return done(
    (await supabase.from('recruiter_profiles').update({ settings: s as unknown as Json, updated_at: now() }).eq('id', userId)).error,
  );
}
