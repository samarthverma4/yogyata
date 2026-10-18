import React from 'react';
import type { WorkspaceTab, FounderWorkspaceState } from './types';
import { BrandMark } from '../brand/BrandMark';
import {
  LayoutDashboard,
  Building2,
  Briefcase,
  FileCode2,
  Users,
  Inbox,
  Settings,
  LogOut,
  Building,
  User,
  X,
} from 'lucide-react';

interface SidebarProps {
  currentTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
  workspace: FounderWorkspaceState;
  isOpenOnMobile: boolean;
  onCloseMobile: () => void;
  onExitToHome: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  workspace,
  isOpenOnMobile,
  onCloseMobile,
  onExitToHome,
}) => {
  const { founder, startup, projects, tasks, submissions } = workspace;

  const pendingSubmissionsCount = submissions.filter(
    (s) => s.status === 'submitted' || s.status === 'under-review'
  ).length;

  const publishedTasksCount = tasks.filter((t) => t.status === 'published').length;

  const navItems: { id: WorkspaceTab; label: string; icon: React.ReactNode; badge?: number; badgeAmber?: boolean }[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <LayoutDashboard size={18} aria-hidden="true" />,
    },
    {
      id: 'startup',
      label: 'My Startup',
      icon: <Building2 size={18} aria-hidden="true" />,
    },
    {
      id: 'projects',
      label: 'Projects',
      icon: <Briefcase size={18} aria-hidden="true" />,
      badge: projects.length,
    },
    {
      id: 'tasks',
      label: 'Tasks & Challenges',
      icon: <FileCode2 size={18} aria-hidden="true" />,
      badge: publishedTasksCount,
    },
    {
      id: 'talent',
      label: 'Talent Discovery',
      icon: <Users size={18} aria-hidden="true" />,
    },
    {
      id: 'submissions',
      label: 'Submissions',
      icon: <Inbox size={18} aria-hidden="true" />,
      badge: pendingSubmissionsCount,
      badgeAmber: pendingSubmissionsCount > 0,
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
      <div
        className={`ws-sidebar-backdrop ${isOpenOnMobile ? 'is-open' : ''}`}
        onClick={onCloseMobile}
        aria-hidden="true"
      />

      <aside className={`ws-sidebar ${isOpenOnMobile ? 'is-open' : ''}`} aria-label="Founder Workspace Navigation">
        {/* Top Brand */}
        <div className="ws-sidebar-brand">
          <button
            type="button"
            className="ws-brand-btn"
            onClick={onExitToHome}
            aria-label="YOGYATA Home"
            title="Return to YOGYATA Home"
          >
            <BrandMark sub="Founder workspace" />
          </button>

          {/* Close for mobile drawer */}
          <button
            type="button"
            className="ws-mobile-menu-btn"
            onClick={onCloseMobile}
            aria-label="Close sidebar navigation"
          >
            <X size={18} />
          </button>
        </div>

        {/* Current Startup Box */}
        <div className="ws-startup-badge-box">
          <div className="ws-startup-logo-avatar">
            {startup.logoUrl ? (
              <img src={startup.logoUrl} alt={startup.startupName || 'Startup logo'} className="ws-startup-logo-img" />
            ) : (
              <Building size={18} />
            )}
          </div>
          <div className="ws-startup-meta-info">
            <div className="ws-startup-meta-name" title={startup.startupName || 'Untitled Venture'}>
              {startup.startupName || 'Untitled Venture'}
            </div>
            <div className="ws-startup-meta-stage">
              {startup.stage || 'Venture'} · {startup.city || startup.country || 'Global'}
            </div>
          </div>
        </div>

        {/* Navigation List */}
        <nav className="ws-sidebar-nav">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`ws-nav-item ${isActive ? 'is-active' : ''}`}
                onClick={() => {
                  onTabChange(item.id);
                  onCloseMobile();
                }}
                id={`ws-nav-${item.id}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <div className="ws-nav-item-left">
                  {item.icon}
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className={`ws-nav-badge ${item.badgeAmber ? 'badge-amber' : ''}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer User Info + Exit */}
        <div className="ws-sidebar-footer">
          <div className="ws-user-card">
            <div className="ws-user-avatar">
              {founder.profilePhotoUrl ? (
                <img src={founder.profilePhotoUrl} alt={founder.fullName || 'Founder'} />
              ) : (
                <User size={16} />
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="ws-user-name" title={founder.fullName || 'Founder'}>
                {founder.fullName || 'Founder'}
              </div>
              <div className="ws-user-role" title={founder.professionalTitle || 'Founder'}>
                {founder.professionalTitle || 'Founder'}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="ws-exit-home-btn"
            onClick={onExitToHome}
            aria-label="Exit workspace to public homepage"
            title="Exit to YOGYATA Home"
            id="ws-exit-home-btn"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>
    </>
  );
};
