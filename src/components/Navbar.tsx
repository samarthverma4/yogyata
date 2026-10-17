import React from 'react';
import { LogIn } from 'lucide-react';

interface NavbarProps {
  onSignInClick: () => void;
  onHowItWorksClick: () => void;
  onEcosystemClick: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onSignInClick,
  onHowItWorksClick,
  onEcosystemClick,
}) => {
  return (
    <header className="navbar-header" role="banner">
      <div className="page-container">
        <div className="navbar-container">
          {/* Brand Wordmark & Skill Emblem */}
          <button 
            type="button" 
            className="brand-link" 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="YOGYATA Home"
          >
            <div className="brand-emblem-wrapper" aria-hidden="true">
              <svg 
                className="brand-emblem-svg" 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Outer Verified Shield */}
                <path
                  d="M12 2.5L19 6V11.5C19 16 16 19.3 12 21.5C8 19.3 5 16 5 11.5V6L12 2.5Z"
                  fill="#465FA8"
                />
                {/* Verified Spark / Evidence Checkmark */}
                <path
                  d="M10.8 14.5L8.5 12.2L9.6 11.1L10.8 12.3L14.4 8.7L15.5 9.8L10.8 14.5Z"
                  fill="#FFC936"
                />
              </svg>
            </div>
            <div className="brand-text-group">
              <span className="brand-title">YOGYATA</span>
              <span className="brand-tagline-sub">Skills You Can Prove</span>
            </div>
          </button>

          {/* Centre Navigation */}
          <nav className="navbar-center-nav" aria-label="Main Navigation">
            <button
              type="button"
              className="nav-anchor-btn"
              onClick={onHowItWorksClick}
            >
              How it works
            </button>
            <button
              type="button"
              className="nav-anchor-btn"
              onClick={onEcosystemClick}
            >
              Our ecosystem
            </button>
          </nav>

          {/* Right Navigation: Already Registered + Sign In */}
          <div className="navbar-right-actions">
            <span className="navbar-user-prompt">Already registered?</span>
            <button
              type="button"
              className="nav-signin-btn"
              onClick={onSignInClick}
              id="navbar-sign-in-button"
            >
              <LogIn size={15} aria-hidden="true" />
              <span>Sign in</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
