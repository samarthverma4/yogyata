import React from 'react';
import {
  Compass,
  User,
  Award,
  CheckCircle2,
  Target,
  Briefcase,
  FileText,
  Settings,
} from 'lucide-react';
import type { JobSeekerWorkspaceTab, JobSeekerWorkspaceState } from './types';

interface JobSeekerSidebarProps {
  currentTab: JobSeekerWorkspaceTab;
  onTabChange: (tab: JobSeekerWorkspaceTab) => void;
  state: JobSeekerWorkspaceState;
}

export const JobSeekerSidebar: React.FC<JobSeekerSidebarProps> = ({
  currentTab,
  onTabChange,
  state,
}) => {
  const totalSkills = state.skills.length;
  const verifiedSkills = state.skills.filter((s) => s.tier === 'verified').length;
  const availableAssessments = state.assessments.length;
  const savedOpportunities = state.opportunities.filter((o) => o.isSaved).length;
  const totalApplications = state.applications.length;

  const navItems = [
    {
      id: 'overview' as JobSeekerWorkspaceTab,
      label: 'Overview',
      icon: Compass,
    },
    {
      id: 'profile' as JobSeekerWorkspaceTab,
      label: 'My Profile',
      icon: User,
    },
    {
      id: 'skill-passport' as JobSeekerWorkspaceTab,
      label: 'Skill Passport',
      icon: Award,
      badge: verifiedSkills > 0 ? `${verifiedSkills} verified` : `${totalSkills}`,
    },
    {
      id: 'assessments' as JobSeekerWorkspaceTab,
      label: 'Assessments',
      icon: CheckCircle2,
      badge: `${availableAssessments}`,
    },
    {
      id: 'career-roadmap' as JobSeekerWorkspaceTab,
      label: 'Career Roadmap',
      icon: Target,
    },
    {
      id: 'opportunities' as JobSeekerWorkspaceTab,
      label: 'Opportunities',
      icon: Briefcase,
      badge: savedOpportunities > 0 ? `${savedOpportunities} saved` : undefined,
    },
    {
      id: 'applications' as JobSeekerWorkspaceTab,
      label: 'Applications',
      icon: FileText,
      badge: totalApplications > 0 ? `${totalApplications}` : undefined,
    },
    {
      id: 'settings' as JobSeekerWorkspaceTab,
      label: 'Settings',
      icon: Settings,
    },
  ];

  return (
    <aside className="jsw-sidebar" aria-label="Job Seeker Navigation">
      <nav className="jsw-sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              className={`jsw-nav-btn ${isActive ? 'is-active' : ''}`}
              onClick={() => onTabChange(item.id)}
              id={`jsw-nav-${item.id}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="jsw-nav-label-group">
                <Icon size={18} />
                <span>{item.label}</span>
              </div>
              {item.badge && <span className="jsw-nav-count">{item.badge}</span>}
            </button>
          );
        })}
      </nav>

      <div className="jsw-sidebar-footer">
        <div
          style={{
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            padding: '0.75rem',
            fontSize: '0.75rem',
            color: '#64748B',
            lineHeight: 1.4,
          }}
        >
          <strong style={{ color: '#0F172A', display: 'block', marginBottom: '2px' }}>
            Evidence Guarantee
          </strong>
          Skills on YOGYATA are verified only via structured challenges and audit, never self-awarded.
        </div>
      </div>
    </aside>
  );
};
