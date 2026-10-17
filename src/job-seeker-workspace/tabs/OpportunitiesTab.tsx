import React, { useState } from 'react';
import {
  Briefcase,
  Search,
  Bookmark,
  BookmarkCheck,
  Building2,
  MapPin,
  Check,
  X,
  Sparkles,
} from 'lucide-react';
import type { Opportunity, OpportunityCategory, WorkArrangement, JobApplication } from '../types';

interface OpportunitiesTabProps {
  opportunities: Opportunity[];
  applications: JobApplication[];
  onToggleSave: (id: string) => void;
  onApply: (opportunity: Opportunity, coverNote?: string) => void;
}

export const OpportunitiesTab: React.FC<OpportunitiesTabProps> = ({
  opportunities,
  applications,
  onToggleSave,
  onApply,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<OpportunityCategory | 'all'>('all');
  const [selectedArrangement, setSelectedArrangement] = useState<WorkArrangement | 'all'>('all');
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [inspectOpp, setInspectOpp] = useState<Opportunity | null>(null);
  const [applyOpp, setApplyOpp] = useState<Opportunity | null>(null);
  const [coverNote, setCoverNote] = useState('');
  const [applySuccess, setApplySuccess] = useState<string | null>(null);

  // Checks if already applied
  const isAlreadyApplied = (oppId: string): boolean => {
    return applications.some((a) => a.opportunityId === oppId && a.status !== 'withdrawn');
  };

  const filteredOpportunities = opportunities.filter((opp) => {
    const matchesSearch =
      opp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      opp.organization.toLowerCase().includes(searchQuery.toLowerCase()) ||
      opp.requiredSkills.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategory === 'all' || opp.category === selectedCategory;
    const matchesArrangement = selectedArrangement === 'all' || opp.workArrangement === selectedArrangement;
    const matchesSaved = !showSavedOnly || opp.isSaved;

    return matchesSearch && matchesCategory && matchesArrangement && matchesSaved;
  });

  const handleConfirmApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyOpp) return;

    if (isAlreadyApplied(applyOpp.id)) {
      return;
    }

    onApply(applyOpp, coverNote.trim());
    setApplySuccess(`Application submitted to ${applyOpp.organization} for ${applyOpp.title}!`);
    setTimeout(() => setApplySuccess(null), 4000);
    setApplyOpp(null);
    setCoverNote('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* ── Top Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', margin: '0 0 0.25rem' }}>
            Opportunities &amp; Ecosystem Challenges
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#64748B', margin: 0 }}>
            Discover openings and projects matched to your verified and assessed skill strengths.
          </p>
        </div>

        <button
          type="button"
          className={`jsw-btn ${showSavedOnly ? 'jsw-btn-primary' : 'jsw-btn-secondary'}`}
          onClick={() => setShowSavedOnly(!showSavedOnly)}
        >
          {showSavedOnly ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
          <span>{showSavedOnly ? 'Showing Saved' : 'View Saved'}</span>
        </button>
      </div>

      {applySuccess && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.875rem 1rem',
            background: '#ECFDF5',
            color: '#065F46',
            border: '1px solid #A7F3D0',
            borderRadius: '8px',
            fontSize: '0.875rem',
          }}
        >
          <Check size={16} />
          <span>{applySuccess}</span>
        </div>
      )}

      {/* ── Disclaimer Banner ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.875rem 1.25rem',
          background: '#F0FDF4',
          border: '1px solid #BBF7D0',
          borderRadius: '8px',
          color: '#166534',
          fontSize: '0.8125rem',
        }}
      >
        <Sparkles size={18} style={{ flexShrink: 0, color: '#15803D' }} />
        <div>
          <strong>Prototype Notice:</strong> Opportunities displayed are realistic demo roles and challenges within the YOGYATA ecosystem. Applying creates a local tracking record in your Applications tab.
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="jsw-card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          {/* Search bar */}
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '2.25rem' }}
              placeholder="Search by role, company, or skill..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Category Filter */}
          <select
            className="form-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as OpportunityCategory | 'all')}
          >
            <option value="all">All Categories</option>
            <option value="job">Full-Time Jobs</option>
            <option value="internship">Internships</option>
            <option value="practical-challenge">Practical Challenges</option>
            <option value="startup-project">Startup Projects</option>
          </select>

          {/* Work Arrangement Filter */}
          <select
            className="form-select"
            value={selectedArrangement}
            onChange={(e) => setSelectedArrangement(e.target.value as WorkArrangement | 'all')}
          >
            <option value="all">All Work Arrangements</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="on-site">On-Site</option>
          </select>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem', color: '#64748B' }}>
          <span>Showing <strong>{filteredOpportunities.length}</strong> opportunities</span>
          {(searchQuery || selectedCategory !== 'all' || selectedArrangement !== 'all' || showSavedOnly) && (
            <button
              type="button"
              className="btn-ghost"
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setSelectedArrangement('all');
                setShowSavedOnly(false);
              }}
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* ── Opportunities Grid ── */}
      {filteredOpportunities.length === 0 ? (
        <div className="jsw-card" style={{ textAlign: 'center', padding: '3.5rem', color: '#64748B' }}>
          <Briefcase size={36} style={{ margin: '0 auto 0.75rem', color: '#CBD5E1' }} />
          <h3 style={{ margin: '0 0 0.5rem', color: '#0F172A' }}>No matching opportunities found</h3>
          <p style={{ margin: 0, fontSize: '0.875rem' }}>Adjust your filters or search terms.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
          {filteredOpportunities.map((opp) => {
            const alreadyApplied = isAlreadyApplied(opp.id);

            return (
              <div
                key={opp.id}
                className="jsw-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          background: opp.category === 'job' ? '#EFF6FF' : opp.category === 'internship' ? '#FEF3C7' : '#ECFDF5',
                          color: opp.category === 'job' ? '#2563EB' : opp.category === 'internship' ? '#D97706' : '#059669',
                          textTransform: 'uppercase',
                        }}
                      >
                        {opp.category.replace('-', ' ')}
                      </span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.2rem 0.5rem', borderRadius: '4px', background: '#F1F5F9', color: '#475569' }}>
                        {opp.workArrangement}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onToggleSave(opp.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: opp.isSaved ? '#2563EB' : '#94A3B8', padding: '2px' }}
                      title={opp.isSaved ? 'Remove from saved' : 'Save opportunity'}
                    >
                      {opp.isSaved ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}
                    </button>
                  </div>

                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0F172A', margin: '0 0 0.35rem' }}>
                    {opp.title}
                  </h3>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#475569', fontSize: '0.8125rem', marginBottom: '0.75rem', fontWeight: 500 }}>
                    <Building2 size={14} />
                    <span>{opp.organization}</span>
                    <span>•</span>
                    <MapPin size={14} />
                    <span>{opp.location}</span>
                  </div>

                  <p style={{ fontSize: '0.8125rem', color: '#334155', lineHeight: 1.5, margin: '0 0 1rem' }}>
                    {opp.description}
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.75rem' }}>
                    {opp.requiredSkills.map((skill) => (
                      <span
                        key={skill}
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          background: '#F8FAFC',
                          border: '1px solid #E2E8F0',
                          color: '#334155',
                        }}
                      >
                        {skill}
                      </span>
                    ))}
                  </div>

                  {opp.stipendOrCompensation && (
                    <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.5rem' }}>
                      {opp.stipendOrCompensation}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid #E2E8F0' }}>
                  <button
                    type="button"
                    className="jsw-btn jsw-btn-secondary jsw-btn-sm"
                    onClick={() => setInspectOpp(opp)}
                  >
                    View Details
                  </button>

                  {alreadyApplied ? (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '0.35rem 0.75rem',
                        borderRadius: '6px',
                        background: '#EFF6FF',
                        color: '#2563EB',
                        border: '1px solid #BFDBFE',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      <Check size={14} /> Applied
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="jsw-btn jsw-btn-primary jsw-btn-sm"
                      onClick={() => setApplyOpp(opp)}
                      id={`btn-apply-${opp.id}`}
                    >
                      Apply / Participate
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Opportunity Details Modal ── */}
      {inspectOpp && (
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
              maxWidth: '560px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563EB', textTransform: 'uppercase' }}>
                  {inspectOpp.category.replace('-', ' ')}
                </span>
                <h3 style={{ margin: '0.25rem 0', fontSize: '1.25rem', color: '#0F172A' }}>
                  {inspectOpp.title}
                </h3>
                <div style={{ color: '#64748B', fontSize: '0.875rem' }}>
                  {inspectOpp.organization} • {inspectOpp.location}
                </div>
              </div>
              <button type="button" className="btn-ghost" onClick={() => setInspectOpp(null)}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
              <div>
                <span style={{ color: '#64748B', display: 'block', fontSize: '0.75rem', marginBottom: '2px' }}>Role Overview</span>
                <p style={{ margin: 0, color: '#334155', lineHeight: 1.5 }}>{inspectOpp.description}</p>
              </div>

              <div>
                <span style={{ color: '#64748B', display: 'block', fontSize: '0.75rem', marginBottom: '4px' }}>Required Skills</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {inspectOpp.requiredSkills.map((s) => (
                    <span key={s} className="tag-pill">{s}</span>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <span style={{ color: '#64748B', display: 'block', fontSize: '0.75rem', marginBottom: '2px' }}>Experience</span>
                  <span style={{ color: '#0F172A', fontWeight: 600 }}>{inspectOpp.experienceRequirement}</span>
                </div>
                <div>
                  <span style={{ color: '#64748B', display: 'block', fontSize: '0.75rem', marginBottom: '2px' }}>Deadline</span>
                  <span style={{ color: '#0F172A', fontWeight: 600 }}>{inspectOpp.deadline}</span>
                </div>
              </div>

              {inspectOpp.stipendOrCompensation && (
                <div>
                  <span style={{ color: '#64748B', display: 'block', fontSize: '0.75rem', marginBottom: '2px' }}>Compensation / Reward</span>
                  <span style={{ color: '#059669', fontWeight: 700 }}>{inspectOpp.stipendOrCompensation}</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.75rem' }}>
              <button type="button" className="jsw-btn jsw-btn-secondary" onClick={() => setInspectOpp(null)}>
                Close
              </button>
              {!isAlreadyApplied(inspectOpp.id) && (
                <button
                  type="button"
                  className="jsw-btn jsw-btn-primary"
                  onClick={() => {
                    setApplyOpp(inspectOpp);
                    setInspectOpp(null);
                  }}
                >
                  Apply Now
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Submit Application Modal ── */}
      {applyOpp && (
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0F172A' }}>
                Apply to {applyOpp.title}
              </h3>
              <button type="button" className="btn-ghost" onClick={() => setApplyOpp(null)}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: '0 0 1.25rem', lineHeight: 1.5 }}>
              Organization: <strong>{applyOpp.organization}</strong> • Position: <strong>{applyOpp.title}</strong>
              <br />
              Your Skill Passport and contact details will be attached with this application.
            </p>

            <form onSubmit={handleConfirmApply}>
              <div className="form-group">
                <label className="form-label" htmlFor="apply-note">Cover Note or Introduction (Optional)</label>
                <textarea
                  id="apply-note"
                  className="form-textarea"
                  rows={4}
                  placeholder="Introduce your relevant experience and why your proven skills make you a great fit..."
                  value={coverNote}
                  onChange={(e) => setCoverNote(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="jsw-btn jsw-btn-secondary"
                  onClick={() => setApplyOpp(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="jsw-btn jsw-btn-primary"
                  id="btn-confirm-apply"
                >
                  Confirm &amp; Submit Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
