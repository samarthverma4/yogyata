import React, { useCallback, useState, useEffect } from 'react';
import './index.css';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { Notification } from './components/Notification';
import { Modal } from './components/Modal';
import { AdminSignInModal } from './components/AdminSignInModal';
import { JobSeekerOnboarding } from './onboarding/JobSeekerOnboarding';
import { FounderOnboarding } from './founder-onboarding/FounderOnboarding';
import { FounderWorkspace } from './founder-workspace/FounderWorkspace';
import { loadFounderWorkspace } from './founder-workspace/storage';
import type { FounderWorkspaceState } from './founder-workspace/types';
import { MentorOnboarding } from './mentor-onboarding/MentorOnboarding';
import { MentorWorkspace } from './mentor-workspace/MentorWorkspace';
import {
  loadMentorWorkspace,
  saveMentorWorkspace,
  initializeMentorWorkspaceFromOnboarding,
} from './mentor-workspace/storage';
import type { MentorWorkspaceState } from './mentor-workspace/types';
import type { MentorOnboardingState } from './mentor-onboarding/types';
import { INITIAL_MENTOR_ONBOARDING_STATE } from './mentor-onboarding/types';
import { RecruiterOnboarding } from './recruiter-onboarding/RecruiterOnboarding';
import { RecruiterWorkspace } from './recruiter-workspace/RecruiterWorkspace';
import {
  loadRecruiterWorkspace,
  saveRecruiterWorkspace,
  initializeRecruiterWorkspaceFromOnboarding,
} from './recruiter-workspace/storage';
import type { RecruiterWorkspaceState } from './recruiter-workspace/types';
import type { RecruiterOnboardingState } from './recruiter-onboarding/types';
import { INITIAL_RECRUITER_ONBOARDING_STATE } from './recruiter-onboarding/types';
import type { NotificationState, RoleId, RoleOption } from './types';

// ─── Modal Content ────────────────────────────────────────────────────────────

const HOW_IT_WORKS_CONTENT = (
  <>
    <p>
      YOGYATA's <strong>Skill Passport</strong> connects what you declare, what
      you prove, and what you achieve — creating a living, evidenced record of
      your professional capabilities.
    </p>
    <ul>
      <li>
        <strong>Declare</strong> — Add skills to your profile with context and
        examples.
      </li>
      <li>
        <strong>Assess</strong> — Validate your skills through structured
        assessments and peer review.
      </li>
      <li>
        <strong>Prove</strong> — Take on real projects and challenges that build
        visible evidence.
      </li>
      <li>
        <strong>Connect</strong> — Discover opportunities, mentors, and
        collaborators matched to your profile.
      </li>
    </ul>
  </>
);

const ECOSYSTEM_CONTENT = (
  <>
    <p>
      YOGYATA brings together a connected network of professionals, builders,
      and organisations — all in one talent ecosystem.
    </p>
    <ul>
      <li>
        <strong>Job Seekers</strong> — Build and evidence their skill profile.
      </li>
      <li>
        <strong>Founders & Startups</strong> — Find capable contributors for
        real challenges.
      </li>
      <li>
        <strong>Mentors</strong> — Guide and vouch for talent growth.
      </li>
      <li>
        <strong>Recruiters</strong> — Access verified, evidenced profiles.
      </li>
    </ul>
  </>
);

// ─── Role-specific Continuation Messages ─────────────────────────────────────
const ROLE_CONTINUE_MESSAGES: Record<RoleId, { title: string; message: string }> = {
  'job-seeker': {
    title: 'Job Seeker entry selected',
    message:
      'Job Seeker entry selected. Authentication will be connected in the next development phase.',
  },
  founder: {
    title: 'Entrepreneur entry selected',
    message:
      'Entrepreneur entry selected. Authentication will be connected in the next development phase.',
  },
  mentor: {
    title: 'Mentor Workspace Selected',
    message:
      'Mentor guidance workspace and onboarding active.',
  },
  recruiter: {
    title: 'Recruiter Workspace Selected',
    message:
      'Recruiter talent acquisition workspace and onboarding active.',
  },
};

