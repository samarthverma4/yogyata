import type { ReactNode } from 'react';
import { LayoutDashboard, BadgeCheck, Search, Inbox, Mail, LogOut, User, X, ClipboardCheck, Briefcase, GraduationCap, Map as MapIcon } from 'lucide-react';
import { BrandMark } from '../brand/BrandMark';
import type { SeekerTab } from './shared';

interface Props {
  currentTab: SeekerTab;
  onTabChange: (tab: SeekerTab) => void;
  fullName: string;
  headline: string;
  verifiedCount: number;
  openTaskCount: number;
  actionNeededCount: number;
  pendingInvitationCount: number;
  isOpenOnMobile: boolean;
  onCloseMobile: () => void;
  onSignOut: () => void;
}

export function SeekerSidebar({
  currentTab,
  onTabChange,
  fullName,
  headline,
  verifiedCount,
  openTaskCount,
  actionNeededCount,
  pendingInvitationCount,
  isOpenOnMobile,
  onCloseMobile,
  onSignOut,
}: Props) {
  const items: { id: SeekerTab; label: string; icon: ReactNode; badge?: number; amber?: boolean }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={18} aria-hidden="true" /> },
    { id: 'passport', label: 'Skill Passport', icon: <BadgeCheck size={18} aria-hidden="true" />, badge: verifiedCount },
    { id: 'assessments', label: 'Assessments', icon: <ClipboardCheck size={18} aria-hidden="true" /> },
    { id: 'tasks', label: 'Browse Tasks', icon: <Search size={18} aria-hidden="true" />, badge: openTaskCount },
    {
      id: 'submissions',
      label: 'My Submissions',
      icon: <Inbox size={18} aria-hidden="true" />,
      badge: actionNeededCount,
      amber: actionNeededCount > 0,
    },
    { id: 'opportunities', label: 'Jobs & Applications', icon: <Briefcase size={18} aria-hidden="true" /> },
    { id: 'mentors', label: 'Mentors', icon: <GraduationCap size={18} aria-hidden="true" /> },
    { id: 'roadmap', label: 'Career Roadmap', icon: <MapIcon size={18} aria-hidden="true" /> },
    {
      id: 'invitations',
      label: 'Invitations',
      icon: <Mail size={18} aria-hidden="true" />,
      badge: pendingInvitationCount,
      amber: pendingInvitationCount > 0,
    },
  ];

  return (
    <>
      <div className={`ws-sidebar-backdrop ${isOpenOnMobile ? 'is-open' : ''}`} onClick={onCloseMobile} aria-hidden="true" />
      <aside className={`ws-sidebar ${isOpenOnMobile ? 'is-open' : ''}`} aria-label="Seeker workspace navigation">
        <div className="ws-sidebar-brand">
          <button type="button" className="ws-brand-btn" onClick={() => onTabChange('overview')} aria-label="Seeker workspace overview">
            <BrandMark sub="Seeker workspace" />
          </button>
          <button type="button" className="ws-mobile-menu-btn" onClick={onCloseMobile} aria-label="Close sidebar navigation">
            <X size={18} />
          </button>
        </div>

        <nav className="ws-sidebar-nav">
          {items.map((item) => {
            const active = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`ws-nav-item ${active ? 'is-active' : ''}`}
                onClick={() => {
                  onTabChange(item.id);
                  onCloseMobile();
                }}
                aria-current={active ? 'page' : undefined}
              >
                <div className="ws-nav-item-left">
                  {item.icon}
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`ws-nav-badge ${item.amber ? 'badge-amber' : ''}`}>{item.badge}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="ws-sidebar-footer">
          <div className="ws-user-card">
            <div className="ws-user-avatar">
              <User size={16} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="ws-user-name" title={fullName}>
                {fullName}
              </div>
              <div className="ws-user-role" title={headline || 'Seeker'}>
                {headline || 'Seeker'}
              </div>
            </div>
          </div>
          <button type="button" className="ws-exit-home-btn" onClick={onSignOut} aria-label="Sign out" title="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </aside>
    </>
  );
}
