import React, { useState, useEffect, useCallback } from 'react';
import './workspace.css';
import { RecruiterHeader } from './RecruiterHeader';
import { RecruiterSidebar } from './RecruiterSidebar';
import { OverviewTab } from './tabs/OverviewTab';
import { TalentSearchTab } from './tabs/TalentSearchTab';
import { PipelineTab } from './tabs/PipelineTab';
import { InterviewsTab } from './tabs/InterviewsTab';
import { ScorecardsTab } from './tabs/ScorecardsTab';
import { CompanyTab } from './tabs/CompanyTab';
import { SettingsTab } from './tabs/SettingsTab';
import type {
  RecruiterWorkspaceState,
  RecruiterWorkspaceTab,
  PipelineStage,
  PipelinePriority,
  Interview,
  Scorecard,
  RecruiterSettings,
} from './types';
import type { CompanyProfile } from '../recruiter-onboarding/types';
import {
  saveRecruiterWorkspace,
  resetRecruiterWorkspaceToDemo,
} from './storage';

interface RecruiterWorkspaceProps {
  initialWorkspace: RecruiterWorkspaceState;
  onExitToHome: () => void;
  onLaunchAIArena?: (candidateName: string, role: string) => void;
}

export const RecruiterWorkspace: React.FC<RecruiterWorkspaceProps> = ({
  initialWorkspace,
  onExitToHome,
  onLaunchAIArena,
}) => {
  const [workspace, setWorkspace] = useState<RecruiterWorkspaceState>(initialWorkspace);
  const [activeTab, setActiveTab] = useState<RecruiterWorkspaceTab>('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Autosave workspace on every state change
  useEffect(() => {
    saveRecruiterWorkspace(workspace);
  }, [workspace]);

  // Available roles for hiring filters and target openings
  const availableRoles = workspace.hiring.rolesCommonlyHired.length > 0
    ? workspace.hiring.rolesCommonlyHired
    : ['Senior Technical Contributor', 'Frontend Engineer', 'Backend Specialist'];

  // 1. Candidate Bookmark Toggle
  const handleToggleSaveCandidate = useCallback((candidateId: string) => {
    setWorkspace((prev) => ({
      ...prev,
      candidates: prev.candidates.map((c) =>
        c.id === candidateId ? { ...c, isSaved: !c.isSaved } : c
      ),
    }));
  }, []);

  // 2. Add Candidate to Pipeline
  const handleAddToPipeline = useCallback((candidateId: string, role: string, stage: PipelineStage) => {
    setWorkspace((prev) => {
      // Check if already in active pipeline
      const existing = prev.pipeline.find((p) => p.candidateId === candidateId && p.stage !== 'archived');
      if (existing) {
        return prev;
      }

      const candidate = prev.candidates.find((c) => c.id === candidateId);
      const todayStr = new Date().toISOString().split('T')[0];

      const newPipelineEntry = {
        id: `pipe-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        candidateId,
        candidateName: candidate?.name || 'Candidate',
        targetRole: role,
        stage,
        priority: 'medium' as PipelinePriority,
        dateAdded: todayStr,
        lastUpdated: todayStr,
        recruiterNotes: 'Added to pipeline from Talent Search.',
        nextAction: 'Review profile and schedule initial round',
        tags: candidate?.verifiedSkills || [],
      };

      return {
        ...prev,
        pipeline: [newPipelineEntry, ...prev.pipeline],
      };
    });
  }, []);

  // 3. Pipeline Stage Update
  const handleUpdateStage = useCallback((pipelineId: string, nextStage: PipelineStage) => {
    const todayStr = new Date().toISOString().split('T')[0];
    setWorkspace((prev) => ({
      ...prev,
      pipeline: prev.pipeline.map((p) =>
        p.id === pipelineId ? { ...p, stage: nextStage, lastUpdated: todayStr } : p
      ),
    }));
  }, []);

  // 4. Pipeline Details Update (notes, action, priority, tags)
  const handleUpdatePipelineDetails = useCallback(
    (
      pipelineId: string,
      data: { recruiterNotes?: string; nextAction?: string; priority?: PipelinePriority; tags?: string[] }
    ) => {
      const todayStr = new Date().toISOString().split('T')[0];
      setWorkspace((prev) => ({
        ...prev,
        pipeline: prev.pipeline.map((p) =>
          p.id === pipelineId ? { ...p, ...data, lastUpdated: todayStr } : p
        ),
      }));
    },
    []
  );

  // 5. Remove Candidate from Pipeline
  const handleRemoveFromPipeline = useCallback((pipelineId: string) => {
    setWorkspace((prev) => ({
      ...prev,
      pipeline: prev.pipeline.filter((p) => p.id !== pipelineId),
    }));
  }, []);

  // 6. Schedule Interview
  const handleScheduleInterview = useCallback((interviewData: Omit<Interview, 'id'>) => {
    const newInterview: Interview = {
      ...interviewData,
      id: `int-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    setWorkspace((prev) => ({
      ...prev,
      interviews: [newInterview, ...prev.interviews],
    }));
  }, []);

  // 7. Update Interview
  const handleUpdateInterview = useCallback((id: string, updates: Partial<Interview>) => {
    setWorkspace((prev) => ({
      ...prev,
      interviews: prev.interviews.map((i) => (i.id === id ? { ...i, ...updates } : i)),
    }));
  }, []);

  // 8. Cancel Interview
  const handleCancelInterview = useCallback((id: string, reason: string) => {
    setWorkspace((prev) => ({
      ...prev,
      interviews: prev.interviews.map((i) =>
        i.id === id ? { ...i, status: 'cancelled', cancellationReason: reason } : i
      ),
    }));
  }, []);

  // 9. Scorecards: Create
  const handleCreateScorecard = useCallback((scorecardData: Omit<Scorecard, 'id' | 'submittedAt'>) => {
    const newScorecard: Scorecard = {
      ...scorecardData,
      id: `sc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      submittedAt: new Date().toISOString(),
    };
    setWorkspace((prev) => ({
      ...prev,
      scorecards: [newScorecard, ...prev.scorecards],
    }));
  }, []);

  // 10. Scorecards: Update
  const handleUpdateScorecard = useCallback((id: string, updates: Partial<Scorecard>) => {
    setWorkspace((prev) => ({
      ...prev,
      scorecards: prev.scorecards.map((sc) => (sc.id === id ? { ...sc, ...updates } : sc)),
    }));
  }, []);

  // 11. Scorecards: Delete
  const handleDeleteScorecard = useCallback((id: string) => {
    setWorkspace((prev) => ({
      ...prev,
      scorecards: prev.scorecards.filter((sc) => sc.id !== id),
    }));
  }, []);

  // 12. Save Company Profile
  const handleSaveCompany = useCallback((company: CompanyProfile) => {
    setWorkspace((prev) => ({
      ...prev,
      company,
    }));
  }, []);

  // 13. Save Settings
  const handleSaveSettings = useCallback((settings: RecruiterSettings) => {
    setWorkspace((prev) => ({
      ...prev,
      settings,
    }));
  }, []);

  // 14. Reset to Demo Data
  const handleResetDemoData = useCallback(() => {
    const fresh = resetRecruiterWorkspaceToDemo();
    setWorkspace(fresh);
  }, []);

  const upcomingInterviewCount = workspace.interviews.filter((i) => i.status === 'scheduled').length;

  return (
    <div className="recruiter-workspace-root" style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <RecruiterHeader
        recruiter={workspace.recruiter}
        company={workspace.company}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onExitToHome={onExitToHome}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />

      {/* Main Workspace Body with Sidebar & Content */}
      <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
        <RecruiterSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          candidateCount={workspace.candidates.length}
          pipelineCount={workspace.pipeline.length}
          upcomingInterviewCount={upcomingInterviewCount}
          scorecardCount={workspace.scorecards.length}
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />

        {/* Tab Content Canvas */}
        <main style={{ flex: 1, padding: '1.5rem', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
          {activeTab === 'overview' && (
            <OverviewTab
              state={workspace}
              onTabChange={setActiveTab}
            />
          )}

          {activeTab === 'talent-search' && (
            <TalentSearchTab
              candidates={workspace.candidates}
              pipeline={workspace.pipeline}
              availableRoles={availableRoles}
              onToggleSaveCandidate={handleToggleSaveCandidate}
              onAddToPipeline={handleAddToPipeline}
            />
          )}

          {activeTab === 'pipeline' && (
            <PipelineTab
              pipeline={workspace.pipeline}
              candidates={workspace.candidates}
              availableRoles={availableRoles}
              onUpdateStage={handleUpdateStage}
              onUpdateDetails={handleUpdatePipelineDetails}
              onRemoveFromPipeline={handleRemoveFromPipeline}
              onAddToPipeline={handleAddToPipeline}
              onToggleSaveCandidate={handleToggleSaveCandidate}
            />
          )}

          {activeTab === 'interviews' && (
            <InterviewsTab
              interviews={workspace.interviews}
              candidates={workspace.candidates}
              availableRoles={availableRoles}
              onScheduleInterview={handleScheduleInterview}
              onUpdateInterview={handleUpdateInterview}
              onCancelInterview={handleCancelInterview}
              onTabChange={setActiveTab}
              onLaunchAIArena={onLaunchAIArena}
            />
          )}

          {activeTab === 'scorecards' && (
            <ScorecardsTab
              scorecards={workspace.scorecards}
              candidates={workspace.candidates}
              availableRoles={availableRoles}
              onCreateScorecard={handleCreateScorecard}
              onUpdateScorecard={handleUpdateScorecard}
              onDeleteScorecard={handleDeleteScorecard}
            />
          )}

          {activeTab === 'company' && (
            <CompanyTab
              company={workspace.company}
              onSaveCompany={handleSaveCompany}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsTab
              settings={workspace.settings}
              recruiter={workspace.recruiter}
              availableRoles={availableRoles}
              onSaveSettings={handleSaveSettings}
              onResetDemoData={handleResetDemoData}
              onExitToHome={onExitToHome}
            />
          )}
        </main>
      </div>
    </div>
  );
};
