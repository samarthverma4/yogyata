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
import { PostingsTab } from './ours/PostingsTab';
import { InvitationsPanel } from './ours/TalentInvites';
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
import * as data from '../lib/recruiterData';

interface RecruiterWorkspaceProps {
  userId: string;
  onSignOut: () => void;
}

/** Recruiter workspace (screens from upstream), backed by Supabase. */
export const RecruiterWorkspace: React.FC<RecruiterWorkspaceProps> = ({ userId, onSignOut }) => {
  const onExitToHome = onSignOut;
  const [workspace, setWorkspace] = useState<RecruiterWorkspaceState | null>(null);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [activeTab, setActiveTab] = useState<RecruiterWorkspaceTab>('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const reload = useCallback(async () => {
    try {
      setWorkspace(await data.loadRecruiterWorkspace(userId));
      setLoadError('');
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load your workspace.');
    }
  }, [userId]);

  useEffect(() => {
    let live = true;
    data
      .loadRecruiterWorkspace(userId)
      .then((w) => live && setWorkspace(w))
      .catch((e: unknown) => live && setLoadError(e instanceof Error ? e.message : 'Could not load your workspace.'));
    return () => {
      live = false;
    };
  }, [userId]);

  // every action writes to Supabase, then reloads so the screens show what was saved
  const run = useCallback(
    (action: Promise<{ error?: string }>) => {
      void action.then(async (res) => {
        setSaveError(res.error ?? '');
        await reload();
      });
    },
    [reload],
  );

  const handleToggleSaveCandidate = useCallback(
    (candidateId: string) => {
      data.toggleSavedCandidate(candidateId);
      void reload();
    },
    [reload],
  );
  const handleAddToPipeline = useCallback(
    (candidateId: string, role: string, stage: PipelineStage) => {
      const c = workspace?.candidates.find((x) => x.id === candidateId);
      run(data.addToPipeline(candidateId, role, stage, c?.verifiedSkills ?? []));
    },
    [run, workspace],
  );
  const handleUpdateStage = useCallback((id: string, stage: PipelineStage) => run(data.updatePipeline(id, { stage })), [run]);
  const handleUpdatePipelineDetails = useCallback(
    (id: string, d: { recruiterNotes?: string; nextAction?: string; priority?: PipelinePriority; tags?: string[] }) =>
      run(data.updatePipeline(id, d)),
    [run],
  );
  const handleRemoveFromPipeline = useCallback((id: string) => run(data.removeFromPipeline(id)), [run]);
  const handleScheduleInterview = useCallback((i: Omit<Interview, 'id'>) => run(data.scheduleInterview(i)), [run]);
  const handleUpdateInterview = useCallback((id: string, u: Partial<Interview>) => run(data.updateInterview(id, u)), [run]);
  const handleCancelInterview = useCallback(
    (id: string, reason: string) => run(data.updateInterview(id, { status: 'cancelled', cancellationReason: reason })),
    [run],
  );
  const handleCreateScorecard = useCallback((s: Omit<Scorecard, 'id' | 'submittedAt'>) => run(data.createScorecard(s)), [run]);
  const handleUpdateScorecard = useCallback((id: string, u: Partial<Scorecard>) => run(data.updateScorecard(id, u)), [run]);
  const handleDeleteScorecard = useCallback((id: string) => run(data.deleteScorecard(id)), [run]);
  const handleSaveCompany = useCallback((c: CompanyProfile) => run(data.saveCompany(userId, c)), [run, userId]);
  const handleSaveSettings = useCallback((s: RecruiterSettings) => run(data.saveSettings(userId, s)), [run, userId]);

  if (!workspace) {
    return loadError ? (
      <p className="yg-sync-error" role="alert">
        {loadError}{' '}
        <button type="button" className="ob-inline-link-btn" onClick={reload}>
          Try again
        </button>
      </p>
    ) : (
      <p className="yg-loading">Loading your workspace…</p>
    );
  }

  // Available roles for hiring filters and target openings
  const availableRoles =
    workspace.hiring.rolesCommonlyHired.length > 0
      ? workspace.hiring.rolesCommonlyHired
      : ['Frontend Engineer', 'Backend Engineer', 'Full-Stack Developer'];

  const upcomingInterviewCount = workspace.interviews.filter((i) => i.status === 'scheduled').length;

  return (
    <div className="recruiter-workspace-root" style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <RecruiterHeader
        recruiter={workspace.recruiter}
        company={workspace.company}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onExitToHome={onExitToHome}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />

      {saveError && (
        <p className="yg-sync-error" role="alert">
          That change was not saved: {saveError}
        </p>
      )}

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

          {activeTab === 'postings' && <PostingsTab userId={userId} onChanged={reload} />}

          {activeTab === 'invitations' && <InvitationsPanel userId={userId} />}

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
                            onExitToHome={onExitToHome}
            />
          )}
        </main>
      </div>
    </div>
  );
};
