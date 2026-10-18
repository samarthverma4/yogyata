import { scopedKey } from '../lib/storageScope';
import type { FounderOnboardingState, FounderOnboardingView } from './types';
import { INITIAL_FOUNDER_ONBOARDING_STATE } from './types';

export const FOUNDER_STORAGE_KEY = 'yogyata_founder_onboarding_draft';
export const FOUNDER_STORAGE_VERSION = 1;

// Maximum string size for an image payload before omitting from localStorage (~600 KB)
export const MAX_IMAGE_STORAGE_LENGTH = 600 * 1024;

export interface StoredFounderDraft {
  version: number;
  savedAt: number;
  currentView: FounderOnboardingView;
  state: FounderOnboardingState;
  imageOmitted?: boolean;
}

export interface SaveDraftResult {
  success: boolean;
  imageOmitted?: boolean;
  error?: string;
}

/**
 * Strips sensitive credentials (passwords, OTPs) from account state before storage.
 */
function sanitizeStateForStorage(state: FounderOnboardingState): {
  sanitized: FounderOnboardingState;
  imageOmitted: boolean;
} {
  let imageOmitted = false;

  // Never store password or confirmPassword
  const sanitizedAccount = {
    ...state.account,
    password: '',
    confirmPassword: '',
  };

  // Inspect profile photo size
  let sanitizedProfile = { ...state.profile };
  if (sanitizedProfile.profilePhotoUrl && sanitizedProfile.profilePhotoUrl.length > MAX_IMAGE_STORAGE_LENGTH) {
    sanitizedProfile = {
      ...sanitizedProfile,
      profilePhotoUrl: '', // Omit base64, keep file name
    };
    imageOmitted = true;
  }

  // Inspect startup logo size
  let sanitizedStartup = { ...state.startup };
  if (sanitizedStartup.logoUrl && sanitizedStartup.logoUrl.length > MAX_IMAGE_STORAGE_LENGTH) {
    sanitizedStartup = {
      ...sanitizedStartup,
      logoUrl: '', // Omit base64, keep logo name
    };
    imageOmitted = true;
  }

  return {
    sanitized: {
      ...state,
      account: sanitizedAccount,
      profile: sanitizedProfile,
      startup: sanitizedStartup,
    },
    imageOmitted,
  };
}

/**
 * Saves recoverable onboarding progress to browser localStorage.
 */
export function saveFounderDraft(
  state: FounderOnboardingState,
  currentView: FounderOnboardingView
): SaveDraftResult {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { success: false, error: 'localStorage is unavailable in this environment.' };
  }

  try {
    const { sanitized, imageOmitted } = sanitizeStateForStorage(state);

    const draft: StoredFounderDraft = {
      version: FOUNDER_STORAGE_VERSION,
      savedAt: Date.now(),
      currentView,
      state: sanitized,
      imageOmitted,
    };

    const serialized = JSON.stringify(draft);
    window.localStorage.setItem(scopedKey(FOUNDER_STORAGE_KEY), serialized);

    return { success: true, imageOmitted };
  } catch {
    // If QuotaExceededError, attempt saving with images completely stripped
    try {
      const fallbackState: FounderOnboardingState = {
        ...state,
        account: {
          ...state.account,
          password: '',
          confirmPassword: '',
        },
        profile: {
          ...state.profile,
          profilePhotoUrl: '',
        },
        startup: {
          ...state.startup,
          logoUrl: '',
        },
      };

      const fallbackDraft: StoredFounderDraft = {
        version: FOUNDER_STORAGE_VERSION,
        savedAt: Date.now(),
        currentView,
        state: fallbackState,
        imageOmitted: true,
      };

      window.localStorage.setItem(scopedKey(FOUNDER_STORAGE_KEY), JSON.stringify(fallbackDraft));
      return { success: true, imageOmitted: true };
    } catch (innerErr: unknown) {
      const message = innerErr instanceof Error ? innerErr.message : 'Storage quota exceeded.';
      return { success: false, error: message };
    }
  }
}

/**
 * Safely loads and merges saved progress from localStorage.
 */
export function loadFounderDraft(): {
  state: FounderOnboardingState;
  currentView: FounderOnboardingView;
  savedAt: number;
  imageOmitted?: boolean;
} | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(scopedKey(FOUNDER_STORAGE_KEY));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredFounderDraft>;
    if (!parsed || typeof parsed !== 'object' || parsed.version !== FOUNDER_STORAGE_VERSION) {
      return null;
    }

    if (!parsed.state || typeof parsed.state !== 'object') {
      return null;
    }

    // Merge with INITIAL_FOUNDER_ONBOARDING_STATE to guarantee complete type safety
    const mergedState: FounderOnboardingState = {
      account: {
        ...INITIAL_FOUNDER_ONBOARDING_STATE.account,
        ...(parsed.state.account || {}),
        password: '',
        confirmPassword: '',
      },
      profile: {
        ...INITIAL_FOUNDER_ONBOARDING_STATE.profile,
        ...(parsed.state.profile || {}),
      },
      startup: {
        ...INITIAL_FOUNDER_ONBOARDING_STATE.startup,
        ...(parsed.state.startup || {}),
      },
      goals: {
        ...INITIAL_FOUNDER_ONBOARDING_STATE.goals,
        ...(parsed.state.goals || {}),
      },
      talentRequirements: Array.isArray(parsed.state.talentRequirements)
        ? parsed.state.talentRequirements
        : [],
      taskDraft: {
        ...INITIAL_FOUNDER_ONBOARDING_STATE.taskDraft,
        ...(parsed.state.taskDraft || {}),
        requiredSkills: Array.isArray(parsed.state.taskDraft?.requiredSkills)
          ? parsed.state.taskDraft.requiredSkills
          : [],
      },
      privacy: {
        ...INITIAL_FOUNDER_ONBOARDING_STATE.privacy,
        ...(parsed.state.privacy || {}),
      },
    };

    // If draft was at 'complete', start user at 'signup' instead of trapped in complete view
    let restoredView: FounderOnboardingView = parsed.currentView || 'signup';
    if (restoredView === 'complete') {
      restoredView = 'signup';
    }

    return {
      state: mergedState,
      currentView: restoredView,
      savedAt: parsed.savedAt || Date.now(),
      imageOmitted: parsed.imageOmitted,
    };
  } catch {
    // Malformed JSON or blocked storage
    return null;
  }
}

/**
 * Removes saved draft from localStorage.
 */
export function clearFounderDraft(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(scopedKey(FOUNDER_STORAGE_KEY));
  } catch {
    // Ignore storage errors during cleanup
  }
}

/**
 * Helper to display human-readable time elapsed.
 */
export function formatTimeAgo(timestamp: number): string {
  const elapsedSec = Math.floor((Date.now() - timestamp) / 1000);
  if (elapsedSec < 30) return 'just now';
  if (elapsedSec < 60) return `${elapsedSec}s ago`;
  const elapsedMin = Math.floor(elapsedSec / 60);
  if (elapsedMin < 60) return `${elapsedMin}m ago`;
  const elapsedHours = Math.floor(elapsedMin / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;
  return new Date(timestamp).toLocaleDateString();
}
