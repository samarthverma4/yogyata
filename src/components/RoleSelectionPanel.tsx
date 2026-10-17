import React from 'react';
import {
  Briefcase,
  Lightbulb,
  ArrowRight,
} from 'lucide-react';
import { RoleCard } from './RoleCard';
import type { RoleId, RoleOption } from '../types';

const ROLES: RoleOption[] = [
  {
    id: 'job-seeker',
    title: 'Job Seeker',
    description:
      'Showcase your skills, build your Skill Passport, and discover opportunities that match your capabilities.',
    contextualAction: 'Continue as Job Seeker',
  },
  {
    id: 'founder',
    title: 'Founder / Entrepreneur',
    badge: 'Startup',
    description:
      'Share project challenges, discover capable contributors, and build your next venture.',
    contextualAction: 'Continue as Founder',
  },
];

const ROLE_ICONS: Record<RoleId, React.ReactNode> = {
  'job-seeker': <Briefcase size={20} strokeWidth={1.75} />,
  founder: <Lightbulb size={20} strokeWidth={1.75} />,
};

interface RoleSelectionPanelProps {
  selectedRole: RoleId | null;
  onRoleSelect: (id: RoleId) => void;
  onContinue: (role: RoleOption) => void;
}

export const RoleSelectionPanel: React.FC<RoleSelectionPanelProps> = ({
  selectedRole,
  onRoleSelect,
  onContinue,
}) => {
  const selected = ROLES.find((r) => r.id === selectedRole) ?? null;

  return (
    <section
      className="role-selection-panel"
      aria-label="Role Selection"
      aria-describedby="panel-subtitle"
    >
      <div className="panel-header">
        <h2 className="panel-title">Welcome to YOGYATA</h2>
        <p className="panel-subtitle" id="panel-subtitle">
          Choose how you want to enter the platform.
        </p>
      </div>

      {/* Role Cards Stack — grouped as a radiogroup */}
      <div
        role="radiogroup"
        aria-label="Select your role"
        className="role-cards-stack"
      >
        {ROLES.map((role) => (
          <RoleCard
            key={role.id}
            role={role}
            icon={ROLE_ICONS[role.id]}
            isSelected={selectedRole === role.id}
            onSelect={onRoleSelect}
          />
        ))}
      </div>

      {/* Footer Action Area */}
      <div className="panel-action-area">
        {/* Status Label */}
        <div className="panel-selection-status">
          {selected ? (
            <>
              <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>
                Selected:&nbsp;
              </span>
              <span className="selected-role-pill">
                <svg
                  width="8"
                  height="8"
                  viewBox="0 0 8 8"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <circle cx="4" cy="4" r="4" />
                </svg>
                {selected.title}
              </span>
            </>
          ) : (
            <span style={{ fontStyle: 'italic' }}>
              No role selected yet
            </span>
          )}
        </div>

        {/* Continue Button */}
        <button
          type="button"
          id="continue-btn"
          className="continue-action-btn"
          onClick={() => selected && onContinue(selected)}
          disabled={!selected}
          style={
            !selected
              ? {
                  opacity: 0.5,
                  cursor: 'not-allowed',
                  transform: 'none',
                  boxShadow: 'none',
                }
              : undefined
          }
          aria-disabled={!selected}
        >
          <span>
            {selected ? selected.contextualAction : 'Select a role to continue'}
          </span>
          {selected && <ArrowRight size={16} className="continue-btn-arrow" aria-hidden="true" />}
        </button>
      </div>
    </section>
  );
};
