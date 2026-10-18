import { scopedKey } from '../lib/storageScope';
import type { RecruiterOnboardingState } from './types';
import { INITIAL_RECRUITER_ONBOARDING_STATE } from './types';

export const RECRUITER_DRAFT_KEY = 'yogyata_recruiter_onboarding_draft';

/**
 * Sanitizes URLs to prevent javascript: or data: XSS vectors.
 */
export function sanitizeRecruiterUrl(rawUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (
    trimmed.toLowerCase().startsWith('javascript:') ||
    trimmed.toLowerCase().startsWith('data:') ||
    trimmed.toLowerCase().startsWith('vbscript:')
  ) {
    return '';
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * Strips sensitive password fields before writing to localStorage.
 */
export function sanitizeRecruiterDraftForStorage(
  state: RecruiterOnboardingState
): RecruiterOnboardingState {
  return {
    ...state,
    account: {
      fullName: state.account.fullName || '',
      workEmail: state.account.workEmail || '',
      isSimulatedVerified: Boolean(state.account.isSimulatedVerified),
      verificationCode: state.account.verificationCode || '',
      password: '',
      confirmPassword: '',
    },
    profile: {
      ...state.profile,
      linkedInUrl: sanitizeRecruiterUrl(state.profile.linkedInUrl),
    },
    company: {
      ...state.company,
      website: sanitizeRecruiterUrl(state.company.website),
    },
  };
}

/**
 * Loads the saved onboarding draft from localStorage.
 * Recovers gracefully if storage is missing, empty, or corrupted.
 */
export function loadRecruiterDraft(): RecruiterOnboardingState {
  if (typeof window === 'undefined') {
    return INITIAL_RECRUITER_ONBOARDING_STATE;
  }

  try {
    const raw = localStorage.getItem(scopedKey(RECRUITER_DRAFT_KEY));
    if (!raw) {
      return INITIAL_RECRUITER_ONBOARDING_STATE;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return INITIAL_RECRUITER_ONBOARDING_STATE;
    }

    // Merge and validate basic fields
    return {
      currentStep: (parsed.currentStep >= 1 && parsed.currentStep <= 7 ? parsed.currentStep : 1),
      account: {
        fullName: typeof parsed.account?.fullName === 'string' ? parsed.account.fullName : '',
        workEmail: typeof parsed.account?.workEmail === 'string' ? parsed.account.workEmail : '',
        isSimulatedVerified: Boolean(parsed.account?.isSimulatedVerified),
        verificationCode: typeof parsed.account?.verificationCode === 'string' ? parsed.account.verificationCode : '',
        password: '',
        confirmPassword: '',
      },
      profile: {
        recruiterName: typeof parsed.profile?.recruiterName === 'string' ? parsed.profile.recruiterName : '',
        jobTitle: typeof parsed.profile?.jobTitle === 'string' ? parsed.profile.jobTitle : 'Technical Talent Acquisition Lead',
        recruitingExperience: typeof parsed.profile?.recruitingExperience === 'string' ? parsed.profile.recruitingExperience : '3-5 years',
        hiringSpecialization: typeof parsed.profile?.hiringSpecialization === 'string' ? parsed.profile.hiringSpecialization : 'Engineering & Product',
        professionalBio: typeof parsed.profile?.professionalBio === 'string' ? parsed.profile.professionalBio : '',
        linkedInUrl: typeof parsed.profile?.linkedInUrl === 'string' ? parsed.profile.linkedInUrl : '',
      },
      company: {
        companyName: typeof parsed.company?.companyName === 'string' ? parsed.company.companyName : '',
        industry: typeof parsed.company?.industry === 'string' ? parsed.company.industry : 'Technology / SaaS',
        companySize: typeof parsed.company?.companySize === 'string' ? parsed.company.companySize : '51-200 employees',
        website: typeof parsed.company?.website === 'string' ? parsed.company.website : '',
        description: typeof parsed.company?.description === 'string' ? parsed.company.description : '',
        location: typeof parsed.company?.location === 'string' ? parsed.company.location : 'Bengaluru, India (Hybrid)',
        hiringDomains: Array.isArray(parsed.company?.hiringDomains) ? parsed.company.hiringDomains : ['Frontend Engineering', 'Backend Engineering'],
        companyStage: typeof parsed.company?.companyStage === 'string' ? parsed.company.companyStage : 'Series A / Growth',
        workCultureSummary: typeof parsed.company?.workCultureSummary === 'string' ? parsed.company.workCultureSummary : '',
      },
      hiring: {
        rolesCommonlyHired: Array.isArray(parsed.hiring?.rolesCommonlyHired) ? parsed.hiring.rolesCommonlyHired : ['Senior Frontend Engineer'],
        technicalSkillsSought: Array.isArray(parsed.hiring?.technicalSkillsSought) ? parsed.hiring.technicalSkillsSought : ['React', 'TypeScript'],
        experienceRanges: Array.isArray(parsed.hiring?.experienceRanges) ? parsed.hiring.experienceRanges : ['Mid-Level (3-5 yrs)'],
        employmentTypes: Array.isArray(parsed.hiring?.employmentTypes) ? parsed.hiring.employmentTypes : ['Full-Time'],
        workArrangements: Array.isArray(parsed.hiring?.workArrangements) ? parsed.hiring.workArrangements : ['Hybrid (2-3 days in office)'],
        preferredLocations: Array.isArray(parsed.hiring?.preferredLocations) ? parsed.hiring.preferredLocations : ['Bengaluru'],
        hiringPriorities: Array.isArray(parsed.hiring?.hiringPriorities) ? parsed.hiring.hiringPriorities : ['Evidenced Practical Skills'],
      },
      agreedToGuidelines: Boolean(parsed.agreedToGuidelines),
      isComplete: Boolean(parsed.isComplete),
    };
  } catch (err) {
    console.warn('[RecruiterOnboarding] Failed to parse draft from localStorage, falling back to initial state:', err);
    return INITIAL_RECRUITER_ONBOARDING_STATE;
  }
}

/**
 * Saves sanitized draft to localStorage.
 */
export function saveRecruiterDraft(state: RecruiterOnboardingState): void {
  if (typeof window === 'undefined') return;
  try {
    const sanitized = sanitizeRecruiterDraftForStorage(state);
    localStorage.setItem(scopedKey(RECRUITER_DRAFT_KEY), JSON.stringify(sanitized));
  } catch (err) {
    console.error('[RecruiterOnboarding] Error saving draft to localStorage:', err);
  }
}

/**
 * Clears the recruiter onboarding draft from localStorage.
 */
export function clearRecruiterDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(scopedKey(RECRUITER_DRAFT_KEY));
  } catch (err) {
    console.error('[RecruiterOnboarding] Error clearing draft:', err);
  }
}
