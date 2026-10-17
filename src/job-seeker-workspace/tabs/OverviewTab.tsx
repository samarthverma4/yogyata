import React from 'react';
import {
  Compass,
  Award,
  CheckCircle2,
  FileCode2,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  Briefcase,
  Target,
  Sparkles,
} from 'lucide-react';
import type { JobSeekerWorkspaceState, JobSeekerWorkspaceTab } from '../types';

interface OverviewTabProps {
  state: JobSeekerWorkspaceState;
  onTabChange: (tab: JobSeekerWorkspaceTab) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  state,
  onTabChange,
}) => {
  const { profile, skills, roadmap, assessmentAttempts, applications } = state;

  const declaredCount = skills.filter((s) => s.tier === 'declared').length;
  const assessedCount = skills.filter((s) => s.tier === 'assessed').length;
  const verifiedCount = skills.filter((s) => s.tier === 'verified').length;

  const completedRoadmapCount = roadmap.filter((r) => r.completed).length;
  const totalRoadmapCount = roadmap.length;
  const roadmapPercent = totalRoadmapCount > 0 ? Math.round((completedRoadmapCount / totalRoadmapCount) * 100) : 0;
  const activeApplicationsCount = applications.filter((a) => a.status !== 'withdrawn' && a.status !== 'rejected').length;

  // Profile completion calculation based on actual fields
  const completionItems = [
    { label: 'Full Name & Email', isComplete: Boolean(profile.fullName && profile.email) },
    { label: 'Headline & Bio', isComplete: Boolean(profile.headline && profile.bio) },
    { label: 'Education Details', isComplete: Boolean(profile.education.degree && profile.education.institution) },
    { label: 'Target Career Roles', isComplete: Boolean(profile.careerGoals.primaryRole) },
    { label: 'Job Preferences', isComplete: profile.jobPrefs.opportunityTypes.length > 0 },
    { label: 'Declared Skills', isComplete: skills.length > 0 },
    { label: 'Resume Uploaded', isComplete: Boolean(profile.resumeFile) },
  ];

  const completedSections = completionItems.filter((i) => i.isComplete).length;
  const profileCompletionPercent = Math.round((completedSections / completionItems.length) * 100);
  const incompleteSections = completionItems.filter((i) => !i.isComplete);

  const firstName = profile.fullName.trim().split(' ')[0] || 'Candidate';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* ── Welcome Banner ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #171B4D 0%, #2A3B7E 100%)',
          borderRadius: '12px',
          padding: '1.75rem 2rem',
          color: '#FFFFFF',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.25rem',
          boxShadow: '0 4px 20px -2px rgba(23, 27, 77, 0.15)',
        }}
      >
        <div style={{ maxWidth: '640px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255, 255, 255, 0.12)', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            <Sparkles size={12} style={{ color: '#FFC936' }} />
            Candidate Career Hub
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0 0 0.35rem', letterSpacing: '-0.02em' }}>
            Welcome back, {firstName}!
          </h1>
          <p style={{ fontSize: '0.9375rem', color: '#CBD5E1', margin: 0, lineHeight: 1.5 }}>
            {profile.headline || 'Build proven engineering skills and stand out with verified evidence.'}
          </p>
        </div>

        <button
          type="button"
          className="jsw-btn"
          style={{
            background: '#FFC936',
            color: '#171B4D',
            fontWeight: 700,
            padding: '0.75rem 1.25rem',
            borderRadius: '8px',
          }}
          onClick={() => onTabChange('assessments')}
          id="btn-overview-take-assessment"
        >
          <span>Take Skill Diagnostic</span>
          <ArrowRight size={16} />
        </button>
      </div>

      {/* ── Stat Metric Cards ── */}
      <div className="jsw-stats-grid">
        <div className="jsw-stat-card">
          <div className="jsw-stat-icon-wrap" style={{ background: '#ECFDF5', color: '#059669' }}>
            <FileCode2 size={24} />
          </div>
          <div>
            <div className="jsw-stat-value" id="metric-verified-skills">{verifiedCount}</div>
            <div className="jsw-stat-label">Verified Skills</div>
          </div>
        </div>

        <div className="jsw-stat-card">
          <div className="jsw-stat-icon-wrap" style={{ background: '#EEF2FF', color: '#4F46E5' }}>
            <Award size={24} />
          </div>
          <div>
            <div className="jsw-stat-value" id="metric-assessed-skills">{assessedCount}</div>
            <div className="jsw-stat-label">Assessed Skills</div>
          </div>
        </div>

        <div className="jsw-stat-card">
          <div className="jsw-stat-icon-wrap" style={{ background: '#F1F5F9', color: '#475569' }}>
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div className="jsw-stat-value" id="metric-declared-skills">{declaredCount}</div>
            <div className="jsw-stat-label">Declared Skills</div>
          </div>
        </div>

        <div className="jsw-stat-card">
          <div className="jsw-stat-icon-wrap" style={{ background: '#FEF3C7', color: '#D97706' }}>
            <Briefcase size={24} />
          </div>
          <div>
            <div className="jsw-stat-value" id="metric-active-apps">{activeApplicationsCount}</div>
            <div className="jsw-stat-label">Active Applications</div>
          </div>
        </div>
      </div>

      {/* ── Profile Completion & Roadmap Progress Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
        {/* Profile Completion Card */}
        <div className="jsw-card">
          <div className="jsw-card-header">
            <h2 className="jsw-card-title">
              <Compass size={18} style={{ color: '#2563EB' }} />
              Profile Readiness
            </h2>
            <span style={{ fontSize: '1rem', fontWeight: 800, color: profileCompletionPercent === 100 ? '#059669' : '#171B4D' }}>
              {profileCompletionPercent}%
            </span>
          </div>

          {/* Progress Bar */}
          <div style={{ width: '100%', height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden', marginBottom: '1.25rem' }}>
            <div
              style={{
                width: `${profileCompletionPercent}%`,
                height: '100%',
                background: profileCompletionPercent === 100 ? '#059669' : '#2563EB',
                transition: 'width 0.3s ease',
              }}
            />
          </div>

          {incompleteSections.length > 0 ? (
            <div>
              <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: '0 0 0.75rem' }}>
                Complete these sections to enhance candidate discoverability for hiring partners:
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {incompleteSections.slice(0, 3).map((sec) => (
                  <li key={sec.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: '#DC2626' }}>
                    <AlertCircle size={14} />
                    <span>Missing: {sec.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p style={{ fontSize: '0.8125rem', color: '#059669', fontWeight: 600, margin: '0 0 1rem' }}>
              ✓ All essential candidate profile sections are complete!
            </p>
          )}

          <button
            type="button"
            className="jsw-btn jsw-btn-secondary jsw-btn-sm"
            style={{ width: '100%' }}
            onClick={() => onTabChange('profile')}
            id="btn-overview-edit-profile"
          >
            Edit Profile Sections →
          </button>
        </div>

        {/* Career Roadmap Progress Card */}
        <div className="jsw-card">
          <div className="jsw-card-header">
            <h2 className="jsw-card-title">
              <Target size={18} style={{ color: '#D97706' }} />
              Roadmap Milestones
            </h2>
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#475569' }}>
              {completedRoadmapCount} of {totalRoadmapCount} Done ({roadmapPercent}%)
            </span>
          </div>

          <div style={{ width: '100%', height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden', marginBottom: '1.25rem' }}>
            <div
              style={{
                width: `${roadmapPercent}%`,
                height: '100%',
                background: '#D97706',
                transition: 'width 0.3s ease',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '1.25rem' }}>
            {roadmap.slice(0, 3).map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.625rem',
                  fontSize: '0.8125rem',
                  color: item.completed ? '#059669' : '#334155',
                }}
              >
                <CheckCircle2
                  size={16}
                  style={{
                    color: item.completed ? '#059669' : '#CBD5E1',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                />
                <span style={{ textDecoration: item.completed ? 'line-through' : 'none' }}>
                  {item.title}
                </span>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="jsw-btn jsw-btn-secondary jsw-btn-sm"
            style={{ width: '100%' }}
            onClick={() => onTabChange('career-roadmap')}
            id="btn-overview-view-roadmap"
          >
            View Career Roadmap →
          </button>
        </div>
      </div>

      {/* ── Skill Passport Highlights & Assessment History ── */}
      <div className="jsw-card">
        <div className="jsw-card-header">
          <h2 className="jsw-card-title">
            <Award size={18} style={{ color: '#059669' }} />
            Skill Evidence Highlights
          </h2>
          <button
            type="button"
            className="jsw-btn jsw-btn-secondary jsw-btn-sm"
            onClick={() => onTabChange('skill-passport')}
          >
            View Full Passport →
          </button>
        </div>

        {skills.length === 0 ? (
          <p style={{ color: '#64748B', fontSize: '0.875rem' }}>No skills declared yet.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {skills.slice(0, 3).map((skill) => (
              <div
                key={skill.id}
                style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '10px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '0.9375rem', color: '#0F172A' }}>{skill.name}</strong>
                  <span className={`tier-pill tier-pill-${skill.tier}`}>{skill.tier}</span>
                </div>
                <p style={{ fontSize: '0.78rem', color: '#64748B', margin: 0, lineHeight: 1.4 }}>
                  {skill.description || 'Self-declared candidate capability.'}
                </p>
                {skill.scoreOrOutcome && (
                  <div style={{ fontSize: '0.75rem', color: '#4338CA', fontWeight: 600 }}>
                    Score: {skill.scoreOrOutcome}
                  </div>
                )}
                {skill.verifiedBy && (
                  <div style={{ fontSize: '0.72rem', color: '#047857', fontWeight: 600 }}>
                    ✓ {skill.verifiedBy}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Recent Activity Feed ── */}
      <div className="jsw-card">
        <div className="jsw-card-header">
          <h2 className="jsw-card-title">
            <TrendingUp size={18} style={{ color: '#2563EB' }} />
            Recent Candidate Activity
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {assessmentAttempts.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: '#F8FAFC', borderRadius: '8px', fontSize: '0.8125rem' }}>
              <div>
                <strong>Completed Assessment:</strong> {assessmentAttempts[0].assessmentTitle}
                <div style={{ color: '#64748B', fontSize: '0.75rem' }}>
                  Scored {assessmentAttempts[0].scorePercent}% on {assessmentAttempts[0].date}
                </div>
              </div>
              <span className="tier-pill tier-pill-assessed">Assessed</span>
            </div>
          )}

          {applications.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: '#F8FAFC', borderRadius: '8px', fontSize: '0.8125rem' }}>
              <div>
                <strong>Submitted Application:</strong> {applications[0].opportunityTitle} ({applications[0].organization})
                <div style={{ color: '#64748B', fontSize: '0.75rem' }}>
                  Status: {applications[0].status} • Applied {applications[0].appliedDate}
                </div>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '9999px', background: '#EFF6FF', color: '#2563EB' }}>
                {applications[0].status}
              </span>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: '#F8FAFC', borderRadius: '8px', fontSize: '0.8125rem' }}>
            <div>
              <strong>Onboarding Completed:</strong> Candidate profile initialized
              <div style={{ color: '#64748B', fontSize: '0.75rem' }}>
                Declared skills registered in Skill Passport
              </div>
            </div>
            <span className="tier-pill tier-pill-declared">Declared</span>
          </div>
        </div>
      </div>
    </div>
  );
};
