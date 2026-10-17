import React from 'react';
import {
  Users,
  Search,
  Calendar,
  Award,
  Layers,
  ArrowRight,
  FileText,
} from 'lucide-react';
import type {
  RecruiterWorkspaceState,
  RecruiterWorkspaceTab,
  PipelineStage,
} from '../types';
import { ROUND_LABELS, STAGE_LABELS } from '../types';

interface OverviewTabProps {
  state: RecruiterWorkspaceState;
  onTabChange: (tab: RecruiterWorkspaceTab) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  state,
  onTabChange,
}) => {
  const totalPipeline = state.pipeline.length;
  const screeningCount = state.pipeline.filter((p) => p.stage === 'screening').length;
  const offerCount = state.pipeline.filter((p) => p.stage === 'offer').length;
  const hiredCount = state.pipeline.filter((p) => p.stage === 'hired').length;

  const upcomingInterviews = state.interviews.filter(
    (i) => i.status === 'scheduled'
  );

  const stagesList: PipelineStage[] = [
    'sourced',
    'screening',
    'interview',
    'offer',
    'hired',
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Welcome Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #171B4D 0%, #1E3A8A 100%)',
          borderRadius: '10px',
          padding: '1.5rem 1.75rem',
          color: '#FFFFFF',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <span
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                padding: '0.15rem 0.5rem',
                borderRadius: '9999px',
                fontSize: '0.72rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Hiring Command Center
            </span>
            <span style={{ fontSize: '0.8rem', opacity: 0.85 }}>
              {state.company.companyName}
            </span>
          </div>
          <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: '#FFFFFF' }}>
            Welcome back, {state.recruiter.recruiterName || 'Talent Lead'}
          </h2>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', opacity: 0.85, maxWidth: '580px', lineHeight: 1.45 }}>
            Evaluate evidence-verified Skill Passport profiles, organize technical interview rounds,
            and make objective hiring decisions.
          </p>
        </div>

        <button
          type="button"
          className="btn-primary"
          onClick={() => onTabChange('talent-search')}
          style={{
            background: '#22C55E',
            borderColor: '#22C55E',
            color: '#064E3B',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.625rem 1.25rem',
          }}
        >
          <Search size={16} />
          <span>Search Verified Talent</span>
        </button>
      </div>

      {/* 4 Stat Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '1rem',
        }}
      >
        <div className="stat-card" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '1.125rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 500 }}>
              Total in Pipeline
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: '#F0FDF4', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0F172A', marginTop: '0.35rem' }}>
            {totalPipeline}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.2rem' }}>
            Active hiring candidates
          </div>
        </div>

        <div className="stat-card" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '1.125rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 500 }}>
              Under Screening
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: '#EFF6FF', color: '#1D4ED8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0F172A', marginTop: '0.35rem' }}>
            {screeningCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.2rem' }}>
            Profiles in initial review
          </div>
        </div>

        <div className="stat-card" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '1.125rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 500 }}>
              Upcoming Interviews
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: '#FFFBEB', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0F172A', marginTop: '0.35rem' }}>
            {upcomingInterviews.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.2rem' }}>
            Scheduled technical rounds
          </div>
        </div>

        <div className="stat-card" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '1.125rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 500 }}>
              Offers in Progress
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: '#FAF5FF', color: '#7E22CE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0F172A', marginTop: '0.35rem' }}>
            {offerCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.2rem' }}>
            {hiredCount} candidate{hiredCount === 1 ? '' : 's'} hired
          </div>
        </div>
      </div>

      {/* Pipeline Stage Distribution Progress Bar */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '8px',
          padding: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#0F172A' }}>
              Pipeline Stage Breakdown
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
              Active progression across technical hiring funnel
            </span>
          </div>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => onTabChange('pipeline')}
            style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#2563EB' }}
          >
            <span>Open Pipeline Board</span>
            <ArrowRight size={13} />
          </button>
        </div>

        {totalPipeline === 0 ? (
          <p style={{ fontSize: '0.8125rem', color: '#94A3B8', fontStyle: 'italic', margin: 0 }}>
            No candidates added to the pipeline yet. Search talent to begin sourcing.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
            {stagesList.map((stage) => {
              const count = state.pipeline.filter((p) => p.stage === stage).length;
              const pct = totalPipeline > 0 ? Math.round((count / totalPipeline) * 100) : 0;
              return (
                <div
                  key={stage}
                  style={{
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '6px',
                    padding: '0.625rem 0.75rem',
                  }}
                >
                  <div style={{ fontSize: '0.72rem', color: '#64748B', textTransform: 'capitalize' }}>
                    {STAGE_LABELS[stage]}
                  </div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0F172A', marginTop: '0.15rem' }}>
                    {count}
                  </div>
                  <div style={{ width: '100%', height: '4px', background: '#E2E8F0', borderRadius: '2px', marginTop: '0.35rem', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: '#2563EB', borderRadius: '2px' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Grid: Upcoming Interviews & Quick Actions */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.25rem',
        }}
      >
        {/* Upcoming Interviews Feed */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={16} style={{ color: '#D97706' }} />
              <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#0F172A' }}>
                Upcoming Technical Interviews
              </h3>
            </div>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => onTabChange('interviews')}
              style={{ fontSize: '0.75rem', color: '#2563EB', padding: 0 }}
            >
              View All ({upcomingInterviews.length})
            </button>
          </div>

          {upcomingInterviews.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 0', color: '#94A3B8', fontSize: '0.8125rem' }}>
              No upcoming interviews scheduled.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
              {upcomingInterviews.slice(0, 3).map((interview) => (
                <div
                  key={interview.id}
                  style={{
                    background: '#FAFAFA',
                    border: '1px solid #E2E8F0',
                    borderLeft: '3px solid #3B82F6',
                    borderRadius: '0 6px 6px 0',
                    padding: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <strong style={{ fontSize: '0.875rem', color: '#0F172A' }}>
                        {interview.candidateName}
                      </strong>
                      <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                        {interview.targetRole} • {ROUND_LABELS[interview.round]}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        background: '#EFF6FF',
                        color: '#1D4ED8',
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                        fontWeight: 600,
                      }}
                    >
                      {interview.startTime}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem', fontSize: '0.75rem', color: '#64748B' }}>
                    <span>Date: {interview.date}</span>
                    <span>•</span>
                    <span>{interview.durationMinutes} mins</span>
                    <span>•</span>
                    <span style={{ textTransform: 'capitalize' }}>{interview.format} format</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions & Recent Pipeline Activity */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <h3 style={{ margin: '0 0 1rem', fontSize: '0.9375rem', fontWeight: 600, color: '#0F172A' }}>
            Recruiter Quick Actions
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onTabChange('talent-search')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '0.75rem',
                height: 'auto',
                textAlign: 'left',
                borderRadius: '6px',
              }}
            >
              <Search size={16} style={{ color: '#2563EB', marginBottom: '0.25rem' }} />
              <strong style={{ fontSize: '0.8125rem', color: '#0F172A' }}>Talent Discovery</strong>
              <span style={{ fontSize: '0.7rem', color: '#64748B' }}>Search Skill Passports</span>
            </button>

            <button
              type="button"
              className="btn-secondary"
              onClick={() => onTabChange('pipeline')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '0.75rem',
                height: 'auto',
                textAlign: 'left',
                borderRadius: '6px',
              }}
            >
              <Layers size={16} style={{ color: '#15803D', marginBottom: '0.25rem' }} />
              <strong style={{ fontSize: '0.8125rem', color: '#0F172A' }}>Pipeline Board</strong>
              <span style={{ fontSize: '0.7rem', color: '#64748B' }}>Manage candidate stages</span>
            </button>

            <button
              type="button"
              className="btn-secondary"
              onClick={() => onTabChange('interviews')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '0.75rem',
                height: 'auto',
                textAlign: 'left',
                borderRadius: '6px',
              }}
            >
              <Calendar size={16} style={{ color: '#D97706', marginBottom: '0.25rem' }} />
              <strong style={{ fontSize: '0.8125rem', color: '#0F172A' }}>Schedule Round</strong>
              <span style={{ fontSize: '0.7rem', color: '#64748B' }}>Book interview timeslot</span>
            </button>

            <button
              type="button"
              className="btn-secondary"
              onClick={() => onTabChange('scorecards')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '0.75rem',
                height: 'auto',
                textAlign: 'left',
                borderRadius: '6px',
              }}
            >
              <FileText size={16} style={{ color: '#7C3AED', marginBottom: '0.25rem' }} />
              <strong style={{ fontSize: '0.8125rem', color: '#0F172A' }}>Scorecards</strong>
              <span style={{ fontSize: '0.7rem', color: '#64748B' }}>Evaluate candidates</span>
            </button>
          </div>

          {/* Recent Candidate Snippet */}
          <div style={{ marginTop: 'auto', borderTop: '1px solid #E2E8F0', paddingTop: '0.875rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block', marginBottom: '0.5rem' }}>
              Recently Updated Candidate
            </span>
            {state.pipeline.length > 0 ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontSize: '0.84rem', color: '#0F172A' }}>
                    {state.pipeline[0].candidateName}
                  </strong>
                  <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                    {state.pipeline[0].targetRole} ({state.pipeline[0].stage})
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => onTabChange('pipeline')}
                  style={{ fontSize: '0.75rem', color: '#2563EB', padding: '0.2rem 0.5rem' }}
                >
                  View Notes
                </button>
              </div>
            ) : (
              <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>No candidates yet</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
