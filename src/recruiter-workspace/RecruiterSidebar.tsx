import React from 'react';
import {
  LayoutDashboard,
  Search,
  Layers,
  Calendar,
  FileCheck,
  Building2,
  Settings,
  X,
  Users,
  Briefcase,
  Mail,
} from 'lucide-react';
import type { RecruiterWorkspaceTab } from './types';

interface SidebarItem {
  id: RecruiterWorkspaceTab;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  badge?: number | string;
}

interface RecruiterSidebarProps {
  activeTab: RecruiterWorkspaceTab;
  onTabChange: (tab: RecruiterWorkspaceTab) => void;
  candidateCount: number;
  pipelineCount: number;
  upcomingInterviewCount: number;
  scorecardCount: number;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const RecruiterSidebar: React.FC<RecruiterSidebarProps> = ({
  activeTab,
  onTabChange,
  candidateCount,
  pipelineCount,
  upcomingInterviewCount,
  scorecardCount,
  isMobileOpen,
  onCloseMobile,
}) => {
  const items: SidebarItem[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    {
      id: 'talent-search',
      label: 'Talent Search',
      icon: Search,
      badge: candidateCount,
    },
    { id: 'postings', label: 'Job Postings', icon: Briefcase },
    { id: 'invitations', label: 'Invitations', icon: Mail },
    {
      id: 'pipeline',
      label: 'Candidate Pipeline',
      icon: Layers,
      badge: pipelineCount,
    },
    {
      id: 'interviews',
      label: 'Interview Scheduler',
      icon: Calendar,
      badge: upcomingInterviewCount > 0 ? upcomingInterviewCount : undefined,
    },
    {
      id: 'scorecards',
      label: 'Scorecards',
      icon: FileCheck,
      badge: scorecardCount > 0 ? scorecardCount : undefined,
    },
    { id: 'company', label: 'Company Profile', icon: Building2 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const sidebarContent = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '1.25rem 0.75rem',
      }}
    >
      {/* Mobile Header */}
      {isMobileOpen && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0 0.5rem 1rem',
            borderBottom: '1px solid var(--color-border)',
            marginBottom: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Building2 size={18} style={{ color: '#15803D' }} />
            <strong style={{ fontSize: '0.9375rem', color: 'var(--color-navy)' }}>Recruiter Menu</strong>
          </div>
          <button
            type="button"
            className="btn-ghost"
            onClick={onCloseMobile}
            style={{ padding: '0.35rem', color: 'var(--color-text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Navigation List */}
      <nav aria-label="Recruiter Workspace Navigation" style={{ flex: 1 }}>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {items.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    onTabChange(item.id);
                    if (isMobileOpen) onCloseMobile();
                  }}
                  className={`workspace-nav-btn ${isActive ? 'is-active' : ''}`}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.625rem 0.75rem',
                    borderRadius: 0,
                    border: 'none',
                    background: isActive ? '#F0FDF4' : 'transparent',
                    color: isActive ? '#15803D' : 'var(--color-text-muted)',
                    fontWeight: isActive ? 600 : 500,
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <Icon size={17} style={{ color: isActive ? '#15803D' : 'var(--color-text-muted)' }} />
                    <span>{item.label}</span>
                  </div>

                  {item.badge !== undefined && (
                    <span
                      style={{
                        fontSize: '0.72rem',
                        padding: '0.1rem 0.45rem',
                        borderRadius: 0,
                        background: isActive ? '#DCFCE7' : 'var(--color-surface-2)',
                        color: isActive ? '#166534' : 'var(--color-text-muted)',
                        fontWeight: 600,
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer Info Box */}
      <div
        style={{
          marginTop: 'auto',
          padding: '0.875rem',
          borderRadius: 0,
          background: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          fontSize: '0.75rem',
          color: 'var(--color-text-muted)',
          lineHeight: 1.45,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--color-navy)', fontWeight: 600, marginBottom: '0.25rem' }}>
          <Users size={13} style={{ color: '#15803D' }} />
          <span>Talent Pipeline Active</span>
        </div>
        <div>
          {pipelineCount} candidate{pipelineCount === 1 ? '' : 's'} tracked across screening &amp; interviews.
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        style={{
          width: '240px',
          background: '#FFFFFF',
          borderRight: '1px solid var(--color-border)',
          flexShrink: 0,
          minHeight: 'calc(100vh - 61px)',
        }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div
          className="modal-overlay"
          onClick={onCloseMobile}
          style={{ zIndex: 1040, background: 'rgba(15, 23, 42, 0.4)' }}
        >
          <aside
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              bottom: 0,
              width: '270px',
              background: '#FFFFFF',
              zIndex: 1050,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
};
