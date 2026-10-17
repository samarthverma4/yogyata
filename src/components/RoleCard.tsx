import React from 'react';
import type { RoleId, RoleOption } from '../types';

interface RoleCardProps {
  role: RoleOption;
  icon: React.ReactNode;
  isSelected: boolean;
  onSelect: (id: RoleId) => void;
}

export const RoleCard: React.FC<RoleCardProps> = ({
  role,
  icon,
  isSelected,
  onSelect,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(role.id);
    }
  };

  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      aria-label={`Select role: ${role.title}`}
      id={`role-card-${role.id}`}
      className={`role-card ${isSelected ? 'is-selected' : ''}`}
      onClick={() => onSelect(role.id)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Icon Box */}
      <div className="role-icon-box" aria-hidden="true">
        {icon}
      </div>

      {/* Text Info */}
      <div className="role-text-box">
        <div className="role-title-row">
          <span className="role-title">{role.title}</span>
          {role.badge && (
            <span className="role-badge">{role.badge}</span>
          )}
        </div>
        <p className="role-description">{role.description}</p>
      </div>

      {/* Right: Radio-Style Indicator */}
      <div className="role-indicator-box" aria-hidden="true">
        <div className="role-indicator-dot" />
      </div>
    </button>
  );
};
