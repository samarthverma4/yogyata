import React, { useState } from 'react';
import type { FounderOnboardingState } from '../types';
import { StepWrapper } from '../../onboarding/shared';
import { WorkspacePreviewModals } from './WorkspacePreviewModals';
import {
  CheckCircle2, ArrowRight, Building2, FileCode2, Users, ShieldCheck,
} from 'lucide-react';

interface FounderCompleteStepProps {
  state: FounderOnboardingState;
  onExit: () => void;
  onEnterWorkspace?: () => void;
}

export const FounderCompleteStep: React.FC<FounderCompleteStepProps> = ({
  state,
  onExit,
  onEnterWorkspace,
}) => {
  const [activeModal, setActiveModal] = useState<'startup' | 'tasks' | 'talent' | null>(null);
  const founderName = state.profile.fullName || state.account.fullName;
  const firstName = founderName.trim().split(' ')[0] || 'Founder';

  return (
    <StepWrapper>
      <div className="ob-complete-screen">
        <div className="ob-complete-celebrate-badge" aria-hidden="true">
          <CheckCircle2 size={54} className="ob-complete-icon" />
        </div>

        <p className="ob-step-eyebrow">Founder Onboarding Complete</p>
        <h1 className="ob-complete-title">
          Your next chapter starts here, {firstName}.
        </h1>
        <p className="ob-complete-subtitle">
          Your founder profile is ready. Enter your operational workspace to manage projects, publish challenge benchmarks, and discover talent with evidenced Skill Passports.
        </p>

        {/* 3 Next-Step Cards */}
        <div className="ob-complete-roadmap" aria-label="Founder Workspace Quick Access">
          <h2 className="ob-roadmap-heading">Founder Workspace Previews</h2>

          <div className="founder-complete-cards-grid">
            {/* Card 1: My Startup */}
            <button
              type="button"
              className="founder-next-card"
              onClick={() => setActiveModal('startup')}
              id="founder-preview-startup-card"
            >
              <div className="founder-next-card-icon-wrap" aria-hidden="true">
                <Building2 size={22} />
              </div>
              <div className="founder-next-card-content">
                <h3 className="founder-next-card-title">1. My Startup</h3>
                <p className="founder-next-card-text">
                  Review your venture details, stage, and public presence setup.
                </p>
              </div>
              <span className="founder-next-card-action">
                Inspect preview →
              </span>
            </button>

            {/* Card 2: Projects & Tasks */}
            <button
              type="button"
              className="founder-next-card"
              onClick={() => setActiveModal('tasks')}
              id="founder-preview-tasks-card"
            >
              <div className="founder-next-card-icon-wrap founder-icon-tasks" aria-hidden="true">
                <FileCode2 size={22} />
              </div>
              <div className="founder-next-card-content">
                <h3 className="founder-next-card-title">2. Projects & Tasks</h3>
                <p className="founder-next-card-text">
                  Inspect your project scope and prepared challenge drafts.
                </p>
              </div>
              <span className="founder-next-card-action">
                Inspect preview →
              </span>
            </button>

            {/* Card 3: Discover Talent */}
            <button
              type="button"
              className="founder-next-card"
              onClick={() => setActiveModal('talent')}
              id="founder-preview-talent-card"
            >
              <div className="founder-next-card-icon-wrap founder-icon-talent" aria-hidden="true">
                <Users size={22} />
              </div>
              <div className="founder-next-card-content">
                <h3 className="founder-next-card-title">3. Discover Talent</h3>
                <p className="founder-next-card-text">
                  Explore how matching will work with evidence-backed Skill Passports.
                </p>
              </div>
              <span className="founder-next-card-action">
                Learn more →
              </span>
            </button>
          </div>
        </div>

        {/* Prototype status banner */}
        <div className="ob-prototype-alert" role="status">
          <ShieldCheck size={20} className="ob-alert-icon" aria-hidden="true" />
          <div className="ob-alert-body">
            <strong>Frontend Milestone Completed:</strong> Your onboarding profile is saved. Click below to launch your dedicated Founder Workspace with active project and task management.
          </div>
        </div>

        {/* Primary and secondary exit CTAs */}
        <div className="ob-complete-cta-wrap" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            className="ob-btn-primary ob-complete-btn"
            onClick={onEnterWorkspace || onExit}
            id="founder-complete-enter-workspace-btn"
          >
            <span>Enter Founder Workspace</span>
            <ArrowRight size={18} aria-hidden="true" />
          </button>

          <button
            type="button"
            className="ob-btn-secondary"
            onClick={onExit}
            id="founder-complete-return-home-btn"
            style={{ fontSize: '0.875rem' }}
          >
            Return to YOGYATA Home
          </button>
        </div>
      </div>

      {/* Interactive preview modals */}
      <WorkspacePreviewModals
        activeModal={activeModal}
        state={state}
        onClose={() => setActiveModal(null)}
      />
    </StepWrapper>
  );
};
