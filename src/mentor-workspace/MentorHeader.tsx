import React from 'react';
import type { MentorWorkspaceTab, MentorWorkspaceState } from './types';
import { Menu, ArrowLeft } from 'lucide-react';

interface MentorHeaderProps {
  currentTab: MentorWorkspaceTab;
  workspace: MentorWorkspaceState;
  onOpenMobileMenu: () => void;
  onExitToHome: () => void;
}

const TAB_TITLES: Record<MentorWorkspaceTab, string> = {
  overview: 'Workspace Overview',
  requests: 'Mentorship Requests',
  mentees: 'Mentee Roster & Progression',
  sessions: 'Scheduled Sessions',
  feedback: 'Learning Feedback & Guidance',
  profile: 'Mentor Profile',
  settings: 'Workspace Settings',
};

export const MentorHeader: React.FC<MentorHeaderProps> = ({
  currentTab,
  workspace,
  onOpenMobileMenu,
  onExitToHome,
}) => {
  const { mentor, mentees, preferences } = workspace;
  const activeMenteesCount = mentees.filter((m) => m.status === 'active').length;
  const maxCapacity = preferences.maxActiveMentees || 3;

  return (
    <header
      style={{
        height: '64px',
        background: '#FFFFFF',
        borderBottom: '1px solid #E2E8F0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 28px',
        position: 'sticky',
        top: 0,
        zIndex: 30,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Mobile menu button */}
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          style={{
            background: 'none',
            border: 'none',
            color: '#64748B',
            cursor: 'pointer',
            padding: '6px',
            display: 'none', // Will be shown on mobile via media query or default flex if needed
          }}
          className="mentor-mobile-toggle-btn"
        >
          <Menu size={20} />
        </button>

        <h1 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1B2A4E', margin: 0 }}>
          {TAB_TITLES[currentTab] || 'Mentor Workspace'}
        </h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Capacity Meter */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '5px 12px',
            borderRadius: '20px',
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            fontSize: '0.78rem',
            color: '#475569',
          }}
        >
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: activeMenteesCount >= maxCapacity ? '#D97706' : '#16A34A',
            }}
          />
          <span style={{ fontWeight: 600 }}>
            {activeMenteesCount} / {maxCapacity} Active Mentees
          </span>
        </div>

        {/* Exit Button */}
        <button
          type="button"
          onClick={onExitToHome}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '6px',
            border: '1px solid #E2E8F0',
            background: '#FFFFFF',
            color: '#64748B',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={14} /> Exit
        </button>

        {/* Avatar */}
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: '#FAF5FF',
            color: '#9333EA',
            border: '1px solid #E9D5FF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '0.85rem',
          }}
          title={mentor.fullName}
        >
          {mentor.fullName
            ? mentor.fullName
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()
            : 'M'}
        </div>
      </div>
    </header>
  );
};
