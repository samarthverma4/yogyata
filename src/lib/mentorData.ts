import { supabase } from './supabase';
import type { Json, MentorProfileRow } from './database.types';
import type { MentorOnboardingState } from '../mentor-onboarding/types';
import type {
  LearningFeedback,
  MenteeRelationship,
  MentorshipRequest,
  MentorshipSession,
  MentorWorkspaceState,
} from '../mentor-workspace/types';

// The mentor workspace screens (from upstream) work on one MentorWorkspaceState object.
// Here that object is loaded from Supabase, and every change is diffed and written back.

const friendly = (message: string) =>
  /violates row-level security|permission denied/i.test(message)
    ? 'You do not have permission to do that.'
    : /starts_at/i.test(message)
      ? 'Sessions must be scheduled in the future.'
      : message;

const dateOf = (iso: string) => iso.slice(0, 10);
const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const localTime = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
/** A local date + HH:mm (as the session form uses) to an ISO timestamp. */
const toInstant = (date: string, time: string) => new Date(`${date}T${time || '00:00'}:00`).toISOString();
const urlOrNull = (u?: string) => (u && /^https?:\/\//i.test(u.trim()) ? u.trim() : null);

interface Notify {
  newRequests?: boolean;
  upcomingSessions?: boolean;
  weeklyDigest?: boolean;
}

// ─── Onboarding ─────────────────────────────────────────────────────────────

export async function hasMentorProfile(userId: string): Promise<boolean> {
  const { data } = await supabase.from('mentor_profiles').select('id').eq('id', userId).maybeSingle();
  return Boolean(data);
}

/** Saves the onboarding answers (never account or password fields) as the mentor's profile. */
export async function saveMentorOnboarding(userId: string, s: MentorOnboardingState): Promise<{ error?: string }> {
  const row = {
    id: userId,
    headline: s.profile.headline.trim(),
    bio: s.profile.bio.trim(),
    role_title: s.profile.currentRole.trim(),
    years_experience: s.profile.yearsOfExperience === '' ? null : Number(s.profile.yearsOfExperience),
    linkedin_url: urlOrNull(s.profile.linkedInUrl),
    portfolio_url: urlOrNull(s.profile.portfolioUrl),
    experience_level: s.expertise.experienceLevel,
    expertise_areas: s.expertise.expertiseAreas,
    technical_skills: s.expertise.technicalSkills,
    industries: s.expertise.industries,
    languages: s.expertise.languages,
    tracks: s.preferences.selectedTracks,
    mentee_levels: s.preferences.preferredMenteeLevels,
    session_format: s.preferences.sessionFormat,
    session_minutes: s.preferences.sessionDurationMinutes,
    session_frequency: s.preferences.sessionFrequency,
    weekly_hours: s.preferences.weeklyAvailabilityHours,
    max_mentees: s.preferences.maxActiveMentees,
    pricing: s.preferences.pricingModel,
    hourly_rate: s.preferences.hourlyRate ?? '',
  };
  const { error } = await supabase.from('mentor_profiles').upsert(row);
  if (error) return { error: friendly(error.message) };
  // the organisation lives on the shared profile row
  if (s.profile.organization?.trim()) {
    await supabase.from('profiles').update({ organization: s.profile.organization.trim() }).eq('id', userId);
  }
  return {};
}

// ─── Load ───────────────────────────────────────────────────────────────────

export async function loadMentorWorkspace(userId: string, email: string): Promise<MentorWorkspaceState> {
  const [me, mp, reqs, ships] = await Promise.all([
    supabase.from('profiles').select('full_name, organization').eq('id', userId).single(),
    supabase.from('mentor_profiles').select('*').eq('id', userId).single(),
    supabase.from('mentorship_requests').select('*').eq('mentor_id', userId).neq('status', 'withdrawn').order('created_at', { ascending: false }),
    supabase.from('mentorships').select('*').eq('mentor_id', userId).order('started_at', { ascending: false }),
  ]);
  for (const r of [me, mp, reqs, ships]) if (r.error) throw new Error(friendly(r.error.message));
  const p = mp.data as MentorProfileRow;
  const shipIds = ships.data!.map((m) => m.id);

  const [items, notes, sessions, feedback, reflections] = shipIds.length
    ? await Promise.all([
        supabase.from('mentorship_action_items').select('*').in('mentorship_id', shipIds).order('created_at'),
        supabase.from('mentorship_notes').select('*').in('mentorship_id', shipIds),
        supabase.from('mentorship_sessions').select('*').in('mentorship_id', shipIds).order('starts_at', { ascending: false }),
        supabase.from('mentor_feedback').select('*').in('mentorship_id', shipIds).order('created_at', { ascending: false }),
        supabase.from('mentor_feedback_reflections').select('*').in('mentorship_id', shipIds),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const seekerIds = [...new Set([...reqs.data!.map((r) => r.seeker_id), ...ships.data!.map((m) => m.seeker_id)])];
  const names = seekerIds.length ? (await supabase.from('profiles').select('id, full_name').in('id', seekerIds)).data ?? [] : [];
  const nameOf = new Map(names.map((n) => [n.id, n.full_name]));
  const shipSeeker = new Map(ships.data!.map((m) => [m.id, m.seeker_id]));
  const menteeName = (shipId: string) => nameOf.get(shipSeeker.get(shipId) ?? '') || 'Mentee';
  const noteOf = new Map((notes.data ?? []).map((n) => [n.mentorship_id, n.body]));
  const reflectionOf = new Map((reflections.data ?? []).map((r) => [r.feedback_id, r.body]));
  const now = Date.now();

  const requests: MentorshipRequest[] = reqs.data!.map((r) => ({
    id: r.id,
    menteeName: nameOf.get(r.seeker_id) || 'Seeker',
    menteeEmail: '',
    careerGoal: r.career_goal,
    relevantSkills: r.skills,
    requestedTrack: r.track,
    introMessage: r.message,
    preferredTime: r.preferred_time,
    status: r.status === 'withdrawn' ? 'declined' : r.status,
    submittedAt: r.created_at,
    responseNote: r.response_note ?? undefined,
  }));

  const sessionList: MentorshipSession[] = (sessions.data ?? []).map((s) => {
    const at = new Date(s.starts_at);
    return {
      id: s.id,
      menteeId: s.mentorship_id,
      menteeName: menteeName(s.mentorship_id),
      title: s.title,
      date: localDate(at),
      startTime: localTime(at),
      durationMinutes: s.duration_minutes,
      sessionFormat: p.session_format === 'flexible' ? 'flexible' : 'online',
      agenda: s.agenda,
      prepNotes: s.meeting_link ?? undefined,
      status: s.status,
      postSessionNotes: s.summary ?? undefined,
    };
  });

  const mentees: MenteeRelationship[] = ships.data!.map((m) => {
    const mine = (sessions.data ?? []).filter((s) => s.mentorship_id === m.id && s.status !== 'cancelled');
    const past = mine.filter((s) => s.status === 'completed').map((s) => s.starts_at).sort();
    const next = mine.filter((s) => s.status === 'scheduled' && Date.parse(s.starts_at) >= now).map((s) => s.starts_at).sort();
    return {
      id: m.id,
      requestId: m.request_id ?? undefined,
      menteeName: nameOf.get(m.seeker_id) || 'Mentee',
      menteeEmail: '',
      careerGoal: m.career_goal,
      mentorshipTrack: m.track,
      status: m.status === 'on_hold' ? 'on-hold' : m.status,
      startDate: dateOf(m.started_at),
      goals: m.goals,
      actionItems: (items.data ?? [])
        .filter((i) => i.mentorship_id === m.id)
        .map((i) => ({ id: i.id, text: i.text, completed: i.completed, dueDate: i.due_date ?? undefined })),
      privateNotes: noteOf.get(m.id) ?? '',
      lastSessionDate: past.length ? dateOf(past[past.length - 1]) : undefined,
      nextSessionDate: next.length ? dateOf(next[0]) : undefined,
    };
  });

  const feedbackList: LearningFeedback[] = (feedback.data ?? []).map((f) => ({
    id: f.id,
    menteeId: f.mentorship_id,
    menteeName: menteeName(f.mentorship_id),
    sessionId: f.session_id ?? undefined,
    feedbackDate: dateOf(f.created_at),
    strengthsObserved: f.strengths,
    improvementAreas: f.improvements,
    recommendedNextSteps: f.next_steps,
    privateMentorReflection: reflectionOf.get(f.id),
    visibility: f.shared ? 'shared-with-mentee' : 'private-mentor-note',
  }));

  const notify = (p.notify ?? {}) as Notify;
  return {
    version: 1,
    mentor: {
      fullName: me.data!.full_name,
      email,
      headline: p.headline,
      currentRole: p.role_title,
      organization: me.data!.organization ?? undefined,
      yearsOfExperience: p.years_experience ?? '',
      bio: p.bio,
      linkedInUrl: p.linkedin_url ?? undefined,
      portfolioUrl: p.portfolio_url ?? undefined,
    },
    expertise: {
      expertiseAreas: p.expertise_areas,
      technicalSkills: p.technical_skills,
      industries: p.industries,
      languages: p.languages,
      experienceLevel: (p.experience_level || 'Senior') as MentorWorkspaceState['expertise']['experienceLevel'],
    },
    preferences: {
      selectedTracks: p.tracks,
      preferredMenteeLevels: p.mentee_levels as MentorWorkspaceState['preferences']['preferredMenteeLevels'],
      sessionFormat: p.session_format as MentorWorkspaceState['preferences']['sessionFormat'],
      sessionDurationMinutes: p.session_minutes,
      sessionFrequency: p.session_frequency as MentorWorkspaceState['preferences']['sessionFrequency'],
      weeklyAvailabilityHours: p.weekly_hours,
      maxActiveMentees: p.max_mentees,
      pricingModel: p.pricing as MentorWorkspaceState['preferences']['pricingModel'],
      hourlyRate: p.hourly_rate,
    },
    requests,
    mentees,
    sessions: sessionList,
    feedback: feedbackList,
    settings: {
      maxActiveMentees: p.max_mentees,
      weeklyAvailabilityHours: p.weekly_hours,
      sessionDurationMinutes: p.session_minutes,
      sessionFrequency: p.session_frequency as MentorWorkspaceState['settings']['sessionFrequency'],
      profileVisibility: p.listed ? 'public' : 'private',
      notifyNewRequests: notify.newRequests ?? true,
      notifyUpcomingSessions: notify.upcomingSessions ?? true,
      weeklyDigest: notify.weeklyDigest ?? false,
    },
    createdAt: p.completed_at,
    lastUpdatedAt: p.updated_at,
  };
}

// ─── Save: diff two states and write what changed ───────────────────────────

const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export async function syncMentorWorkspace(userId: string, prev: MentorWorkspaceState, next: MentorWorkspaceState): Promise<{ error?: string }> {
  const fail = (e: { message: string } | null) => (e ? { error: friendly(e.message) } : null);

  // profile, expertise, preferences and settings all live on mentor_profiles
  if (!same([prev.mentor, prev.expertise, prev.preferences, prev.settings], [next.mentor, next.expertise, next.preferences, next.settings])) {
    // settings and preferences overlap; whichever the screen changed wins
    const pick = <K extends keyof MentorWorkspaceState['settings'] & keyof MentorWorkspaceState['preferences']>(k: K) =>
      next.settings[k] !== prev.settings[k] ? next.settings[k] : next.preferences[k];
    const { error } = await supabase
      .from('mentor_profiles')
      .update({
        headline: next.mentor.headline.trim(),
        bio: next.mentor.bio.trim(),
        role_title: next.mentor.currentRole.trim(),
        years_experience: next.mentor.yearsOfExperience === '' ? null : Number(next.mentor.yearsOfExperience),
        linkedin_url: urlOrNull(next.mentor.linkedInUrl),
        portfolio_url: urlOrNull(next.mentor.portfolioUrl),
        experience_level: next.expertise.experienceLevel,
        expertise_areas: next.expertise.expertiseAreas,
        technical_skills: next.expertise.technicalSkills,
        industries: next.expertise.industries,
        languages: next.expertise.languages,
        tracks: next.preferences.selectedTracks,
        mentee_levels: next.preferences.preferredMenteeLevels,
        session_format: next.preferences.sessionFormat,
        session_minutes: pick('sessionDurationMinutes'),
        session_frequency: pick('sessionFrequency'),
        weekly_hours: pick('weeklyAvailabilityHours'),
        max_mentees: pick('maxActiveMentees'),
        pricing: next.preferences.pricingModel,
        hourly_rate: next.preferences.hourlyRate ?? '',
        listed: next.settings.profileVisibility === 'public',
        notify: {
          newRequests: next.settings.notifyNewRequests,
          upcomingSessions: next.settings.notifyUpcomingSessions,
          weeklyDigest: next.settings.weeklyDigest,
        } as unknown as Json,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
    if (error) return { error: friendly(error.message) };
    if (next.mentor.fullName !== prev.mentor.fullName || next.mentor.organization !== prev.mentor.organization) {
      const r = await supabase
        .from('profiles')
        .update({ full_name: next.mentor.fullName.trim(), organization: next.mentor.organization?.trim() || null })
        .eq('id', userId);
      if (r.error) return { error: friendly(r.error.message) };
    }
  }

  // requests: answering one goes through the database function (it opens the mentorship)
  const oldReq = byId(prev.requests);
  for (const r of next.requests) {
    const before = oldReq.get(r.id);
    if (before?.status === 'pending' && r.status !== 'pending') {
      const { error } = await supabase.rpc('respond_mentorship_request', {
        p_request: r.id,
        p_accept: r.status === 'accepted',
        p_note: r.responseNote ?? '',
      });
      if (error) return { error: friendly(error.message) };
    }
  }

  // mentees: status, goals, action items, private notes (new mentees only come from accepted requests)
  const oldMentee = byId(prev.mentees);
  for (const m of next.mentees) {
    const before = oldMentee.get(m.id);
    if (!before) continue;
    if (before.status !== m.status || !same(before.goals, m.goals)) {
      const e = fail(
        (await supabase
          .from('mentorships')
          .update({ status: m.status === 'on-hold' ? 'on_hold' : m.status, goals: m.goals, updated_at: new Date().toISOString() })
          .eq('id', m.id)).error,
      );
      if (e) return e;
    }
    if (before.privateNotes !== m.privateNotes) {
      const e = fail(
        (await supabase
          .from('mentorship_notes')
          .upsert({ mentorship_id: m.id, mentor_id: userId, body: m.privateNotes, updated_at: new Date().toISOString() })).error,
      );
      if (e) return e;
    }
    const oldItems = byId(before.actionItems ?? []);
    const newItems = byId(m.actionItems ?? []);
    for (const it of m.actionItems ?? []) {
      const was = oldItems.get(it.id);
      const e = !was
        ? fail((await supabase.from('mentorship_action_items').insert({ mentorship_id: m.id, text: it.text, due_date: it.dueDate || null })).error)
        : !same(was, it)
          ? fail(
              (await supabase
                .from('mentorship_action_items')
                .update({ text: it.text, completed: it.completed, due_date: it.dueDate || null })
                .eq('id', it.id)).error,
            )
          : null;
      if (e) return e;
    }
    for (const it of before.actionItems ?? []) {
      if (!newItems.has(it.id)) {
        const e = fail((await supabase.from('mentorship_action_items').delete().eq('id', it.id)).error);
        if (e) return e;
      }
    }
  }

  // sessions
  const oldSession = byId(prev.sessions);
  const newSession = byId(next.sessions);
  for (const s of next.sessions) {
    const was = oldSession.get(s.id);
    const fields = {
      title: s.title.trim(),
      starts_at: toInstant(s.date, s.startTime),
      duration_minutes: s.durationMinutes,
      agenda: s.agenda ?? '',
      meeting_link: urlOrNull(s.prepNotes),
    };
    const e = !was
      ? fail((await supabase.from('mentorship_sessions').insert({ mentorship_id: s.menteeId, ...fields })).error)
      : !same(was, s)
        ? fail(
            (await supabase
              .from('mentorship_sessions')
              .update({ ...fields, status: s.status, summary: s.postSessionNotes ?? null })
              .eq('id', s.id)).error,
          )
        : null;
    if (e) return e;
  }
  for (const s of prev.sessions) {
    if (!newSession.has(s.id)) {
      const e = fail((await supabase.from('mentorship_sessions').delete().eq('id', s.id)).error);
      if (e) return e;
    }
  }

  // feedback (+ the private reflection, stored apart from what the mentee can read)
  const oldFb = byId(prev.feedback);
  const newFb = byId(next.feedback);
  for (const f of next.feedback) {
    const was = oldFb.get(f.id);
    const fields = {
      strengths: f.strengthsObserved,
      improvements: f.improvementAreas,
      next_steps: f.recommendedNextSteps,
      shared: f.visibility === 'shared-with-mentee',
    };
    let id = f.id;
    if (!was) {
      const ins = await supabase
        .from('mentor_feedback')
        .insert({ mentorship_id: f.menteeId, session_id: f.sessionId || null, ...fields })
        .select('id')
        .single();
      if (ins.error) return { error: friendly(ins.error.message) };
      id = ins.data.id;
    } else if (!same(was, f)) {
      const e = fail((await supabase.from('mentor_feedback').update(fields).eq('id', f.id)).error);
      if (e) return e;
    }
    if (!was || was.privateMentorReflection !== f.privateMentorReflection) {
      const body = f.privateMentorReflection?.trim() ?? '';
      const e = body
        ? fail((await supabase.from('mentor_feedback_reflections').upsert({ feedback_id: id, mentorship_id: f.menteeId, body })).error)
        : was
          ? fail((await supabase.from('mentor_feedback_reflections').delete().eq('feedback_id', id)).error)
          : null;
      if (e) return e;
    }
  }
  for (const f of prev.feedback) {
    if (!newFb.has(f.id)) {
      const e = fail((await supabase.from('mentor_feedback').delete().eq('id', f.id)).error);
      if (e) return e;
    }
  }
  return {};
}
