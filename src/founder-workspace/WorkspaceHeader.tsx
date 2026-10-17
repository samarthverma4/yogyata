import React from 'react';
import type { WorkspaceTab } from './types';
import { Menu, Plus, Compass, Sparkles } from 'lucide-react';

interface WorkspaceHeaderProps {
  currentTab: WorkspaceTab;
  onOpenMobileMenu: () => void;
  onNewProject: () => void;
  onNewTask: () => void;
  onDiscoverTalent: () => void;
}

const TAB_TITLES: Record<WorkspaceTab, { title: string; subtitle: string }> = {
  overview: {
    title: 'Workspace Overview',
    subtitle: 'Venture metrics, project progress, and actionable talent opportunities.',
  },
  startup: {
    title: 'My Startup Profile',
    subtitle: 'Manage your venture details, business objectives, and talent criteria.',
  },
  projects: {
    title: 'Projects',
    subtitle: 'Manage active venture milestones and connect challenges to real objectives.',
  },
  tasks: {
    title: 'Tasks & Challenges',
    subtitle: 'Create and publish practical proof challenges for capable contributors.',
  },
  talent: {
    title: 'Talent Discovery',
    subtitle: 'Explore evidenced contributors through authentic Skill Passports.',
  },
  submissions: {
    title: 'Submissions & Evaluation',
    subtitle: 'Review deliverables submitted by contributors and verify skill proof.',
  },
  settings: {
    title: 'Workspace Settings',
    subtitle: 'Configure privacy preferences, notifications, and local prototype storage.',
  },
};

export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  currentTab,
  onOpenMobileMenu,
  onNewProject,
  onNewTask,
  onDiscoverTalent,
}) => {
  const { title, subtitle } = TAB_TITLES[currentTab];

  return (
    <header className="ws-header" role="banner">
      <div className="ws-header-left">
        <button
          type="button"
          className="ws-mobile-menu-btn"
          onClick={onOpenMobileMenu}
          aria-label="Open sidebar navigation"
          id="ws-open-mobile-menu-btn"
        >
          <Menu size={20} />
        </button>

        <div className="ws-header-title-wrap">
          <h1 className="ws-header-title">{title}</h1>
          <span className="ws-header-sub">{subtitle}</span>
        </div>
      </div>

      <div className="ws-header-right">
        {currentTab === 'projects' && (
          <button
            type="button"
            className="ob-btn-primary"
            onClick={onNewProject}
            style={{ height: 38, padding: '0 14px', fontSize: '0.84rem' }}
            id="ws-header-create-project-btn"
          >
            <Plus size={16} aria-hidden="true" />
            <span>New Project</span>
          </button>
        )}

        {currentTab === 'tasks' && (
          <button
            type="button"
            className="ob-btn-primary"
            onClick={onNewTask}
            style={{ height: 38, padding: '0 14px', fontSize: '0.84rem' }}
            id="ws-header-create-task-btn"
          >
            <Plus size={16} aria-hidden="true" />
            <span>Create Task</span>
          </button>
        )}

        {currentTab === 'overview' && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="ob-btn-secondary"
              onClick={onDiscoverTalent}
              style={{ height: 38, padding: '0 14px', fontSize: '0.84rem' }}
              id="ws-header-discover-talent-btn"
            >
              <Compass size={16} aria-hidden="true" />
              <span>Discover Talent</span>
            </button>
            <button
              type="button"
              className="ob-btn-primary"
              onClick={onNewTask}
              style={{ height: 38, padding: '0 14px', fontSize: '0.84rem' }}
              id="ws-header-new-task-btn"
            >
              <Sparkles size={16} aria-hidden="true" />
              <span>New Task</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
