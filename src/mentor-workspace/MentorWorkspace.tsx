import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { MentorWorkspaceTab, MentorWorkspaceState } from './types';
import { MentorSidebar } from './MentorSidebar';
import { MentorHeader } from './MentorHeader';
import { loadMentorWorkspace, syncMentorWorkspace } from '../lib/mentorData';
import { SkillReviewPanel } from './ours/SkillReviewQueue';

// Tabs
import { OverviewTab } from './tabs/OverviewTab';
import { RequestsTab } from './tabs/RequestsTab';
import { MenteesTab } from './tabs/MenteesTab';
import { SessionsTab } from './tabs/SessionsTab';
import { FeedbackTab } from './tabs/FeedbackTab';
import { ProfileTab } from './tabs/ProfileTab';
import { SettingsTab } from './tabs/SettingsTab';

interface MentorWorkspaceProps {
  userId: string;
  email: string;
  onSignOut: () => void;
}

/** Mentor workspace (screens from upstream), backed by Supabase. */
export const MentorWorkspace: React.FC<MentorWorkspaceProps> = ({ userId, email, onSignOut }) => {
  const [workspace, setWorkspace] = useState<MentorWorkspaceState | null>(null);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [currentTab, setCurrentTab] = useState<MentorWorkspaceTab>('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [skillReviewCount, setSkillReviewCount] = useState(0);

  // Pre-selection states for cross-tab jumps
  const [preselectedMenteeId, setPreselectedMenteeId] = useState<string | null>(null);
  const [preselectedSessionId, setPreselectedSessionId] = useState<string | null>(null);

  // the latest state, so overlapping saves always diff against what is on screen
  const current = useRef<MentorWorkspaceState | null>(null);
  useEffect(() => {
    current.current = workspace;
  }, [workspace]);

  const reload = useCallback(async () => {
    try {
      setWorkspace(await loadMentorWorkspace(userId, email));
      setLoadError('');
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load your workspace.');
    }
  }, [userId, email]);

  useEffect(() => {
    let live = true;
    loadMentorWorkspace(userId, email)
      .then((w) => live && setWorkspace(w))
      .catch((e: unknown) => live && setLoadError(e instanceof Error ? e.message : 'Could not load your workspace.'));
    return () => {
      live = false;
    };
  }, [userId, email]);

  // The screens describe a change as "previous state → next state". Show it at once,
  // write the difference to Supabase, then reload so ids and derived fields are real.
  const handleUpdateWorkspace = useCallback(
    (updater: (prev: MentorWorkspaceState) => MentorWorkspaceState) => {
      const prev = current.current;
      if (!prev) return;
      const next = updater(prev);
      current.current = next;
      setWorkspace(next);
      void syncMentorWorkspace(userId, prev, next).then(async (res) => {
        setSaveError(res.error ?? '');
        await reload();
      });
    },
    [userId, reload],
  );

  const handleNavigateToSessions = (menteeId?: string) => {
    if (menteeId) setPreselectedMenteeId(menteeId);
    setCurrentTab('sessions');
  };

  const handleNavigateToFeedback = (menteeId?: string, sessionId?: string) => {
    if (menteeId) setPreselectedMenteeId(menteeId);
    if (sessionId) setPreselectedSessionId(sessionId);
    setCurrentTab('feedback');
  };

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

  return (
    <div className="mentor-workspace-root yg-role-workspace">
      <MentorSidebar
        currentTab={currentTab}
        onTabChange={(tab) => {
          setCurrentTab(tab);
          setPreselectedMenteeId(null);
          setPreselectedSessionId(null);
          setIsMobileMenuOpen(false);
        }}
        workspace={workspace}
        isOpenOnMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        onExitToHome={onSignOut}
        skillReviewCount={skillReviewCount}
      />

      <div className="yg-role-main">
        <MentorHeader
          currentTab={currentTab}
          workspace={workspace}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onExitToHome={onSignOut}
        />

        {saveError && (
          <p className="yg-sync-error" role="alert">
            That change was not saved: {saveError}
          </p>
        )}

        <main style={{ flex: 1, paddingBottom: '40px' }}>
          {currentTab === 'overview' && (
            <OverviewTab
              workspace={workspace}
              onNavigateTab={(tab: MentorWorkspaceTab) => setCurrentTab(tab)}
              onOpenScheduleModal={() => setCurrentTab('sessions')}
            />
          )}

          {currentTab === 'requests' && (
            <RequestsTab
              workspace={workspace}
              onUpdateWorkspace={handleUpdateWorkspace}
              onNavigateToTab={(tab) => setCurrentTab(tab)}
            />
          )}

          {currentTab === 'mentees' && (
            <MenteesTab
              workspace={workspace}
              onUpdateWorkspace={handleUpdateWorkspace}
              onNavigateToSessionsWithMentee={handleNavigateToSessions}
              onNavigateToFeedbackWithMentee={handleNavigateToFeedback}
            />
          )}

          {currentTab === 'sessions' && (
            <SessionsTab
              workspace={workspace}
              onUpdateWorkspace={handleUpdateWorkspace}
              onNavigateToFeedback={handleNavigateToFeedback}
              preselectedMenteeId={preselectedMenteeId}
            />
          )}

          {currentTab === 'feedback' && (
            <FeedbackTab
              workspace={workspace}
              onUpdateWorkspace={handleUpdateWorkspace}
              preselectedMenteeId={preselectedMenteeId}
              preselectedSessionId={preselectedSessionId}
            />
          )}

          {/* kept mounted so the sidebar badge stays current */}
          <div hidden={currentTab !== 'skill-reviews'}>
            <SkillReviewPanel userId={userId} onCountChange={setSkillReviewCount} />
          </div>

          {currentTab === 'profile' && <ProfileTab workspace={workspace} onUpdateWorkspace={handleUpdateWorkspace} />}

          {currentTab === 'settings' && (
            <SettingsTab workspace={workspace} onUpdateWorkspace={handleUpdateWorkspace} onExitToHome={onSignOut} />
          )}
        </main>
      </div>
    </div>
  );
};
