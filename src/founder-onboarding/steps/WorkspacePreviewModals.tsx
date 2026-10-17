import React from 'react';
import type { FounderOnboardingState } from '../types';
import { Modal } from '../../components/Modal';
import { Building2, Users } from 'lucide-react';

interface WorkspacePreviewModalProps {
  activeModal: 'startup' | 'tasks' | 'talent' | null;
  state: FounderOnboardingState;
  onClose: () => void;
}

export const WorkspacePreviewModals: React.FC<WorkspacePreviewModalProps> = ({
  activeModal,
  state,
  onClose,
}) => {
  if (!activeModal) return null;

  const { startup, goals, taskDraft, talentRequirements } = state;

  if (activeModal === 'startup') {
    return (
      <Modal title="My Startup Profile (Preview)" onClose={onClose}>
        <div className="workspace-modal-body">
          <div className="workspace-modal-header-row">
            <div className="founder-logo-preview" style={{ width: 44, height: 44 }}>
              {startup.logoUrl ? (
                <img src={startup.logoUrl} alt="Logo" className="founder-logo-img" />
              ) : (
                <Building2 size={22} className="founder-avatar-placeholder-icon" />
              )}
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-navy)' }}>
                {startup.startupName || 'Your Startup'}
              </h3>
              <p style={{ fontSize: '0.86rem', color: 'var(--color-text-muted)' }}>
                {startup.industry} · {startup.stage} · {startup.city}, {startup.country}
              </p>
            </div>
          </div>

          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <span className="ob-review-label">About the Venture</span>
              <p style={{ fontSize: '0.92rem', color: 'var(--color-text)', marginTop: '4px', lineHeight: 1.5 }}>
                {startup.description || 'No description provided.'}
              </p>
            </div>
            <div className="ob-review-grid">
              <div>
                <span className="ob-review-label">Team Size</span>
                <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>{startup.teamSize || '—'}</p>
              </div>
              <div>
                <span className="ob-review-label">Work Mode</span>
                <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>{startup.workMode ? startup.workMode.toUpperCase() : '—'}</p>
              </div>
            </div>
            {startup.websiteUrl && (
              <div>
                <span className="ob-review-label">Website</span>
                <p style={{ fontSize: '0.9rem', color: 'var(--color-blue)', fontWeight: 600 }}>
                  <a href={startup.websiteUrl} target="_blank" rel="noopener noreferrer">
                    {startup.websiteUrl}
                  </a>
                </p>
              </div>
            )}
          </div>
        </div>
      </Modal>
    );
  }

  if (activeModal === 'tasks') {
    return (
      <Modal title="Projects & Tasks (Preview)" onClose={onClose}>
        <div className="workspace-modal-body">
          <div style={{ marginBottom: '16px' }}>
            <span className="ob-review-label">Active Project Objective</span>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-navy)', marginTop: '2px' }}>
              {goals.primaryGoal} ({goals.projectCategory})
            </h4>
            <p style={{ fontSize: '0.88rem', color: 'var(--color-text)', marginTop: '4px', lineHeight: 1.5 }}>
              {goals.projectDescription}
            </p>
          </div>

          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '14px' }}>
            <span className="ob-review-label">Prepared Task Drafts</span>
            {taskDraft.isSkipped || !taskDraft.taskTitle ? (
              <p style={{ fontSize: '0.88rem', color: 'var(--color-text-muted)', fontStyle: 'italic', marginTop: '6px' }}>
                No task drafts prepared yet. You will be able to create structured proof challenges from your founder dashboard.
              </p>
            ) : (
              <div className="founder-req-card" style={{ marginTop: '10px' }}>
                <span className="ob-dev-badge" style={{ background: '#21845A', width: 'fit-content', marginBottom: '6px' }}>
                  TASK DRAFT
                </span>
                <h4 style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--color-navy)' }}>
                  {taskDraft.taskTitle}
                </h4>
                <p style={{ fontSize: '0.83rem', color: 'var(--color-text)', marginTop: '4px' }}>
                  {taskDraft.problemStatement}
                </p>
                <div style={{ marginTop: '8px' }}>
                  <span className="ob-review-label">Expected Deliverable:</span>
                  <p style={{ fontSize: '0.83rem', color: 'var(--color-text)' }}>
                    {taskDraft.expectedDeliverable}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>
    );
  }

  if (activeModal === 'talent') {
    return (
      <Modal title="Discover Talent (Future Service)" onClose={onClose}>
        <div className="workspace-modal-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <Users size={24} style={{ color: 'var(--color-blue)' }} />
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-navy)' }}>
                Ecosystem Contributor Discovery
              </h3>
              <p style={{ fontSize: '0.84rem', color: 'var(--color-text-muted)' }}>
                Skills backed by proof, not keyword claims.
              </p>
            </div>
          </div>

          <div className="ob-info-notice ob-notice-info">
            <strong>Candidate Matching Service:</strong> In this milestone, candidate discovery is simulated without fabricating artificial profiles. When connected to the YOGYATA Matching Engine, contributors will be ranked according to DECLARED, ASSESSED, and VERIFIED Skill Passports matching your criteria:
          </div>

          <div style={{ marginTop: '14px' }}>
            <span className="ob-review-label">Configured Talent Criteria:</span>
            {talentRequirements.length === 0 ? (
              <p style={{ fontSize: '0.88rem', color: 'var(--color-text-muted)', fontStyle: 'italic', marginTop: '6px' }}>
                No active talent requirements configured. You can publish roles once the full workspace is launched.
              </p>
            ) : (
              <ul style={{ listStyle: 'disc', paddingLeft: '20px', marginTop: '6px', fontSize: '0.88rem', lineHeight: 1.6 }}>
                {talentRequirements.map((req) => (
                  <li key={req.id}>
                    <strong>{req.roleTitle}</strong> ({req.contributorsCount} needed, {req.workArrangement}) — Skills: {req.requiredSkills.join(', ') || 'Any'}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Modal>
    );
  }

  return null;
};
