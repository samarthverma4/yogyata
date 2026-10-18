import { scopedKey } from '../lib/storageScope';
import type { MentorOnboardingState, MentorOnboardingView } from './types';
import { INITIAL_MENTOR_ONBOARDING_STATE } from './types';

export const MENTOR_STORAGE_DRAFT_KEY = 'yogyata_mentor_onboarding_draft';
export const MENTOR_STORAGE_VERSION = 1;

export interface StoredMentorDraft {
  version: number;
  savedAt: string;
  currentView: MentorOnboardingView;
  state: MentorOnboardingState;
}

/**
 * Sanitizes URLs to prevent unsafe schemes (e.g. javascript: or data:).
 */
export function sanitizeUrl(url?: string): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (
    trimmed.toLowerCase().startsWith('javascript:') ||
    trimmed.toLowerCase().startsWith('data:') ||
    trimmed.toLowerCase().startsWith('vbscript:')
  ) {
    return '#';
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * Strips raw password credentials from the account state before storage.
 */
function sanitizeStateForStorage(state: MentorOnboardingState): MentorOnboardingState {
  return {
    ...state,
    account: {
      ...state.account,
      password: '',
      confirmPassword: '',
    },
  };
}

/**
 * Safely saves mentor onboarding progress to localStorage.
 */
export function saveMentorOnboardingDraft(
  state: MentorOnboardingState,
  currentView: MentorOnboardingView
): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    const payload: StoredMentorDraft = {
      version: MENTOR_STORAGE_VERSION,
      savedAt: new Date().toISOString(),
      currentView,
      state: sanitizeStateForStorage(state),
    };
    window.localStorage.setItem(scopedKey(MENTOR_STORAGE_DRAFT_KEY), JSON.stringify(payload));
    return true;
  } catch (err) {
    console.warn('Failed to save mentor onboarding draft:', err);
    return false;
  }
}

/**
 * Loads and restores mentor onboarding draft from localStorage.
 */
export function loadMentorOnboardingDraft(): StoredMentorDraft | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(scopedKey(MENTOR_STORAGE_DRAFT_KEY));
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.state) return null;

    // Merge loaded state safely onto initial defaults
    const safeState: MentorOnboardingState = {
      account: {
        ...INITIAL_MENTOR_ONBOARDING_STATE.account,
        ...(parsed.state.account || {}),
        password: '',
        confirmPassword: '',
      },
      profile: {
        ...INITIAL_MENTOR_ONBOARDING_STATE.profile,
        ...(parsed.state.profile || {}),
      },
      expertise: {
        ...INITIAL_MENTOR_ONBOARDING_STATE.expertise,
        ...(parsed.state.expertise || {}),
        expertiseAreas: Array.isArray(parsed.state.expertise?.expertiseAreas)
          ? parsed.state.expertise.expertiseAreas
          : INITIAL_MENTOR_ONBOARDING_STATE.expertise.expertiseAreas,
        technicalSkills: Array.isArray(parsed.state.expertise?.technicalSkills)
          ? parsed.state.expertise.technicalSkills
          : INITIAL_MENTOR_ONBOARDING_STATE.expertise.technicalSkills,
        industries: Array.isArray(parsed.state.expertise?.industries)
          ? parsed.state.expertise.industries
          : INITIAL_MENTOR_ONBOARDING_STATE.expertise.industries,
        languages: Array.isArray(parsed.state.expertise?.languages)
          ? parsed.state.expertise.languages
          : INITIAL_MENTOR_ONBOARDING_STATE.expertise.languages,
      },
      preferences: {
        ...INITIAL_MENTOR_ONBOARDING_STATE.preferences,
        ...(parsed.state.preferences || {}),
        selectedTracks: Array.isArray(parsed.state.preferences?.selectedTracks)
          ? parsed.state.preferences.selectedTracks
          : INITIAL_MENTOR_ONBOARDING_STATE.preferences.selectedTracks,
        preferredMenteeLevels: Array.isArray(parsed.state.preferences?.preferredMenteeLevels)
          ? parsed.state.preferences.preferredMenteeLevels
          : INITIAL_MENTOR_ONBOARDING_STATE.preferences.preferredMenteeLevels,
      },
    };

    return {
      version: parsed.version || MENTOR_STORAGE_VERSION,
      savedAt: parsed.savedAt || new Date().toISOString(),
      currentView: parsed.currentView || 'account',
      state: safeState,
    };
  } catch (err) {
    console.warn('Failed to load mentor onboarding draft:', err);
    return null;
  }
}

/**
 * Clears mentor onboarding draft from localStorage.
 */
export function clearMentorOnboardingDraft(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(scopedKey(MENTOR_STORAGE_DRAFT_KEY));
  } catch (err) {
    console.warn('Failed to clear mentor onboarding draft:', err);
  }
}
