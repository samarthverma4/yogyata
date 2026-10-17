import React, { useState, useEffect, useCallback } from 'react';
import type { MentorWorkspaceTab, MentorWorkspaceState } from './types';
import { saveMentorWorkspace } from './storage';
import { MentorSidebar } from './MentorSidebar';
import { MentorHeader } from './MentorHeader';

// Tabs
import { OverviewTab } from './tabs/OverviewTab';
import { RequestsTab } from './tabs/RequestsTab';
import { MenteesTab } from './tabs/MenteesTab';
import { SessionsTab } from './tabs/SessionsTab';
import { FeedbackTab } from './tabs/FeedbackTab';
import { ProfileTab } from './tabs/ProfileTab';
import { SettingsTab } from './tabs/SettingsTab';

interface MentorWorkspaceProps {
  initialWorkspace: MentorWorkspaceState;
  onExitToHome: () => void;
}

export const MentorWorkspace: React.FC<MentorWorkspaceProps> = ({
  initialWorkspace,
  onExitToHome,
}) => {
  const [workspace, setWorkspace] = useState<MentorWorkspaceState>(initialWorkspace);
  const [currentTab, setCurrentTab] = useState<MentorWorkspaceTab>('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Pre-selection states for cross-tab jumps
  const [preselectedMenteeId, setPreselectedMenteeId] = useState<string | null>(null);
  const [preselectedSessionId, setPreselectedSessionId] = useState<string | null>(null);

  // Sync workspace updates to localStorage
  const handleUpdateWorkspace = useCallback(
    (updater: (prev: MentorWorkspaceState) => MentorWorkspaceState) => {
      setWorkspace((prev) => {
        const next = updater(prev);
        saveMentorWorkspace(next);
        return next;
      });
    },
    []
  );

  // Keep hash aligned if user refreshes or bookmarks
  useEffect(() => {
    if (window.location.hash !== '#mentor-workspace') {
      window.location.hash = '#mentor-workspace';
    }
  }, []);

  // Handlers for cross-tab transitions
  const handleNavigateToSessions = (menteeId?: string) => {
    if (menteeId) setPreselectedMenteeId(menteeId);
    setCurrentTab('sessions');
  };

  const handleNavigateToFeedback = (menteeId?: string, sessionId?: string) => {
    if (menteeId) setPreselectedMenteeId(menteeId);
    if (sessionId) setPreselectedSessionId(sessionId);
    setCurrentTab('feedback');
  };

  return (
    <div
      className="mentor-workspace-root"
      style={{
        display: 'flex',
        minHeight: '100vh',
        width: '100%',
        background: '#F8FAFC',
        color: '#1B2A4E',
        fontFamily:
          "var(--font-family, 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
        position: 'relative',
      }}
    >
      {/* Sidebar */}
      <MentorSidebar
        currentTab={currentTab}
        onTabChange={(tab) => {
          setCurrentTab(tab);
          setPreselectedMenteeId(null);
          setPreselectedSessionId(null);
        }}
        workspace={workspace}
        isOpenOnMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        onExitToHome={onExitToHome}
      />

      {/* Main Content Area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          background: '#F8FAFC',
          height: '100vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <MentorHeader
          currentTab={currentTab}
          workspace={workspace}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onExitToHome={onExitToHome}
        />

        {/* Tab View Router */}
        <main style={{ flex: 1, paddingBottom: '40px' }}>
          {currentTab === 'overview' && (
            <OverviewTab
              workspace={workspace}
              onNavigateTab={(tab: MentorWorkspaceTab) => {
                setCurrentTab(tab);
              }}
              onOpenScheduleModal={() => {
                setCurrentTab('sessions');
              }}
            />
          )}

          {currentTab === 'requests' && (
            <RequestsTab
              workspace={workspace}
              onUpdateWorkspace={handleUpdateWorkspace}
              onNavigateToTab={(tab) => {
                setCurrentTab(tab);
              }}
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

          {currentTab === 'profile' && (
            <ProfileTab
              workspace={workspace}
              onUpdateWorkspace={handleUpdateWorkspace}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsTab
              workspace={workspace}
              onUpdateWorkspace={handleUpdateWorkspace}
              onExitToHome={onExitToHome}
            />
          )}
        </main>
      </div>
    </div>
  );
};
