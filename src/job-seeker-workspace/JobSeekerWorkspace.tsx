import React, { useState, useEffect, useCallback } from 'react';
import type {
  JobSeekerWorkspaceState,
  JobSeekerWorkspaceTab,
  JobSeekerProfile,
  JobSeekerSkill,
  AssessmentAttempt,
  RoadmapMilestone,
  Opportunity,
  JobSeekerSettings,
} from './types';
import {
  saveJobSeekerWorkspace,
  resetJobSeekerWorkspaceToDemo,
} from './storage';
import { JobSeekerHeader } from './JobSeekerHeader';
import { JobSeekerSidebar } from './JobSeekerSidebar';
import { OverviewTab } from './tabs/OverviewTab';
import { ProfileTab } from './tabs/ProfileTab';
import { SkillPassportTab } from './tabs/SkillPassportTab';
import { AssessmentsTab } from './tabs/AssessmentsTab';
import { CareerRoadmapTab } from './tabs/CareerRoadmapTab';
import { OpportunitiesTab } from './tabs/OpportunitiesTab';
import { ApplicationsTab } from './tabs/ApplicationsTab';
import { SettingsTab } from './tabs/SettingsTab';

interface JobSeekerWorkspaceProps {
  initialWorkspace: JobSeekerWorkspaceState;
  onExitToHome: () => void;
}