// ─── App Root ─────────────────────────────────────────────────────────────────
let notifIdCounter = 0;

function App() {
  const [selectedRole, setSelectedRole] = useState<RoleId | null>(null);
  const [notification, setNotification] = useState<NotificationState | null>(null);
  const [modal, setModal] = useState<{
    title: string;
    content: React.ReactNode;
  } | null>(null);
  const [showAdminSignIn, setShowAdminSignIn] = useState(false);
  const [inJobSeekerOnboarding, setInJobSeekerOnboarding] = useState(false);
  const [inFounderOnboarding, setInFounderOnboarding] = useState(false);
  const [inFounderWorkspace, setInFounderWorkspace] = useState(() => {
    if (typeof window !== 'undefined') {
      if (
        window.location.hash === '#founder-workspace' ||
        window.location.hash === '#workspace' ||
        sessionStorage.getItem('yogyata_active_view') === 'founder-workspace'
      ) {
        return true;
      }
    }
    return false;
  });

  const [inMentorOnboarding, setInMentorOnboarding] = useState(() => {
    if (typeof window !== 'undefined') {
      if (
        (window.location.hash === '#mentor-workspace' && !loadMentorWorkspace()) ||
        sessionStorage.getItem('yogyata_active_view') === 'mentor-onboarding'
      ) {
        return true;
      }
    }
    return false;
  });
  const [inMentorWorkspace, setInMentorWorkspace] = useState(() => {
    if (typeof window !== 'undefined') {
      if (
        window.location.hash === '#mentor-workspace' ||
        sessionStorage.getItem('yogyata_active_view') === 'mentor-workspace'
      ) {
        return true;
      }
    }
    return false;
  });

  const [inRecruiterOnboarding, setInRecruiterOnboarding] = useState(() => {
    if (typeof window !== 'undefined') {
      if (
        (window.location.hash === '#recruiter-workspace' && !loadRecruiterWorkspace()) ||
        sessionStorage.getItem('yogyata_active_view') === 'recruiter-onboarding'
      ) {
        return true;
      }
    }
    return false;
  });
  const [inRecruiterWorkspace, setInRecruiterWorkspace] = useState(() => {
    if (typeof window !== 'undefined') {
      if (
        window.location.hash === '#recruiter-workspace' ||
        sessionStorage.getItem('yogyata_active_view') === 'recruiter-workspace'
      ) {
        return true;
      }
    }
    return false;
  });

  const [existingWorkspace, setExistingWorkspace] = useState<FounderWorkspaceState | null>(() =>
    loadFounderWorkspace()
  );

  const [existingMentorWorkspace, setExistingMentorWorkspace] = useState<MentorWorkspaceState | null>(() =>
    loadMentorWorkspace()
  );

  const [existingRecruiterWorkspace, setExistingRecruiterWorkspace] = useState<RecruiterWorkspaceState | null>(() =>
    loadRecruiterWorkspace()
  );

  // Sync existing workspace on state transitions
  const handleEnterFounderWorkspace = useCallback((state?: FounderWorkspaceState) => {
    setInFounderOnboarding(false);
    setInJobSeekerOnboarding(false);
    setInMentorOnboarding(false);
    setInMentorWorkspace(false);
    setInRecruiterOnboarding(false);
    setInRecruiterWorkspace(false);
    setInFounderWorkspace(true);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('yogyata_active_view', 'founder-workspace');
      window.location.hash = '#founder-workspace';
    }
    if (state) {
      setExistingWorkspace(state);
    } else {
      setExistingWorkspace(loadFounderWorkspace());
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleExitFounderWorkspace = useCallback(() => {
    setInFounderWorkspace(false);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('yogyata_active_view');
      if (window.location.hash === '#founder-workspace' || window.location.hash === '#workspace') {
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
    setExistingWorkspace(loadFounderWorkspace());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleEnterMentorWorkspace = useCallback(
    (stateOrOnboarding?: MentorWorkspaceState | MentorOnboardingState) => {
      setInMentorOnboarding(false);
      setInJobSeekerOnboarding(false);
      setInFounderOnboarding(false);
      setInFounderWorkspace(false);
      setInRecruiterOnboarding(false);
      setInRecruiterWorkspace(false);
      setInMentorWorkspace(true);

      let ws: MentorWorkspaceState | null = null;
      if (stateOrOnboarding) {
        if ('mentor' in stateOrOnboarding) {
          ws = stateOrOnboarding as MentorWorkspaceState;
        } else {
          ws = initializeMentorWorkspaceFromOnboarding(stateOrOnboarding as MentorOnboardingState);
          saveMentorWorkspace(ws);
        }
      } else {
        ws = loadMentorWorkspace();
        if (!ws) {
          ws = initializeMentorWorkspaceFromOnboarding(INITIAL_MENTOR_ONBOARDING_STATE);
          saveMentorWorkspace(ws);
        }
      }

      setExistingMentorWorkspace(ws);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('yogyata_active_view', 'mentor-workspace');
        window.location.hash = '#mentor-workspace';
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    []
  );

  const handleExitMentorWorkspace = useCallback(() => {
    setInMentorWorkspace(false);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('yogyata_active_view');
      if (window.location.hash === '#mentor-workspace') {
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
    setExistingMentorWorkspace(loadMentorWorkspace());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleEnterRecruiterWorkspace = useCallback(
    (stateOrOnboarding?: RecruiterWorkspaceState | RecruiterOnboardingState) => {
      setInRecruiterOnboarding(false);
      setInJobSeekerOnboarding(false);
      setInFounderOnboarding(false);
      setInFounderWorkspace(false);
      setInMentorOnboarding(false);
      setInMentorWorkspace(false);
      setInRecruiterWorkspace(true);

      let ws: RecruiterWorkspaceState | null = null;
      if (stateOrOnboarding) {
        if ('pipeline' in stateOrOnboarding) {
          ws = stateOrOnboarding as RecruiterWorkspaceState;
        } else {
          ws = initializeRecruiterWorkspaceFromOnboarding(stateOrOnboarding as RecruiterOnboardingState);
          saveRecruiterWorkspace(ws);
        }
      } else {
        ws = loadRecruiterWorkspace();
        if (!ws) {
          ws = initializeRecruiterWorkspaceFromOnboarding(INITIAL_RECRUITER_ONBOARDING_STATE);
          saveRecruiterWorkspace(ws);
        }
      }

      setExistingRecruiterWorkspace(ws);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('yogyata_active_view', 'recruiter-workspace');
        window.location.hash = '#recruiter-workspace';
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    []
  );

  const handleExitRecruiterWorkspace = useCallback(() => {
    setInRecruiterWorkspace(false);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('yogyata_active_view');
      if (window.location.hash === '#recruiter-workspace') {
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
    setExistingRecruiterWorkspace(loadRecruiterWorkspace());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Hash navigation listener
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#recruiter-workspace') {
        const saved = loadRecruiterWorkspace();
        if (saved) {
          setExistingRecruiterWorkspace(saved);
          setInRecruiterWorkspace(true);
          setInRecruiterOnboarding(false);
          setInMentorWorkspace(false);
          setInMentorOnboarding(false);
          setInFounderWorkspace(false);
          setInFounderOnboarding(false);
          setInJobSeekerOnboarding(false);
        } else {
          setInRecruiterOnboarding(true);
          setInRecruiterWorkspace(false);
        }
      } else if (hash === '#mentor-workspace') {
        const saved = loadMentorWorkspace();
        if (saved) {
          setExistingMentorWorkspace(saved);
          setInMentorWorkspace(true);
          setInMentorOnboarding(false);
          setInFounderWorkspace(false);
          setInFounderOnboarding(false);
          setInJobSeekerOnboarding(false);
        } else {
          setInMentorOnboarding(true);
          setInMentorWorkspace(false);
        }
      } else if (hash === '#founder-workspace' || hash === '#workspace') {
        const saved = loadFounderWorkspace();
        if (saved) {
          setExistingWorkspace(saved);
          setInFounderWorkspace(true);
          setInFounderOnboarding(false);
          setInMentorWorkspace(false);
          setInMentorOnboarding(false);
          setInJobSeekerOnboarding(false);
        } else {
          setInFounderOnboarding(true);
          setInFounderWorkspace(false);
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // ── Notification helpers ──
  const showNotification = useCallback(
    (title: string, message: string) => {
      notifIdCounter += 1;
      setNotification({
        id: String(notifIdCounter),
        type: 'info',
        title,
        message,
      });
    },
    []
  );

  const dismissNotification = useCallback(() => setNotification(null), []);

  // ── Role selection ──
  const handleRoleSelect = useCallback((id: RoleId) => {
    setSelectedRole(id);
  }, []);

  // ── Role Entry Handlers ──
  const handleEnterMentorEntry = useCallback(() => {
    const savedWs = loadMentorWorkspace() || existingMentorWorkspace;
    if (savedWs) {
      handleEnterMentorWorkspace(savedWs);
    } else {
      setInMentorOnboarding(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [handleEnterMentorWorkspace, existingMentorWorkspace]);

  const handleEnterRecruiterEntry = useCallback(() => {
    const savedWs = loadRecruiterWorkspace() || existingRecruiterWorkspace;
    if (savedWs) {
      handleEnterRecruiterWorkspace(savedWs);
    } else {
      setInRecruiterOnboarding(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [handleEnterRecruiterWorkspace, existingRecruiterWorkspace]);

  // ── Continue handler ──
  const handleContinue = useCallback(
    (role: RoleOption) => {
      if (role.id === 'job-seeker') {
        setInJobSeekerOnboarding(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (role.id === 'founder') {
        const savedWs = loadFounderWorkspace();
        if (savedWs) {
          handleEnterFounderWorkspace(savedWs);
        } else {
          setInFounderOnboarding(true);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      } else if (role.id === 'mentor') {
        handleEnterMentorEntry();
      } else if (role.id === 'recruiter') {
        handleEnterRecruiterEntry();
      } else {
        const { title, message } = ROLE_CONTINUE_MESSAGES[role.id];
        showNotification(title, message);
      }
    },
    [showNotification, handleEnterFounderWorkspace, handleEnterMentorEntry, handleEnterRecruiterEntry]
  );

  // ── Sign In handler ──
  const handleSignIn = useCallback(() => {
    showNotification(
      'Sign in coming soon',
      'Authentication will be integrated in the next development phase. Select a role above to continue.'
    );
  }, [showNotification]);

  // ── Nav Modal handlers ──
  const handleHowItWorks = useCallback(() => {
    setModal({ title: 'How YOGYATA Works', content: HOW_IT_WORKS_CONTENT });
  }, []);

  const handleEcosystem = useCallback(() => {
    setModal({ title: 'Our Ecosystem', content: ECOSYSTEM_CONTENT });
  }, []);

  const handleExplore = useCallback(() => {
    setModal({ title: 'How YOGYATA Works', content: HOW_IT_WORKS_CONTENT });
  }, []);

  const closeModal = useCallback(() => setModal(null), []);

  // ── Admin Sign-In handlers ──
  const handleAdminAccessClick = useCallback(() => {
    setShowAdminSignIn(true);
  }, []);

  const handleAdminSignInSubmit = useCallback(() => {
    setShowAdminSignIn(false);
    showNotification(
      'Secure admin authentication',
      'Admin sign-in will be connected to a secure, authorised authentication process in the next development phase. No access has been granted.'
    );
  }, [showNotification]);

  const handleAdminSignInClose = useCallback(() => {
    setShowAdminSignIn(false);
  }, []);

  // Founder Workspace View
  if (inFounderWorkspace) {
    return (
      <FounderWorkspace
        onExitToHome={handleExitFounderWorkspace}
      />
    );
  }

  // Mentor Workspace View
  if (inMentorWorkspace && existingMentorWorkspace) {
    return (
      <MentorWorkspace
        initialWorkspace={existingMentorWorkspace}
        onExitToHome={handleExitMentorWorkspace}
      />
    );
  }

  // Recruiter Workspace View
  if (inRecruiterWorkspace && existingRecruiterWorkspace) {
    return (
      <RecruiterWorkspace
        initialWorkspace={existingRecruiterWorkspace}
        onExitToHome={handleExitRecruiterWorkspace}
      />
    );
  }

  // Job Seeker Onboarding View
  if (inJobSeekerOnboarding) {
    return (
      <div className="yogyata-app">
        <div className="yogyata-bg-pattern" aria-hidden="true" />
        <JobSeekerOnboarding onExit={() => setInJobSeekerOnboarding(false)} />
        <Notification notification={notification} onClose={dismissNotification} />
      </div>
    );
  }

  // Founder Onboarding View
  if (inFounderOnboarding) {
    return (
      <div className="yogyata-app">
        <div className="yogyata-bg-pattern" aria-hidden="true" />
        <FounderOnboarding
          onExit={() => setInFounderOnboarding(false)}
          onSignInClick={handleSignIn}
          onEnterWorkspace={handleEnterFounderWorkspace}
        />
        <Notification notification={notification} onClose={dismissNotification} />
      </div>
    );
  }

  // Mentor Onboarding View
  if (inMentorOnboarding) {
    return (
      <div className="yogyata-app">
        <div className="yogyata-bg-pattern" aria-hidden="true" />
        <MentorOnboarding
          onExit={() => setInMentorOnboarding(false)}
          onSignInClick={handleSignIn}
          onEnterWorkspace={handleEnterMentorWorkspace}
        />
        <Notification notification={notification} onClose={dismissNotification} />
      </div>
    );
  }

  // Recruiter Onboarding View
  if (inRecruiterOnboarding) {
    return (
      <div className="yogyata-app">
        <div className="yogyata-bg-pattern" aria-hidden="true" />
        <RecruiterOnboarding
          onExit={() => setInRecruiterOnboarding(false)}
          onSignInClick={handleSignIn}
          onEnterWorkspace={handleEnterRecruiterWorkspace}
        />
        <Notification notification={notification} onClose={dismissNotification} />
      </div>
    );
  }

  return (
    <div className="yogyata-app">
      {/* Subtle Background Pattern (non-distracting grid) */}
      <div className="yogyata-bg-pattern" aria-hidden="true" />

      {/* Optional Active Recruiter Workspace Banner */}
      {existingRecruiterWorkspace && (
        <div
          style={{
            background: '#F0FDF4',
            borderBottom: '1px solid #BBF7D0',
            color: '#15803D',
            padding: '0.5rem 1rem',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '0.875rem',
            fontSize: '0.8125rem',
            flexWrap: 'wrap',
          }}
        >
          <span>
            Active Recruiter Workspace saved for{' '}
            <strong>{existingRecruiterWorkspace.company.companyName || 'Your Company'}</strong> ({existingRecruiterWorkspace.recruiter.recruiterName})
          </span>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              className="yw-btn yw-btn-primary yw-btn-sm"
              style={{
                padding: '0.2rem 0.625rem',
                fontSize: '0.75rem',
                background: '#15803D',
                border: 'none',
                color: '#FFFFFF',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
              onClick={() => handleEnterRecruiterWorkspace(existingRecruiterWorkspace)}
              id="btn-quick-open-recruiter-workspace"
            >
              Open Recruiter Workspace →
            </button>
            <button
              type="button"
              className="yw-btn yw-btn-secondary yw-btn-sm"
              style={{
                padding: '0.2rem 0.625rem',
                fontSize: '0.75rem',
                color: '#15803D',
                background: '#FFFFFF',
                border: '1px solid #BBF7D0',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
              onClick={() => {
                setInRecruiterOnboarding(true);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              id="btn-quick-start-recruiter-onboarding"
            >
              Start New Onboarding +
            </button>
          </div>
        </div>
      )}

      {/* Optional Active Mentor Workspace Banner */}
      {existingMentorWorkspace && (
        <div
          style={{
            background: '#FAF5FF',
            borderBottom: '1px solid #E9D5FF',
            color: '#581C87',
            padding: '0.5rem 1rem',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '0.875rem',
            fontSize: '0.8125rem',
            flexWrap: 'wrap',
          }}
        >
          <span>
            Active Mentor Workspace saved for{' '}
            <strong>{existingMentorWorkspace.mentor.fullName || 'Mentor Guide'}</strong>
          </span>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              className="yw-btn yw-btn-primary yw-btn-sm"
              style={{
                padding: '0.2rem 0.625rem',
                fontSize: '0.75rem',
                background: '#9333EA',
                border: 'none',
                color: '#FFFFFF',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
              onClick={() => handleEnterMentorWorkspace(existingMentorWorkspace)}
              id="btn-quick-open-mentor-workspace"
            >
              Open Mentor Workspace →
            </button>
            <button
              type="button"
              className="yw-btn yw-btn-secondary yw-btn-sm"
              style={{
                padding: '0.2rem 0.625rem',
                fontSize: '0.75rem',
                color: '#581C87',
                background: '#FFFFFF',
                border: '1px solid #E9D5FF',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
              onClick={() => {
                setInMentorOnboarding(true);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              id="btn-quick-start-mentor-onboarding"
            >
              Start New Onboarding +
            </button>
          </div>
        </div>
      )}

      {/* Optional Active Entrepreneur Workspace Banner */}
      {existingWorkspace && (
        <div
          style={{
            background: '#1B2A4E',
            color: '#FFFFFF',
            padding: '0.5rem 1rem',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '0.875rem',
            fontSize: '0.8125rem',
            flexWrap: 'wrap',
          }}
        >
          <span>
            Active Entrepreneur Workspace saved for{' '}
            <strong>{existingWorkspace.startup.startupName || 'Your Startup'}</strong>
          </span>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              className="yw-btn yw-btn-primary yw-btn-sm"
              style={{
                padding: '0.2rem 0.625rem',
                fontSize: '0.75rem',
                background: '#D97706',
                border: 'none',
                color: '#FFFFFF',
              }}
              onClick={() => handleEnterFounderWorkspace(existingWorkspace)}
              id="btn-quick-open-workspace"
            >
              Open Entrepreneur Workspace →
            </button>
            <button
              type="button"
              className="yw-btn yw-btn-secondary yw-btn-sm"
              style={{
                padding: '0.2rem 0.625rem',
                fontSize: '0.75rem',
                color: '#FFFFFF',
                background: 'rgba(255, 255, 255, 0.12)',
                borderColor: 'rgba(255, 255, 255, 0.25)',
              }}
              onClick={() => {
                setInFounderOnboarding(true);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              id="btn-quick-start-onboarding"
            >
              Start New Onboarding +
            </button>
          </div>
        </div>
      )}

      {/* A. Top Navigation */}
      <Navbar
        onSignInClick={handleSignIn}
        onHowItWorksClick={handleHowItWorks}
        onEcosystemClick={handleEcosystem}
      />

      {/* B. Main Hero Section (Two-column) */}
      <HeroSection
        selectedRole={selectedRole}
        onRoleSelect={handleRoleSelect}
        onContinue={handleContinue}
        onExploreClick={handleExplore}
      />

      {/* C. Bottom Trust Strip */}
      <footer className="bottom-trust-strip" role="contentinfo">
        <div className="page-container">
          <div className="trust-strip-inner">
            <div className="trust-strip-left">
              <span className="trust-badge-pill">YOGYATA</span>
              <span className="trust-tagline-motto">
                ASSESS. <span>PROVE.</span> GROW.
              </span>
            </div>
            <div className="trust-strip-right-group">
              <p className="trust-strip-supporting">
                One Skill Passport. A connected career journey.
              </p>
              <button
                type="button"
                className="admin-access-link"
                onClick={handleAdminAccessClick}
                id="admin-access-link"
                aria-label="Admin sign in — restricted access"
              >
                Admin access
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Notification Toast */}
      <Notification notification={notification} onClose={dismissNotification} />

      {/* Info Modal */}
      {modal && (
        <Modal title={modal.title} onClose={closeModal}>
          {modal.content}
        </Modal>
      )}

      {/* Admin Sign-In Modal */}
      {showAdminSignIn && (
        <AdminSignInModal
          onClose={handleAdminSignInClose}
          onSubmit={handleAdminSignInSubmit}
        />
      )}
    </div>
  );
}

export default App;
