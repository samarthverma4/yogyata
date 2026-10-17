import React from 'react';
import type { MentorWorkspaceTab, MentorWorkspaceState } from './types';
import {
  LayoutDashboard,
  Inbox,
  Users,
  Calendar,
  MessageSquare,
  User,
  Settings,
  LogOut,
  X,
  GraduationCap,
} from 'lucide-react';

interface MentorSidebarProps {
  currentTab: MentorWorkspaceTab;
  onTabChange: (tab: MentorWorkspaceTab) => void;
  workspace: MentorWorkspaceState;
  isOpenOnMobile: boolean;
  onCloseMobile: () => void;
  onExitToHome: () => void;
}

export const MentorSidebar: React.FC<MentorSidebarProps> = ({
  currentTab,
  onTabChange,
  workspace,
  isOpenOnMobile,
  onCloseMobile,
  onExitToHome,
}) => {
  const { mentor, requests, mentees, sessions, feedback } = workspace;

  const pendingRequestsCount = requests.filter((r) => r.status === 'pending').length;
  const activeMenteesCount = mentees.filter((m) => m.status === 'active').length;
  const upcomingSessionsCount = sessions.filter((s) => s.status === 'scheduled').length;

  const navItems: {
    id: MentorWorkspaceTab;
    label: string;
    icon: React.ReactNode;
    badge?: number;
    badgeColor?: 'blue' | 'amber' | 'green';
  }[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <LayoutDashboard size={18} aria-hidden="true" />,
    },
    {
      id: 'requests',
      label: 'Mentorship Requests',
      icon: <Inbox size={18} aria-hidden="true" />,
      badge: pendingRequestsCount,
      badgeColor: 'amber',
    },
    {
      id: 'mentees',
      label: 'Mentees',
      icon: <Users size={18} aria-hidden="true" />,
      badge: activeMenteesCount,
      badgeColor: 'green',
    },
    {
      id: 'sessions',
      label: 'Sessions',
      icon: <Calendar size={18} aria-hidden="true" />,
      badge: upcomingSessionsCount,
      badgeColor: 'blue',
    },
    {
      id: 'feedback',
      label: 'Learning Feedback',
      icon: <MessageSquare size={18} aria-hidden="true" />,
      badge: feedback.length > 0 ? feedback.length : undefined,
    },
    {
      id: 'profile',
      label: 'Mentor Profile',
      icon: <User size={18} aria-hidden="true" />,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings size={18} aria-hidden="true" />,
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenOnMobile && (
        <div
          onClick={onCloseMobile}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
            zIndex: 49,
          }}
        />
      )}

      {/* Sidebar Shell */}
      <aside
        style={{
          width: '260px',
          background: '#FFFFFF',
          borderRight: '1px solid #E2E8F0',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 50,
          boxSizing: 'border-box',
          ...(isOpenOnMobile
            ? {
                position: 'fixed',
                left: 0,
                top: 0,
                bottom: 0,
                boxShadow: '4px 0 24px rgba(0,0,0,0.15)',
              }
            : {}),
        }}
      >
        {/* Brand Header */}
        <div
          style={{
            padding: '18px 20px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#FAF5FF',
                border: '1px solid #E9D5FF',
                color: '#9333EA',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <GraduationCap size={18} />
            </div>
            <div>
              <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1B2A4E', display: 'block', lineHeight: 1.1 }}>
                YOGYATA
              </span>
              <span
                style={{
                  fontSize: '0.66rem',
                  fontWeight: 700,
                  color: '#9333EA',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  display: 'block',
                }}
              >
                Mentor Workspace
              </span>
            </div>
          </div>

          {isOpenOnMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748B',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Mentor Mini Card */}
        <div
          style={{
            padding: '14px 18px',
            background: '#F8FAFC',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: '#EEF2FF',
              color: '#4F46E5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '0.9rem',
              border: '1px solid #E0E7FF',
              flexShrink: 0,
            }}
          >
            {mentor.fullName
              ? mentor.fullName
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()
              : 'ME'}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <span
              style={{
                display: 'block',
                fontSize: '0.86rem',
                fontWeight: 700,
                color: '#1E293B',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {mentor.fullName || 'Mentor Guide'}
            </span>
            <span
              style={{
                display: 'block',
                fontSize: '0.74rem',
                color: '#64748B',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {mentor.currentRole || 'Industry Mentor'}
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav style={{ flex: 1, padding: '16px 12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onTabChange(item.id);
                  if (isOpenOnMobile) onCloseMobile();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: isActive ? '#EFF6FF' : 'transparent',
                  color: isActive ? '#1D4ED8' : '#475569',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  width: '100%',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: isActive ? '#2563EB' : '#94A3B8' }}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>

                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: '10px',
                      background:
                        item.badgeColor === 'amber'
                          ? '#FEF3C7'
                          : item.badgeColor === 'green'
                          ? '#DCFCE7'
                          : '#DBEAFE',
                      color:
                        item.badgeColor === 'amber'
                          ? '#B45309'
                          : item.badgeColor === 'green'
                          ? '#15803D'
                          : '#1E40AF',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Exit */}
        <div style={{ padding: '14px 16px', borderTop: '1px solid #E2E8F0' }}>
          <button
            type="button"
            onClick={onExitToHome}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #E2E8F0',
              background: '#FFFFFF',
              color: '#64748B',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <LogOut size={16} />
            <span>Exit Workspace</span>
          </button>
        </div>
      </aside>
    </>
  );
};
