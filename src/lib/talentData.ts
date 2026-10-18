import { supabase } from './supabase';
import type { Invitation, InvitationStatus, Json, TalentResult } from './database.types';

export type InvitationWithName = Invitation & { otherName: string };

const friendly = (message: string) =>
  /invitations_one_pending|duplicate key/i.test(message)
    ? 'You already have a pending invitation with this person.'
    : /violates row-level security/i.test(message)
      ? 'This person is no longer open to recruiters.'
      : /role_title_check/i.test(message)
        ? 'Add a role title (2 to 120 characters).'
        : /permission denied|only recruiters/i.test(message)
          ? 'Sign in with a recruiter account to search talent.'
          : message;

// ─── Recruiter side ─────────────────────────────────────────────────────────

export async function searchTalent(query: string, verifiedOnly: boolean): Promise<TalentResult[]> {
  const { data, error } = await supabase.rpc('search_talent', { p_query: query.trim(), p_verified_only: verifiedOnly });
  if (error) throw new Error(friendly(error.message));
  // the database builds `skills` with jsonb_agg as [{ name, level }]
  return (data ?? []) as unknown as TalentResult[];
}

async function withNames(rows: Invitation[], key: 'seeker_id' | 'recruiter_id'): Promise<InvitationWithName[]> {
  const ids = [...new Set(rows.map((r) => r[key]))];
  if (!ids.length) return [];
  const { data } = await supabase.from('profiles').select('id, full_name, organization').in('id', ids);
  const label = new Map(
    (data ?? []).map((p) => [p.id, p.organization ? `${p.full_name}, ${p.organization}` : p.full_name]),
  );
  return rows.map((r) => ({ ...r, otherName: label.get(r[key]) || (key === 'seeker_id' ? 'Seeker' : 'Recruiter') }));
}

export async function listSentInvitations(recruiterId: string): Promise<InvitationWithName[]> {
  const { data, error } = await supabase
    .from('invitations')
    .select('*')
    .eq('recruiter_id', recruiterId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(friendly(error.message));
  return withNames(data, 'seeker_id');
}

export async function sendInvitation(
  recruiterId: string,
  seekerId: string,
  roleTitle: string,
  message: string,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('invitations')
    .insert({ recruiter_id: recruiterId, seeker_id: seekerId, role_title: roleTitle.trim(), message: message.trim() });
  return error ? { error: friendly(error.message) } : {};
}

export async function withdrawInvitation(id: string): Promise<{ error?: string }> {
  const { error } = await supabase.from('invitations').delete().eq('id', id).eq('status', 'pending');
  return error ? { error: friendly(error.message) } : {};
}

// ─── Seeker side ────────────────────────────────────────────────────────────

export async function listMyInvitations(seekerId: string): Promise<InvitationWithName[]> {
  const { data, error } = await supabase
    .from('invitations')
    .select('*')
    .eq('seeker_id', seekerId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(friendly(error.message));
  return withNames(data, 'recruiter_id');
}

export async function respondToInvitation(
  id: string,
  status: Extract<InvitationStatus, 'accepted' | 'declined'>,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('invitations')
    .update({ status, responded_at: new Date().toISOString() })
    .eq('id', id);
  return error ? { error: friendly(error.message) } : {};
}

interface PrivacyAnswers {
  visibility?: string;
  recruiterSharingConsent?: boolean;
}

/** Recruiters can find a seeker only when both onboarding privacy choices allow it. */
export async function getRecruiterVisibility(seekerId: string): Promise<boolean> {
  const { data } = await supabase.from('seeker_details').select('answers').eq('id', seekerId).maybeSingle();
  const privacy = ((data?.answers ?? {}) as { privacy?: PrivacyAnswers }).privacy ?? {};
  return privacy.visibility === 'discoverable' && privacy.recruiterSharingConsent === true;
}

export async function setRecruiterVisibility(seekerId: string, visible: boolean): Promise<{ error?: string }> {
  const { data, error } = await supabase.from('seeker_details').select('answers').eq('id', seekerId).maybeSingle();
  if (error) return { error: error.message };
  const answers = (data?.answers ?? {}) as { privacy?: PrivacyAnswers } & Record<string, unknown>;
  const next = {
    ...answers,
    privacy: { ...answers.privacy, visibility: visible ? 'discoverable' : 'private', recruiterSharingConsent: visible },
  } as unknown as Json;
  const { error: upError } = await supabase.from('seeker_details').update({ answers: next }).eq('id', seekerId);
  return upError ? { error: upError.message } : {};
}
