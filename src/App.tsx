import React, { useCallback, useState } from 'react';
import './index.css';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { Notification } from './components/Notification';
import { Modal } from './components/Modal';
import { AdminSignInModal } from './components/AdminSignInModal';
import { JobSeekerOnboarding } from './onboarding/JobSeekerOnboarding';
import { FounderOnboarding } from './founder-onboarding/FounderOnboarding';
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
    title: 'Founder / Entrepreneur entry selected',
    message:
      'Founder / Entrepreneur entry selected. Authentication will be connected in the next development phase.',
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

  // ── Continue handler ──
  const handleContinue = useCallback(
    (role: RoleOption) => {
      if (role.id === 'job-seeker') {
        setInJobSeekerOnboarding(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (role.id === 'founder') {
        setInFounderOnboarding(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        const { title, message } = ROLE_CONTINUE_MESSAGES[role.id];
        showNotification(title, message);
      }
    },
    [showNotification]
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

  if (inJobSeekerOnboarding) {
    return (
      <div className="yogyata-app">
        <div className="yogyata-bg-pattern" aria-hidden="true" />
        <JobSeekerOnboarding onExit={() => setInJobSeekerOnboarding(false)} />
        <Notification notification={notification} onClose={dismissNotification} />
      </div>
    );
  }

  if (inFounderOnboarding) {
    return (
      <div className="yogyata-app">
        <div className="yogyata-bg-pattern" aria-hidden="true" />
        <FounderOnboarding
          onExit={() => setInFounderOnboarding(false)}
          onSignInClick={handleSignIn}
        />
        <Notification notification={notification} onClose={dismissNotification} />
      </div>
    );
  }

  return (
    <div className="yogyata-app">
      {/* Subtle Background Pattern (non-distracting grid) */}
      <div className="yogyata-bg-pattern" aria-hidden="true" />

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
