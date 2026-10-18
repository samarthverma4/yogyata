import React from 'react';
import type { FounderWorkspaceState, WorkspaceTab } from '../types';
import {
  Briefcase,
  FileCode2,
  Users,
  Inbox,
  CheckCircle2,
  ArrowRight,
  Plus,
  Compass,
  Edit3,
  Building,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

interface OverviewTabProps {
  workspace: FounderWorkspaceState;
  onNavigateTab: (tab: WorkspaceTab) => void;
  onNewProject: () => void;
  onNewTask: () => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  workspace,
  onNavigateTab,
  onNewProject,
  onNewTask,
}) => {
  const { founder, startup, projects, tasks, submissions, talentRequirements } = workspace;

  const founderName = founder.fullName || 'Founder';
  const firstName = founderName.trim().split(' ')[0] || 'Founder';

  const pendingSubmissions = submissions.filter(
    (s) => s.status === 'submitted' || s.status === 'under-review'
  );
  const publishedTasks = tasks.filter((t) => t.status === 'published');
  const activeProjects = projects.filter((p) => p.status === 'active');

  // Calculate profile completeness checklist
  const checklistItems = [
    { label: 'Startup Profile & Description', done: Boolean(startup.startupName && startup.description) },
    { label: 'Company Logo Uploaded', done: Boolean(startup.logoUrl) },
    { label: 'Business Goals Defined', done: Boolean(workspace.goals.primaryGoal) },
    { label: 'Talent Requirements Specified', done: talentRequirements.length > 0 },
    { label: 'Practical Challenge Published', done: publishedTasks.length > 0 },
  ];
  const completedChecklistCount = checklistItems.filter((i) => i.done).length;
  const completionPercentage = Math.round((completedChecklistCount / checklistItems.length) * 100);

  return (
    <div className="ws-overview-layout">
      {/* ── Welcome Banner ── */}
      <div className="ws-card ws-welcome-card" style={{ background: 'linear-gradient(135deg, #FAFBFD 0%, var(--color-blue-tint) 100%)', borderColor: '#E0E7FF' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
            <div className="ws-startup-logo-avatar" style={{ width: 56, height: 56, fontSize: '1.4rem' }}>
              {startup.logoUrl ? (
                <img src={startup.logoUrl} alt={startup.startupName} className="ws-startup-logo-img" />
              ) : (
                <Building size={26} />
              )}
            </div>
            <div>
              <span className="ob-dev-badge" style={{ background: 'var(--color-blue)', marginBottom: '6px' }}>
                FOUNDER WORKSPACE
              </span>
              <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--color-navy)', letterSpacing: '-0.02em', marginTop: '2px' }}>
                Welcome back, {firstName}.
              </h2>
              <p style={{ fontSize: '0.88rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                {startup.startupName || 'Your Venture'} · {startup.industry || 'Tech'} · {startup.stage || 'Venture Stage'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="ob-btn-secondary"
              onClick={() => onNavigateTab('startup')}
              id="overview-quick-edit-startup-btn"
              style={{ fontSize: '0.84rem', padding: '8px 14px' }}
            >
              <Edit3 size={15} aria-hidden="true" />
              <span>Edit Startup</span>
            </button>
            <button
              type="button"
              className="ob-btn-primary"
              onClick={onNewTask}
              id="overview-quick-create-task-btn"
              style={{ fontSize: '0.84rem', padding: '8px 16px' }}
            >
              <Sparkles size={15} aria-hidden="true" />
              <span>Create Challenge</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Metric Stats Cards Grid ── */}
      <div className="ws-stats-grid">
        <div
          className="ws-stat-card"
          onClick={() => onNavigateTab('projects')}
          style={{ cursor: 'pointer' }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onNavigateTab('projects')}
          aria-label="View Projects"
        >
          <div>
            <div className="ws-stat-label">Active Projects</div>
            <div className="ws-stat-num">{activeProjects.length}</div>
            <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>{projects.length} total projects</span>
          </div>
          <div className="ws-stat-icon-wrap icon-blue">
            <Briefcase size={20} />
          </div>
        </div>

        <div
          className="ws-stat-card"
          onClick={() => onNavigateTab('tasks')}
          style={{ cursor: 'pointer' }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onNavigateTab('tasks')}
          aria-label="View Tasks"
        >
          <div>
            <div className="ws-stat-label">Published Tasks</div>
            <div className="ws-stat-num">{publishedTasks.length}</div>
            <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>{tasks.length} challenges total</span>
          </div>
          <div className="ws-stat-icon-wrap icon-emerald">
            <FileCode2 size={20} />
          </div>
        </div>

        <div
          className="ws-stat-card"
          onClick={() => onNavigateTab('startup')}
          style={{ cursor: 'pointer' }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onNavigateTab('startup')}
          aria-label="View Talent Requirements"
        >
          <div>
            <div className="ws-stat-label">Open Talent Slots</div>
            <div className="ws-stat-num">{talentRequirements.length}</div>
            <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>Configured requirements</span>
          </div>
          <div className="ws-stat-icon-wrap icon-purple">
            <Users size={20} />
          </div>
        </div>

        <div
          className="ws-stat-card"
          onClick={() => onNavigateTab('submissions')}
          style={{ cursor: 'pointer' }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onNavigateTab('submissions')}
          aria-label="View Submissions"
        >
          <div>
            <div className="ws-stat-label">Pending Reviews</div>
            <div className="ws-stat-num">{pendingSubmissions.length}</div>
            <span style={{ fontSize: '0.74rem', color: pendingSubmissions.length > 0 ? '#B45309' : 'var(--color-text-muted)' }}>
              {pendingSubmissions.length > 0 ? 'Requires attention' : 'All reviews clear'}
            </span>
          </div>
          <div className="ws-stat-icon-wrap icon-amber">
            <Inbox size={20} />
          </div>
        </div>
      </div>

      {/* ── Two-Column Operational Layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1.2fr)', gap: '20px' }}>
        {/* Left Column: Active Tasks & Projects */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Active Tasks Widget */}
          <div className="ws-card">
            <div className="ws-card-header">
              <div>
                <h3 className="ws-card-title">Tasks & Proof Challenges</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  Live challenges available for candidates to prove their capabilities.
                </p>
              </div>
              <button
                type="button"
                className="ob-inline-link-btn"
                onClick={() => onNavigateTab('tasks')}
                style={{ fontSize: '0.82rem', fontWeight: 700 }}
              >
                View all →
              </button>
            </div>

            {tasks.length === 0 ? (
              <div className="ws-empty-state">
                <div className="ws-empty-icon">
                  <FileCode2 size={24} />
                </div>
                <h4 className="ws-empty-title">No practical tasks created yet</h4>
                <p className="ws-empty-desc">
                  Tasks help candidates build evidenced Skill Passports while solving real technical challenges for your startup.
                </p>
                <button type="button" className="ob-btn-primary" onClick={onNewTask}>
                  <Plus size={16} />
                  <span>Create First Task</span>
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {tasks.slice(0, 3).map((task) => (
                  <div
                    key={task.id}
                    className="founder-req-card"
                    style={{ cursor: 'pointer' }}
                    onClick={() => onNavigateTab('tasks')}
                  >
                    <div className="founder-req-header">
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className={`ws-badge badge-${task.status}`}>{task.status}</span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                            {task.compensationType === 'paid' ? 'Paid Challenge' : 'Practical Proof'}
                          </span>
                        </div>
                        <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--color-navy)', marginTop: '6px' }}>
                          {task.title}
                        </h4>
                      </div>
                      <ArrowRight size={16} style={{ color: 'var(--color-text-faint)' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
                      {task.requiredSkills.slice(0, 4).map((skill) => (
                        <span key={skill} className="ob-review-tag" style={{ fontSize: '0.75rem' }}>
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Submissions Widget */}
          <div className="ws-card">
            <div className="ws-card-header">
              <div>
                <h3 className="ws-card-title">Recent Submissions for Review</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  Evaluate contributor deliverables and endorse Skill Passports.
                </p>
              </div>
              <button
                type="button"
                className="ob-inline-link-btn"
                onClick={() => onNavigateTab('submissions')}
                style={{ fontSize: '0.82rem', fontWeight: 700 }}
              >
                Inspect reviews →
              </button>
            </div>

            {submissions.length === 0 ? (
              <p style={{ fontSize: '0.88rem', color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '16px 0' }}>
                No candidate submissions have arrived yet. When contributors complete tasks, their deliverables will appear here.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {submissions.slice(0, 2).map((sub) => (
                  <div
                    key={sub.id}
                    className="founder-req-card"
                    style={{ cursor: 'pointer', background: '#FAFBFD' }}
                    onClick={() => onNavigateTab('submissions')}
                  >
                    <div className="founder-req-header">
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className={`ws-badge badge-${sub.status}`}>{sub.status.replace('-', ' ')}</span>
                          {sub.isDemoRecord && (
                            <span className="ob-dev-badge" style={{ background: 'var(--color-text-muted)', fontSize: '0.65rem' }}>
                              DEMO RECORD
                            </span>
                          )}
                        </div>
                        <h4 style={{ fontSize: '0.94rem', fontWeight: 700, color: 'var(--color-navy)', marginTop: '4px' }}>
                          {sub.candidateName} — {sub.taskTitle}
                        </h4>
                        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                          Submitted: {new Date(sub.submittedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="founder-next-card-action" style={{ fontSize: '0.78rem' }}>
                        Review →
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Profile Completeness & Quick Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Completeness Card */}
          <div className="ws-card">
            <h3 className="ws-card-title">Venture Readiness</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginTop: '2px', marginBottom: '14px' }}>
              Ensure your venture setup is primed for high-intent matching.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--color-navy)' }}>Setup Completion</span>
              <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--color-blue)' }}>{completionPercentage}%</span>
            </div>

            <div style={{ height: 6, background: 'var(--color-border)', borderRadius: 3, overflow: 'hidden', marginBottom: '18px' }}>
              <div
                style={{
                  height: '100%',
                  width: `${completionPercentage}%`,
                  background: completionPercentage === 100 ? '#10B981' : 'var(--color-blue)',
                  transition: 'width 300ms ease',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {checklistItems.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.84rem' }}>
                  {item.done ? (
                    <CheckCircle2 size={16} style={{ color: '#10B981', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 16, height: 16, borderRadius: '50%', border: '1.5px solid var(--color-border-hover)', flexShrink: 0 }} />
                  )}
                  <span style={{ color: item.done ? 'var(--color-navy)' : 'var(--color-text-muted)', fontWeight: item.done ? 600 : 400 }}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions Shortcuts */}
          <div className="ws-card">
            <h3 className="ws-card-title" style={{ marginBottom: '12px' }}>Operational Shortcuts</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                className="ob-btn-secondary"
                onClick={onNewProject}
                style={{ justifyContent: 'flex-start', padding: '9px 14px', fontSize: '0.86rem' }}
                id="overview-shortcut-create-project"
              >
                <Plus size={16} />
                <span>Create New Project</span>
              </button>
              <button
                type="button"
                className="ob-btn-secondary"
                onClick={onNewTask}
                style={{ justifyContent: 'flex-start', padding: '9px 14px', fontSize: '0.86rem' }}
                id="overview-shortcut-create-task"
              >
                <FileCode2 size={16} />
                <span>Draft Proof Challenge</span>
              </button>
              <button
                type="button"
                className="ob-btn-secondary"
                onClick={() => onNavigateTab('talent')}
                style={{ justifyContent: 'flex-start', padding: '9px 14px', fontSize: '0.86rem' }}
                id="overview-shortcut-discover-talent"
              >
                <Compass size={16} />
                <span>Search Evidenced Talent</span>
              </button>
              <button
                type="button"
                className="ob-btn-secondary"
                onClick={() => onNavigateTab('submissions')}
                style={{ justifyContent: 'flex-start', padding: '9px 14px', fontSize: '0.86rem' }}
                id="overview-shortcut-submissions"
              >
                <Inbox size={16} />
                <span>Evaluate Submissions ({pendingSubmissions.length})</span>
              </button>
            </div>
          </div>

          {/* Startup Summary Box */}
          <div className="ws-card" style={{ background: 'var(--color-bg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span className="ob-review-label">About Venture</span>
              {startup.websiteUrl && (
                <a
                  href={startup.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: 'var(--color-blue)', fontWeight: 600 }}
                >
                  <span>Website</span>
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
            <p style={{ fontSize: '0.86rem', color: 'var(--color-text)', lineHeight: 1.5 }}>
              {startup.description || 'No description provided yet. Complete your venture profile to attract talent.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
