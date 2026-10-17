import React, { useState } from 'react';
import {
  FileText,
  Search,
  Building2,
  Calendar,
  X,
  Clock,
  ArrowRight,
} from 'lucide-react';
import type { JobApplication, ApplicationStatus, JobSeekerWorkspaceTab } from '../types';

interface ApplicationsTabProps {
  applications: JobApplication[];
  onWithdrawApplication: (id: string) => void;
  onTabChange: (tab: JobSeekerWorkspaceTab) => void;
}

export const ApplicationsTab: React.FC<ApplicationsTabProps> = ({
  applications,
  onWithdrawApplication,
  onTabChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<ApplicationStatus | 'all'>('all');
  const [inspectApp, setInspectApp] = useState<JobApplication | null>(null);
  const [withdrawTargetId, setWithdrawTargetId] = useState<string | null>(null);

  const filteredApplications = applications.filter((app) => {
    const matchesSearch =
      app.opportunityTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.organization.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || app.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: ApplicationStatus) => {
    const styles: Record<ApplicationStatus, { bg: string; text: string; border: string }> = {
      applied: { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
      'in-review': { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' },
      interview: { bg: '#EEF2FF', text: '#4F46E5', border: '#C7D2FE' },
      offer: { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' },
      rejected: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
      withdrawn: { bg: '#F1F5F9', text: '#64748B', border: '#CBD5E1' },
    };

    const s = styles[status] || styles.applied;

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '0.2rem 0.6rem',
          borderRadius: '9999px',
          fontSize: '0.75rem',
          fontWeight: 700,
          background: s.bg,
          color: s.text,
          border: `1px solid ${s.border}`,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {status.replace('-', ' ')}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* ── Top Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', margin: '0 0 0.25rem' }}>
            Application Tracker
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#64748B', margin: 0 }}>
            Monitor and track your candidate submissions across organizations and startup challenges.
          </p>
        </div>

        <button
          type="button"
          className="jsw-btn jsw-btn-primary"
          onClick={() => onTabChange('opportunities')}
          id="btn-app-find-more"
        >
          <span>Find More Opportunities</span>
          <ArrowRight size={16} />
        </button>
      </div>

      {/* ── Filters Bar ── */}
      <div className="jsw-card" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '2.25rem' }}
              placeholder="Filter by role or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {(['all', 'applied', 'in-review', 'interview', 'offer', 'withdrawn'] as const).map((status) => (
              <button
                key={status}
                type="button"
                className={`jsw-btn jsw-btn-sm ${selectedStatus === status ? 'jsw-btn-primary' : 'jsw-btn-secondary'}`}
                onClick={() => setSelectedStatus(status)}
              >
                {status === 'all' ? 'All Applications' : status.replace('-', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Applications List ── */}
      {filteredApplications.length === 0 ? (
        <div className="jsw-card" style={{ textAlign: 'center', padding: '3.5rem', color: '#64748B' }}>
          <FileText size={36} style={{ margin: '0 auto 0.75rem', color: '#CBD5E1' }} />
          <h3 style={{ margin: '0 0 0.5rem', color: '#0F172A' }}>No applications to display</h3>
          <p style={{ margin: '0 0 1.25rem', fontSize: '0.875rem' }}>
            {applications.length === 0
              ? 'You have not submitted any applications yet. Explore openings to get started.'
              : 'No applications match your active search or status filters.'}
          </p>
          {applications.length === 0 && (
            <button
              type="button"
              className="jsw-btn jsw-btn-primary"
              onClick={() => onTabChange('opportunities')}
            >
              Browse Open Opportunities →
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          {filteredApplications.map((app) => (
            <div
              key={app.id}
              className="jsw-card"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1.25rem 1.5rem',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', minWidth: '280px', flex: 1 }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '8px',
                    background: '#EFF6FF',
                    color: '#2563EB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Building2 size={20} />
                </div>

                <div>
                  <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.05rem', fontWeight: 700, color: '#0F172A' }}>
                    {app.opportunityTitle}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8125rem', color: '#64748B', flexWrap: 'wrap' }}>
                    <strong>{app.organization}</strong>
                    <span>•</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Calendar size={13} /> Applied: {app.appliedDate}
                    </span>
                    <span>•</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Clock size={13} /> Updated: {app.lastUpdated}
                    </span>
                  </div>

                  {app.nextAction && (
                    <div style={{ marginTop: '0.35rem', fontSize: '0.78rem', color: '#475569' }}>
                      <em>Next step:</em> {app.nextAction}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {getStatusBadge(app.status)}

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="jsw-btn jsw-btn-secondary jsw-btn-sm"
                    onClick={() => setInspectApp(app)}
                  >
                    View
                  </button>

                  {app.status !== 'withdrawn' && (
                    <button
                      type="button"
                      className="jsw-btn jsw-btn-secondary jsw-btn-sm"
                      style={{ color: '#DC2626' }}
                      onClick={() => setWithdrawTargetId(app.id)}
                    >
                      Withdraw
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── View Application Details Modal ── */}
      {inspectApp && (
        <div
          className="yw-modal-overlay"
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem',
          }}
        >
          <div
            className="yw-modal-box"
            style={{
              background: '#FFFFFF',
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '520px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0F172A' }}>
                  {inspectApp.opportunityTitle}
                </h3>
                <div style={{ color: '#64748B', fontSize: '0.875rem' }}>
                  {inspectApp.organization} • {inspectApp.category}
                </div>
              </div>
              <button type="button" className="btn-ghost" onClick={() => setInspectApp(null)}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
              <div>
                <span style={{ color: '#64748B', display: 'block', fontSize: '0.75rem', marginBottom: '2px' }}>Current Status</span>
                {getStatusBadge(inspectApp.status)}
              </div>

              <div>
                <span style={{ color: '#64748B', display: 'block', fontSize: '0.75rem', marginBottom: '2px' }}>Application Date</span>
                <span style={{ color: '#0F172A', fontWeight: 600 }}>{inspectApp.appliedDate}</span>
              </div>

              {inspectApp.coverNote && (
                <div>
                  <span style={{ color: '#64748B', display: 'block', fontSize: '0.75rem', marginBottom: '2px' }}>Submitted Cover Note</span>
                  <p style={{ margin: 0, color: '#334155', lineHeight: 1.5, background: '#F8FAFC', padding: '0.75rem', borderRadius: '6px' }}>
                    {inspectApp.coverNote}
                  </p>
                </div>
              )}

              {inspectApp.nextAction && (
                <div>
                  <span style={{ color: '#64748B', display: 'block', fontSize: '0.75rem', marginBottom: '2px' }}>Next Action</span>
                  <span style={{ color: '#0F172A' }}>{inspectApp.nextAction}</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.75rem' }}>
              <button type="button" className="jsw-btn jsw-btn-secondary" onClick={() => setInspectApp(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Withdraw Application Confirmation Modal ── */}
      {withdrawTargetId && (
        <div
          className="yw-modal-overlay"
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem',
          }}
        >
          <div
            className="yw-modal-box"
            style={{
              background: '#FFFFFF',
              borderRadius: '12px',
              padding: '1.75rem',
              maxWidth: '420px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.125rem', color: '#0F172A' }}>
              Withdraw Application?
            </h3>
            <p style={{ margin: '0 0 1.5rem', fontSize: '0.875rem', color: '#64748B', lineHeight: 1.5 }}>
              Are you sure you want to withdraw this application? The hiring team will be notified of your withdrawal.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="jsw-btn jsw-btn-secondary jsw-btn-sm"
                onClick={() => setWithdrawTargetId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="jsw-btn jsw-btn-primary jsw-btn-sm"
                style={{ background: '#DC2626' }}
                onClick={() => {
                  onWithdrawApplication(withdrawTargetId);
                  setWithdrawTargetId(null);
                }}
                id="btn-confirm-withdraw-app"
              >
                Confirm Withdrawal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
