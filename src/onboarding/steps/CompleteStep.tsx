import React from 'react';
import { StepWrapper } from '../shared';
import {
  CheckCircle2, ArrowRight, Award, FileCode2, Users, Compass, ShieldCheck,
} from 'lucide-react';

interface CompleteStepProps {
  name: string;
  onExit: () => void;
  onEnterWorkspace?: () => void;
}

export const CompleteStep: React.FC<CompleteStepProps> = ({
  name,
  onExit,
  onEnterWorkspace,
}) => {
  const firstName = name.trim().split(' ')[0] || 'there';

  return (
    <StepWrapper>
      <div className="ob-complete-screen">
        <div className="ob-complete-celebrate-badge" aria-hidden="true">
          <CheckCircle2 size={54} className="ob-complete-icon" />
        </div>

        <p className="ob-step-eyebrow">Onboarding Complete</p>
        <h1 className="ob-complete-title">
          Welcome to YOGYATA, {firstName}!
        </h1>
        <p className="ob-complete-subtitle">
          Your initial candidate profile has been generated. Your skills are currently marked as{' '}
          <span className="ob-skill-badge-declared">DECLARED</span> and ready for your evidence journey.
        </p>

        {/* What happens next roadmap */}
        <div className="ob-complete-roadmap" aria-label="Next steps in your career journey">
          <h2 className="ob-roadmap-heading">What happens next?</h2>

          <div className="ob-roadmap-grid">
            <div className="ob-roadmap-card">
              <div className="ob-roadmap-card-icon" aria-hidden="true">
                <Compass size={20} />
              </div>
              <div className="ob-roadmap-card-content">
                <h3 className="ob-roadmap-card-title">1. View Your Skill Passport</h3>
                <p className="ob-roadmap-card-text">
                  Inspect your declared skills profile, baseline benchmarks, and suggested target tracks.
                </p>
              </div>
            </div>

            <div className="ob-roadmap-card">
              <div className="ob-roadmap-card-icon ob-icon-assess" aria-hidden="true">
                <Award size={20} />
              </div>
              <div className="ob-roadmap-card-content">
                <h3 className="ob-roadmap-card-title">2. Take Skill Assessments</h3>
                <p className="ob-roadmap-card-text">
                  Complete structured diagnostic evaluations to upgrade skills from DECLARED to{' '}
                  <strong style={{ color: '#4F46E5' }}>ASSESSED</strong>.
                </p>
              </div>
            </div>

            <div className="ob-roadmap-card">
              <div className="ob-roadmap-card-icon ob-icon-verify" aria-hidden="true">
                <FileCode2 size={20} />
              </div>
              <div className="ob-roadmap-card-content">
                <h3 className="ob-roadmap-card-title">3. Prove with Practical Work</h3>
                <p className="ob-roadmap-card-text">
                  Tackle verified challenges, real project briefs, and peer reviews to earn{' '}
                  <strong style={{ color: '#059669' }}>VERIFIED</strong> status.
                </p>
              </div>
            </div>

            <div className="ob-roadmap-card">
              <div className="ob-roadmap-card-icon ob-icon-connect" aria-hidden="true">
                <Users size={20} />
              </div>
              <div className="ob-roadmap-card-content">
                <h3 className="ob-roadmap-card-title">4. Connect with Opportunities</h3>
                <p className="ob-roadmap-card-text">
                  Get discovered by verified founders and hiring teams based on your proven abilities.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Prototype status banner */}
        <div className="ob-prototype-alert" role="status">
          <ShieldCheck size={20} className="ob-alert-icon" aria-hidden="true" />
          <div className="ob-alert-body">
            <strong>Frontend Milestone Completed:</strong> Your onboarding walkthrough and local state
            management are fully functional. Cloud persistent storage and backend authentication
            will be wired up in the next phase.
          </div>
        </div>

        {/* Exit CTA */}
        <div className="ob-complete-cta-wrap" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
          {onEnterWorkspace && (
            <button
              type="button"
              className="ob-btn-primary ob-complete-btn"
              onClick={onEnterWorkspace}
              id="btn-enter-job-seeker-workspace"
              style={{ width: '100%', maxWidth: '360px' }}
            >
              <span>Enter Job Seeker Workspace</span>
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            className={onEnterWorkspace ? "ob-btn-secondary ob-complete-btn" : "ob-btn-primary ob-complete-btn"}
            onClick={onExit}
            id="complete-return-home-btn"
            style={{ width: '100%', maxWidth: '360px' }}
          >
            <span>Return to YOGYATA Home</span>
            {!onEnterWorkspace && <ArrowRight size={18} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </StepWrapper>
  );
};