export const JobSeekerWorkspace: React.FC<JobSeekerWorkspaceProps> = ({
  initialWorkspace,
  onExitToHome,
}) => {
  const [state, setState] = useState<JobSeekerWorkspaceState>(initialWorkspace);
  const [activeTab, setActiveTab] = useState<JobSeekerWorkspaceTab>(
    initialWorkspace.activeTab || 'overview'
  );

  // Sync state changes to localStorage
  useEffect(() => {
    saveJobSeekerWorkspace({ ...state, activeTab });
  }, [state, activeTab]);

  const handleTabChange = useCallback((tab: JobSeekerWorkspaceTab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Profile actions
  const handleSaveProfile = useCallback((updated: JobSeekerProfile) => {
    setState((prev) => ({ ...prev, profile: updated }));
  }, []);

  // Skill Passport actions
  const handleAddDeclaredSkill = useCallback(
    (newSkill: Omit<JobSeekerSkill, 'id' | 'tier' | 'dateAdded'>) => {
      const skillEntry: JobSeekerSkill = {
        ...newSkill,
        id: `skill-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        tier: 'declared', // CRITICAL: strictly self-declared!
        dateAdded: new Date().toISOString().split('T')[0],
      };
      setState((prev) => ({
        ...prev,
        skills: [skillEntry, ...prev.skills],
      }));
    },
    []
  );

  const handleUpdateDeclaredSkill = useCallback(
    (id: string, updated: Partial<JobSeekerSkill>) => {
      setState((prev) => ({
        ...prev,
        skills: prev.skills.map((s) => (s.id === id ? { ...s, ...updated } : s)),
      }));
    },
    []
  );

  const handleDeleteDeclaredSkill = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s.id !== id),
    }));
  }, []);

  // Assessment completion action
  const handleCompleteAssessment = useCallback((attempt: AssessmentAttempt) => {
    setState((prev) => {
      // Find if the associated skill already exists
      const existingSkillIndex = prev.skills.findIndex(
        (s) => s.name.toLowerCase() === attempt.associatedSkill.toLowerCase()
      );

      let updatedSkills = [...prev.skills];
      if (existingSkillIndex >= 0) {
        // Only promote to 'assessed' if it is currently 'declared' (never downgrade a 'verified' skill!)
        const currentSkill = updatedSkills[existingSkillIndex];
        const newTier = currentSkill.tier === 'verified' ? 'verified' : 'assessed';

        updatedSkills[existingSkillIndex] = {
          ...currentSkill,
          tier: newTier,
          scoreOrOutcome: `Diagnostic Benchmark: ${attempt.scorePercent}% (${attempt.date})`,
          relatedProjectOrAssessment: attempt.assessmentTitle,
        };
      } else {
        // Create new assessed skill
        updatedSkills.push({
          id: `skill-${Date.now()}`,
          name: attempt.associatedSkill,
          category: 'Assessed Technical Skill',
          tier: 'assessed',
          description: `Diagnostic evaluation benchmark for ${attempt.associatedSkill}.`,
          source: attempt.assessmentTitle,
          dateAdded: attempt.date,
          scoreOrOutcome: `Scored ${attempt.scorePercent}%`,
          relatedProjectOrAssessment: attempt.assessmentTitle,
        });
      }

      return {
        ...prev,
        skills: updatedSkills,
        assessmentAttempts: [attempt, ...prev.assessmentAttempts],
      };
    });
  }, []);

  // Roadmap actions
  const handleToggleMilestone = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      roadmap: prev.roadmap.map((m) =>
        m.id === id
          ? {
              ...m,
              completed: !m.completed,
              completedDate: !m.completed ? new Date().toISOString().split('T')[0] : undefined,
            }
          : m
      ),
    }));
  }, []);

  const handleAddPersonalGoal = useCallback(
    (goal: Omit<RoadmapMilestone, 'id' | 'completed' | 'completedDate' | 'isPersonalGoal'>) => {
      const newGoal: RoadmapMilestone = {
        ...goal,
        id: `goal-${Date.now()}`,
        completed: false,
        isPersonalGoal: true,
      };
      setState((prev) => ({
        ...prev,
        roadmap: [...prev.roadmap, newGoal],
      }));
    },
    []
  );

  const handleUpdateGoal = useCallback((id: string, updated: Partial<RoadmapMilestone>) => {
    setState((prev) => ({
      ...prev,
      roadmap: prev.roadmap.map((m) => (m.id === id ? { ...m, ...updated } : m)),
    }));
  }, []);

  const handleDeleteGoal = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      roadmap: prev.roadmap.filter((m) => m.id !== id),
    }));
  }, []);

  // Opportunities & Applications actions
  const handleToggleSaveOpportunity = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      opportunities: prev.opportunities.map((o) =>
        o.id === id ? { ...o, isSaved: !o.isSaved } : o
      ),
    }));
  }, []);

  const handleApplyOpportunity = useCallback(
    (opportunity: Opportunity, coverNote?: string) => {
      setState((prev) => {
        // Prevent duplicate applications
        const exists = prev.applications.some(
          (a) => a.opportunityId === opportunity.id && a.status !== 'withdrawn'
        );
        if (exists) return prev;

        const newApp = {
          id: `app-${Date.now()}`,
          opportunityId: opportunity.id,
          opportunityTitle: opportunity.title,
          organization: opportunity.organization,
          category: opportunity.category,
          appliedDate: new Date().toISOString().split('T')[0],
          status: 'applied' as const,
          lastUpdated: new Date().toISOString().split('T')[0],
          nextAction: 'Under initial screening by organization hiring team',
          coverNote,
        };

        return {
          ...prev,
          applications: [newApp, ...prev.applications],
        };
      });
    },
    []
  );

  const handleWithdrawApplication = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      applications: prev.applications.map((a) =>
        a.id === id
          ? {
              ...a,
              status: 'withdrawn' as const,
              lastUpdated: new Date().toISOString().split('T')[0],
              nextAction: 'Application withdrawn by candidate',
            }
          : a
      ),
    }));
  }, []);

  // Settings & Reset actions
  const handleUpdateSettings = useCallback((newSettings: JobSeekerSettings) => {
    setState((prev) => ({ ...prev, settings: newSettings }));
  }, []);

  const handleResetDemoData = useCallback(() => {
    const demo = resetJobSeekerWorkspaceToDemo();
    setState(demo);
    setActiveTab('overview');
  }, []);

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab state={state} onTabChange={handleTabChange} />;
      case 'profile':
        return <ProfileTab profile={state.profile} onSaveProfile={handleSaveProfile} />;
      case 'skill-passport':
        return (
          <SkillPassportTab
            skills={state.skills}
            onAddDeclaredSkill={handleAddDeclaredSkill}
            onUpdateDeclaredSkill={handleUpdateDeclaredSkill}
            onDeleteDeclaredSkill={handleDeleteDeclaredSkill}
          />
        );
      case 'assessments':
        return (
          <AssessmentsTab
            assessments={state.assessments}
            attempts={state.assessmentAttempts}
            onCompleteAssessment={handleCompleteAssessment}
          />
        );
      case 'career-roadmap':
        return (
          <CareerRoadmapTab
            primaryRole={state.profile.careerGoals.primaryRole}
            roadmap={state.roadmap}
            onToggleMilestone={handleToggleMilestone}
            onAddPersonalGoal={handleAddPersonalGoal}
            onUpdateGoal={handleUpdateGoal}
            onDeleteGoal={handleDeleteGoal}
          />
        );
      case 'opportunities':
        return (
          <OpportunitiesTab
            opportunities={state.opportunities}
            applications={state.applications}
            onToggleSave={handleToggleSaveOpportunity}
            onApply={handleApplyOpportunity}
          />
        );
      case 'applications':
        return (
          <ApplicationsTab
            applications={state.applications}
            onWithdrawApplication={handleWithdrawApplication}
            onTabChange={handleTabChange}
          />
        );
      case 'settings':
        return (
          <SettingsTab
            settings={state.settings}
            onUpdateSettings={handleUpdateSettings}
            onResetDemoData={handleResetDemoData}
            onExitToRoles={onExitToHome}
          />
        );
      default:
        return <OverviewTab state={state} onTabChange={handleTabChange} />;
    }
  };

  return (
    <div className="jsw-shell" id="job-seeker-workspace">
      <JobSeekerSidebar
        currentTab={activeTab}
        onTabChange={handleTabChange}
        state={state}
      />

      <div className="jsw-main-wrap">
        <JobSeekerHeader
          profile={state.profile}
          onExitToHome={onExitToHome}
        />

        <main className="jsw-content-area" role="main">
          {renderActiveTab()}
        </main>
      </div>
    </div>
  );
};
