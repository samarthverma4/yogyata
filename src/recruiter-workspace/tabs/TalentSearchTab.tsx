import React, { useState, useMemo } from 'react';
import {
  Search,
  ShieldCheck,
  Award,
  MapPin,
  Briefcase,
  Bookmark,
  BookmarkCheck,
  Plus,
  X,
} from 'lucide-react';
import type {
  CandidateProfile,
  PipelineCandidate,
  PipelineStage,
} from '../types';
import { CandidateDetailModal } from '../CandidateDetailModal';

interface TalentSearchTabProps {
  candidates: CandidateProfile[];
  pipeline: PipelineCandidate[];
  availableRoles: string[];
  onToggleSaveCandidate: (candidateId: string) => void;
  onAddToPipeline: (candidateId: string, role: string, stage: PipelineStage) => void;
}

export const TalentSearchTab: React.FC<TalentSearchTabProps> = ({
  candidates,
  pipeline,
  availableRoles,
  onToggleSaveCandidate,
  onAddToPipeline,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSkillFilter, setSelectedSkillFilter] = useState('all');
  const [selectedExpFilter, setSelectedExpFilter] = useState('all');
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [sortBy, setSortBy] = useState<'evidence' | 'exp' | 'name'>('evidence');
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateProfile | null>(null);

  // Extract all unique skills across candidates
  const allSkills = useMemo(() => {
    const set = new Set<string>();
    candidates.forEach((c) => c.skills.forEach((s) => set.add(s)));
    return Array.from(set).sort();
  }, [candidates]);

  // Filter and sort candidates
  const filteredCandidates = useMemo(() => {
    return candidates
      .filter((cand) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesName = cand.name.toLowerCase().includes(q);
          const matchesHeadline = cand.headline.toLowerCase().includes(q);
          const matchesSkill = cand.skills.some((s) => s.toLowerCase().includes(q));
          if (!matchesName && !matchesHeadline && !matchesSkill) return false;
        }

        // Skill filter
        if (selectedSkillFilter !== 'all') {
          if (!cand.skills.includes(selectedSkillFilter)) return false;
        }

        // Experience filter
        if (selectedExpFilter !== 'all') {
          if (selectedExpFilter === 'junior' && cand.experienceYears > 3) return false;
          if (selectedExpFilter === 'mid' && (cand.experienceYears <= 2 || cand.experienceYears > 5)) return false;
          if (selectedExpFilter === 'senior' && cand.experienceYears < 5) return false;
        }

        // Only verified tier
        if (onlyVerified) {
          if (!cand.verifiedSkills || cand.verifiedSkills.length === 0) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'evidence') {
          return b.verifiedSkills.length - a.verifiedSkills.length;
        }
        if (sortBy === 'exp') {
          return b.experienceYears - a.experienceYears;
        }
        return a.name.localeCompare(b.name);
      });
  }, [candidates, searchQuery, selectedSkillFilter, selectedExpFilter, onlyVerified, sortBy]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedSkillFilter !== 'all' ||
    selectedExpFilter !== 'all' ||
    onlyVerified;

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedSkillFilter('all');
    setSelectedExpFilter('all');
    setOnlyVerified(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header & Subtitle */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-navy)' }}>
              Talent Discovery &amp; Skill Passports
            </h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
              Filter by verified challenge artifacts, assessed technical benchmarks, and declared domains.
            </p>
          </div>

          <div
            style={{
              fontSize: '0.75rem',
              color: '#065F46',
              background: '#ECFDF5',
              padding: '0.35rem 0.75rem',
              borderRadius: 0,
              border: '1px solid #A7F3D0',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontWeight: 500,
            }}
          >
            <ShieldCheck size={14} />
            <span>Evidenced Skill Records Verified by YOGYATA</span>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid var(--color-border)',
          borderRadius: 0,
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.875rem',
        }}
      >
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Search bar */}
          <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-text-faint)',
              }}
            />
            <input
              type="text"
              className="form-input"
              placeholder="Search by candidate name, title, or skills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.25rem', fontSize: '0.84rem' }}
            />
          </div>

          {/* Skill Filter */}
          <select
            className="form-input"
            value={selectedSkillFilter}
            onChange={(e) => setSelectedSkillFilter(e.target.value)}
            style={{ minWidth: '150px', fontSize: '0.84rem' }}
          >
            <option value="all">All Skills</option>
            {allSkills.map((sk) => (
              <option key={sk} value={sk}>
                {sk}
              </option>
            ))}
          </select>

          {/* Experience Filter */}
          <select
            className="form-input"
            value={selectedExpFilter}
            onChange={(e) => setSelectedExpFilter(e.target.value)}
            style={{ minWidth: '150px', fontSize: '0.84rem' }}
          >
            <option value="all">All Seniority</option>
            <option value="junior">Junior (1-3 yrs)</option>
            <option value="mid">Mid-Level (3-5 yrs)</option>
            <option value="senior">Senior (5+ yrs)</option>
          </select>

          {/* Sort By */}
          <select
            className="form-input"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            style={{ minWidth: '170px', fontSize: '0.84rem' }}
          >
            <option value="evidence">Most Verified Evidence</option>
            <option value="exp">Experience (High to Low)</option>
            <option value="name">Alphabetical (A-Z)</option>
          </select>
        </div>

        {/* Toggle & Filter Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--color-navy)' }}>
            <input
              type="checkbox"
              checked={onlyVerified}
              onChange={(e) => setOnlyVerified(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ fontWeight: 600, color: onlyVerified ? '#047857' : 'inherit' }}>
              Only Show Candidates with Verified Skill Passport Evidence
            </span>
          </label>

          {hasActiveFilters && (
            <button
              type="button"
              className="btn-ghost"
              onClick={handleClearFilters}
              style={{ fontSize: '0.75rem', color: '#DC2626', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.5rem' }}
            >
              <X size={13} />
              <span>Reset Active Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Candidate List Results */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            Showing <strong>{filteredCandidates.length}</strong> candidate{filteredCandidates.length === 1 ? '' : 's'}
          </span>
        </div>

        {filteredCandidates.length === 0 ? (
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid var(--color-border)',
              borderRadius: 0,
              padding: '3rem 1.5rem',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'var(--color-surface-2)',
                color: 'var(--color-text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
              }}
            >
              <Search size={22} />
            </div>
            <h3 style={{ margin: '0 0 0.35rem', fontSize: '1rem', color: 'var(--color-navy)' }}>
              No candidates match your criteria
            </h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--color-text-muted)', maxWidth: '400px', marginInline: 'auto' }}>
              Try loosening your skill or seniority filters, or disable the verified-only checkbox.
            </p>
            <button type="button" className="btn-secondary" onClick={handleClearFilters} style={{ fontSize: '0.8125rem' }}>
              Clear All Filters
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {filteredCandidates.map((candidate) => {
              const inPipe = pipeline.some((p) => p.candidateId === candidate.id && p.stage !== 'archived');
              const pipeEntry = pipeline.find((p) => p.candidateId === candidate.id);

              return (
                <div
                  key={candidate.id}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid var(--color-border)',
                    borderRadius: 0,
                    padding: '1.25rem',
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                    {/* Left: Avatar + Details */}
                    <div style={{ display: 'flex', gap: '1rem', flex: 1, minWidth: '280px' }}>
                      <div
                        style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, var(--color-navy) 0%, var(--color-blue) 100%)',
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '1.05rem',
                          flexShrink: 0,
                        }}
                      >
                        {candidate.avatarInitials}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-navy)' }}>
                            {candidate.name}
                          </h3>
                          {inPipe && (
                            <span
                              style={{
                                fontSize: '0.72rem',
                                padding: '0.15rem 0.45rem',
                                borderRadius: 0,
                                background: 'var(--color-blue-tint)',
                                color: 'var(--color-blue-hover)',
                                border: '1px solid var(--color-blue-line)',
                                fontWeight: 600,
                              }}
                            >
                              In Pipeline ({pipeEntry?.stage})
                            </span>
                          )}
                        </div>

                        <p style={{ margin: '0.2rem 0 0.35rem', fontSize: '0.84rem', color: 'var(--color-navy)', fontWeight: 500 }}>
                          {candidate.headline}
                        </p>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', fontSize: '0.75rem', color: 'var(--color-text-muted)', flexWrap: 'wrap' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <MapPin size={12} /> {candidate.location}
                          </span>
                          <span>•</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Briefcase size={12} /> {candidate.experienceRange}
                          </span>
                        </div>

                        {/* Skills Breakdown by Tier */}
                        <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.375rem', alignItems: 'center' }}>
                          {/* Verified Skills */}
                          {candidate.verifiedSkills.map((vs) => (
                            <span key={vs} className="tier-badge-verified">
                              <ShieldCheck size={11} /> {vs}
                            </span>
                          ))}

                          {/* Assessed Skills */}
                          {candidate.assessedSkills.map((as) => (
                            <span key={as} className="tier-badge-assessed">
                              <Award size={11} /> {as}
                            </span>
                          ))}

                          {/* Declared Skills */}
                          {candidate.declaredSkills.map((ds) => (
                            <span key={ds} className="tier-badge-declared">
                              {ds}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => onToggleSaveCandidate(candidate.id)}
                        title={candidate.isSaved ? 'Bookmarked' : 'Bookmark candidate'}
                        style={{ padding: '0.45rem', color: candidate.isSaved ? 'var(--color-blue)' : 'var(--color-text-faint)' }}
                      >
                        {candidate.isSaved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
                      </button>

                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setSelectedCandidate(candidate)}
                        style={{ fontSize: '0.8125rem', padding: '0.45rem 0.85rem' }}
                      >
                        View Skill Passport
                      </button>

                      {!inPipe && (
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => {
                            const defaultRole = availableRoles[0] || 'Senior Technical Contributor';
                            onAddToPipeline(candidate.id, defaultRole, 'screening');
                          }}
                          style={{
                            fontSize: '0.8125rem',
                            padding: '0.45rem 0.85rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            background: '#15803D',
                            borderColor: '#15803D',
                          }}
                        >
                          <Plus size={14} /> Add to Pipeline
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Candidate Detail Modal / Drawer */}
      {selectedCandidate && (
        <CandidateDetailModal
          candidate={selectedCandidate}
          isOpen={Boolean(selectedCandidate)}
          isInPipeline={pipeline.some((p) => p.candidateId === selectedCandidate.id && p.stage !== 'archived')}
          pipelineEntry={pipeline.find((p) => p.candidateId === selectedCandidate.id)}
          onClose={() => setSelectedCandidate(null)}
          onToggleSave={onToggleSaveCandidate}
          onAddToPipeline={(candId, role, stage) => {
            onAddToPipeline(candId, role, stage);
            setSelectedCandidate(null);
          }}
          availableRoles={availableRoles}
        />
      )}
    </div>
  );
};
