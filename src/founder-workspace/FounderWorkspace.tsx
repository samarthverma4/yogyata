import React, { useState, useEffect, useCallback, useRef } from 'react';
import { syncFounderTasks } from '../lib/founderSync';
import { listFounderSubmissions, saveFounderReview } from '../lib/founderReview';
import type {
  FounderWorkspaceState,
  WorkspaceTab,
  Project,
  WorkspaceTask,
  TaskSubmission,
  WorkspaceSettings,
} from './types';
import {
  loadFounderWorkspace,
  saveFounderWorkspace,
  clearFounderWorkspace,
  initializeWorkspaceFromOnboarding,
} from './storage';
import { loadFounderDraft } from '../founder-onboarding/storage';
import { INITIAL_FOUNDER_ONBOARDING_STATE } from '../founder-onboarding/types';
import { Sidebar } from './Sidebar';
import { WorkspaceHeader } from './WorkspaceHeader';
import './workspace.css';

// Import Tabs
import { OverviewTab } from './tabs/OverviewTab';
import { MyStartupTab } from './tabs/MyStartupTab';
import { ProjectsTab } from './tabs/ProjectsTab';
import { TasksTab } from './tabs/TasksTab';
import { TalentDiscoveryTab } from './tabs/TalentDiscoveryTab';
import { SubmissionsTab } from './tabs/SubmissionsTab';
import { SettingsTab } from './tabs/SettingsTab';

interface FounderWorkspaceProps {
  initialState?: FounderWorkspaceState;
  onExitToHome: () => void;
  /** Mirror tasks to Supabase so seekers can browse the published ones (signed-in founders). */
  cloudSync?: boolean;
}

export const FounderWorkspace: React.FC<FounderWorkspaceProps> = ({
  initialState,
  onExitToHome,
  cloudSync = false,
}) => {
  // Initialize state from prop, localStorage, or onboarding draft
  const [workspace, setWorkspace] = useState<FounderWorkspaceState>(() => {
    if (initialState) {
      saveFounderWorkspace(initialState);
      return initialState;
    }

    const saved = loadFounderWorkspace();
    if (saved) return saved;

    // Fall back to existing founder onboarding draft if present
    const draft = loadFounderDraft();
    const onboarding = draft ? draft.state : INITIAL_FOUNDER_ONBOARDING_STATE;
    const initialized = initializeWorkspaceFromOnboarding(onboarding);
    saveFounderWorkspace(initialized);
    return initialized;
  });

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // Contextual tab filters (e.g. navigating from Projects to Tasks filtered by projectId)
  const [contextualProjectId, setContextualProjectId] = useState<string | undefined>(undefined);
  const [contextualTaskId, setContextualTaskId] = useState<string | undefined>(undefined);

  // Sync state changes to localStorage
  const updateAndPersist = useCallback((updated: FounderWorkspaceState) => {
    setWorkspace(updated);
    saveFounderWorkspace(updated);
  }, []);

  // Handlers for Startup profile edits
  const handleUpdateStartup = useCallback(
    (
      startup: FounderWorkspaceState['startup'],
      founder: FounderWorkspaceState['founder'],
      goals: FounderWorkspaceState['goals'],
      talentRequirements: FounderWorkspaceState['talentRequirements']
    ) => {
      const updated: FounderWorkspaceState = {
        ...workspace,
        startup,
        founder,
        goals,
        talentRequirements,
        lastUpdatedAt: new Date().toISOString(),
      };
      updateAndPersist(updated);
    },
    [workspace, updateAndPersist]
  );

  // Handlers for Project CRUD
  const handleAddProject = useCallback(
    (projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString();
      const newProject: Project = {
        ...projectData,
        id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: now,
        updatedAt: now,
      };
      const updated: FounderWorkspaceState = {
        ...workspace,
        projects: [newProject, ...workspace.projects],
        lastUpdatedAt: now,
      };
      updateAndPersist(updated);
    },
    [workspace, updateAndPersist]
  );

  const handleEditProject = useCallback(
    (project: Project) => {
      const updatedProjects = workspace.projects.map((p) =>
        p.id === project.id ? project : p
      );
      const updated: FounderWorkspaceState = {
        ...workspace,
        projects: updatedProjects,
        lastUpdatedAt: new Date().toISOString(),
      };
      updateAndPersist(updated);
    },
    [workspace, updateAndPersist]
  );

  const handleDeleteProject = useCallback(
    (projectId: string) => {
      const updatedProjects = workspace.projects.filter((p) => p.id !== projectId);
      // Unlink any tasks that pointed to this project
      const updatedTasks = workspace.tasks.map((t) =>
        t.projectId === projectId ? { ...t, projectId: 'proj-unassigned' } : t
      );
      const updated: FounderWorkspaceState = {
        ...workspace,
        projects: updatedProjects,
        tasks: updatedTasks,
        lastUpdatedAt: new Date().toISOString(),
      };
      updateAndPersist(updated);
    },
    [workspace, updateAndPersist]
  );

  // Handlers for Task CRUD
  const handleAddTask = useCallback(
    (taskData: Omit<WorkspaceTask, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString();
      const newTask: WorkspaceTask = {
        ...taskData,
        id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: now,
        updatedAt: now,
      };
      const updated: FounderWorkspaceState = {
        ...workspace,
        tasks: [newTask, ...workspace.tasks],
        lastUpdatedAt: now,
      };
      updateAndPersist(updated);
    },
    [workspace, updateAndPersist]
  );

  const handleEditTask = useCallback(
    (task: WorkspaceTask) => {
      const updatedTasks = workspace.tasks.map((t) => (t.id === task.id ? task : t));
      const updated: FounderWorkspaceState = {
        ...workspace,
        tasks: updatedTasks,
        lastUpdatedAt: new Date().toISOString(),
      };
      updateAndPersist(updated);
    },
    [workspace, updateAndPersist]
  );

  const handleDeleteTask = useCallback(
    (taskId: string) => {
      const updatedTasks = workspace.tasks.filter((t) => t.id !== taskId);
      // Unlink or clean submissions
      const updatedSubs = workspace.submissions.filter((s) => s.taskId !== taskId);
      const updated: FounderWorkspaceState = {
        ...workspace,
        tasks: updatedTasks,
        submissions: updatedSubs,
        lastUpdatedAt: new Date().toISOString(),
      };
      updateAndPersist(updated);
    },
    [workspace, updateAndPersist]
  );

  // Signed-in founders review real submissions from Supabase; the offline prototype keeps its demo rows
  const [cloudSubs, setCloudSubs] = useState<TaskSubmission[] | null>(null);
  const [subsError, setSubsError] = useState('');
  const [subsVersion, setSubsVersion] = useState(0);
  useEffect(() => {
    if (!cloudSync) return;
    let live = true;
    listFounderSubmissions()
      .then((subs) => {
        if (!live) return;
        setCloudSubs(subs);
        setSubsError('');
      })
      .catch((e: unknown) => live && setSubsError(e instanceof Error ? e.message : 'Could not load submissions.'));
    return () => {
      live = false;
    };
    // refetch when the founder opens the tab, so new work shows up without a reload
  }, [cloudSync, subsVersion, activeTab]);

  const view: FounderWorkspaceState = cloudSync ? { ...workspace, submissions: cloudSubs ?? [] } : workspace;

  // Handlers for Submission Evaluation
  const handleReviewSubmission = useCallback(
    async (submission: TaskSubmission): Promise<{ error?: string }> => {
      if (cloudSync) {
        const res = await saveFounderReview(submission);
        setSubsVersion((v) => v + 1);
        return res;
      }
      const updatedSubs = workspace.submissions.map((s) =>
        s.id === submission.id ? submission : s
      );
      const updated: FounderWorkspaceState = {
        ...workspace,
        submissions: updatedSubs,
        lastUpdatedAt: new Date().toISOString(),
      };
      updateAndPersist(updated);
      return {};
    },
    [cloudSync, workspace, updateAndPersist]
  );

  // Settings and Reset
  const handleUpdateSettings = useCallback(
    (settings: WorkspaceSettings) => {
      const updated: FounderWorkspaceState = {
        ...workspace,
        settings,
        lastUpdatedAt: new Date().toISOString(),
      };
      updateAndPersist(updated);
    },
    [workspace, updateAndPersist]
  );

  const handleResetWorkspace = useCallback(() => {
    clearFounderWorkspace();
    const draft = loadFounderDraft();
    const onboarding = draft ? draft.state : INITIAL_FOUNDER_ONBOARDING_STATE;
    const fresh = initializeWorkspaceFromOnboarding(onboarding);
    saveFounderWorkspace(fresh);
    setWorkspace(fresh);
    setActiveTab('overview');
  }, []);

  // Navigation dispatcher
  const handleNavigateTab = useCallback(
    (tab: WorkspaceTab, contextFilterId?: string) => {
      if (tab === 'tasks' && contextFilterId) {
        setContextualProjectId(contextFilterId);
      } else if (tab === 'submissions' && contextFilterId) {
        setContextualTaskId(contextFilterId);
      }
      setActiveTab(tab);
      setIsMobileNavOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    []
  );

  // Global escape key to close mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileNavOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Mirror tasks to Supabase shortly after they change (only the fields seekers see trigger a sync)
  const latestWorkspace = useRef(workspace);
  useEffect(() => {
    latestWorkspace.current = workspace;
  }, [workspace]);
  const [syncError, setSyncError] = useState('');
  const syncKey = JSON.stringify([
    workspace.tasks,
    workspace.projects.map((p) => [p.id, p.title]),
    workspace.startup.startupName,
  ]);
  useEffect(() => {
    if (!cloudSync) return;
    const timer = window.setTimeout(() => {
      syncFounderTasks(latestWorkspace.current).then((res) => setSyncError(res.error ?? ''));
    }, 600);
    return () => window.clearTimeout(timer);
  }, [cloudSync, syncKey]);

  return (
    <div className="yw-app ws-root">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={activeTab}
        workspace={view}
        onTabChange={(tab: WorkspaceTab) => {
          setActiveTab(tab);
          setIsMobileNavOpen(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onExitToHome={onExitToHome}
        isOpenOnMobile={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
      />

      {/* Main Workspace Area */}
      {syncError && (
        <p className="yg-sync-error" role="alert">
          Tasks could not be shared with seekers: {syncError}
        </p>
      )}
      <div className="yw-main ws-main-wrapper">
        {/* Header */}
        <WorkspaceHeader
          currentTab={activeTab}
          onOpenMobileMenu={() => setIsMobileNavOpen(true)}
          onNewProject={() => handleNavigateTab('projects')}
          onNewTask={() => handleNavigateTab('tasks')}
          onDiscoverTalent={() => handleNavigateTab('talent')}
        />

        {/* Tab View Routing */}
        <main id="workspace-main-content">
          {activeTab === 'overview' && (
            <OverviewTab
              workspace={view}
              onNavigateTab={handleNavigateTab}
              onNewProject={() => handleNavigateTab('projects')}
              onNewTask={() => handleNavigateTab('tasks')}
            />
          )}

          {activeTab === 'startup' && (
            <MyStartupTab
              workspace={workspace}
              onUpdateStartup={handleUpdateStartup}
              onNavigateTab={handleNavigateTab}
            />
          )}

          {activeTab === 'projects' && (
            <ProjectsTab
              projects={workspace.projects}
              tasks={workspace.tasks}
              onAddProject={handleAddProject}
              onEditProject={handleEditProject}
              onDeleteProject={handleDeleteProject}
              onNavigateTab={handleNavigateTab}
            />
          )}

          {activeTab === 'tasks' && (
            <TasksTab
              tasks={workspace.tasks}
              projects={workspace.projects}
              submissions={view.submissions}
              selectedProjectId={contextualProjectId}
              onAddTask={handleAddTask}
              onEditTask={handleEditTask}
              onDeleteTask={handleDeleteTask}
              onNavigateTab={handleNavigateTab}
            />
          )}

          {activeTab === 'talent' && (
            <TalentDiscoveryTab tasks={workspace.tasks} />
          )}

          {activeTab === 'submissions' && (
            <SubmissionsTab
              submissions={view.submissions}
              cloud={cloudSync}
              loadError={subsError}
              tasks={workspace.tasks}
              selectedTaskId={contextualTaskId}
              onReviewSubmission={handleReviewSubmission}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsTab
              workspace={workspace}
              onUpdateSettings={handleUpdateSettings}
              onResetWorkspace={handleResetWorkspace}
            />
          )}
        </main>
      </div>
    </div>
  );
};
