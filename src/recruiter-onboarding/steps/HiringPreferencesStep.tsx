import React, { useState } from 'react';
import {
  Check,
  Plus,
  ArrowRight,
  ArrowLeft,
  X,
  Target,
} from 'lucide-react';
import type { HiringPreferences } from '../types';
import {
  POPULAR_TECHNICAL_SKILLS,
  POPULAR_EXPERIENCE_RANGES,
  EMPLOYMENT_TYPE_OPTIONS,
  WORK_ARRANGEMENT_OPTIONS,
  HIRING_PRIORITIES_OPTIONS,
} from '../types';

interface HiringPreferencesStepProps {
  data: HiringPreferences;
  onChange: (data: Partial<HiringPreferences>) => void;
  onNext: () => void;
  onBack: () => void;
}

export const HiringPreferencesStep: React.FC<HiringPreferencesStepProps> = ({
  data,
  onChange,
  onNext,
  onBack,
}) => {
  const [roleInput, setRoleInput] = useState('');
  const [skillInput, setSkillInput] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [error, setError] = useState('');

  const toggleArrayItem = (key: keyof HiringPreferences, item: string) => {
    const list = (data[key] as string[]) || [];
    const exists = list.includes(item);
    const updated = exists ? list.filter((i) => i !== item) : [...list, item];
    onChange({ [key]: updated });
    if (error) setError('');
  };

  const handleAddRole = () => {
    const trimmed = roleInput.trim();
    if (!trimmed) return;
    const list = data.rolesCommonlyHired || [];
    if (!list.includes(trimmed)) {
      onChange({ rolesCommonlyHired: [...list, trimmed] });
    }
    setRoleInput('');
  };

  const handleRemoveRole = (role: string) => {
    onChange({
      rolesCommonlyHired: (data.rolesCommonlyHired || []).filter((r) => r !== role),
    });
  };

  const handleAddSkill = () => {
    const trimmed = skillInput.trim();
    if (!trimmed) return;
    const list = data.technicalSkillsSought || [];
    if (!list.includes(trimmed)) {
      onChange({ technicalSkillsSought: [...list, trimmed] });
    }
    setSkillInput('');
  };

  const handleAddLocation = () => {
    const trimmed = locationInput.trim();
    if (!trimmed) return;
    const list = data.preferredLocations || [];
    if (!list.includes(trimmed)) {
      onChange({ preferredLocations: [...list, trimmed] });
    }
    setLocationInput('');
  };

  const handleRemoveLocation = (loc: string) => {
    onChange({
      preferredLocations: (data.preferredLocations || []).filter((l) => l !== loc),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.rolesCommonlyHired || data.rolesCommonlyHired.length === 0) {
      setError('Please add or select at least one target hiring role');
      return;
    }
    if (!data.technicalSkillsSought || data.technicalSkillsSought.length === 0) {
      setError('Please select at least one primary skill you seek');
      return;
    }
    onNext();
  };

  return (
    <div className="founder-step-card">
      <div className="founder-step-header">
        <h2 className="founder-step-title">Hiring Preferences &amp; Criteria</h2>
        <p className="founder-step-subtitle">
          Configure your default candidate search filters, target skill profiles, and work arrangements.
        </p>
      </div>

      {error && <div className="form-error-banner" style={{ marginBottom: '1rem', color: '#DC2626' }}>{error}</div>}

      <form onSubmit={handleSubmit}>
        {/* Roles Commonly Hired */}
        <div className="form-group">
          <label className="form-label">
            Target Job Roles / Openings <span className="required-star">*</span>
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', maxWidth: '460px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Senior Frontend Engineer, ML Systems Engineer"
              value={roleInput}
              onChange={(e) => setRoleInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddRole();
                }
              }}
              style={{ fontSize: '0.8125rem' }}
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={handleAddRole}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8125rem' }}
            >
              <Plus size={14} /> Add Role
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {(data.rolesCommonlyHired || []).map((role) => (
              <span
                key={role}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: 0,
                  background: 'var(--color-blue-tint)',
                  border: '1px solid var(--color-blue-line)',
                  color: 'var(--color-blue-hover)',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                }}
              >
                {role}
                <button
                  type="button"
                  onClick={() => handleRemoveRole(role)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: '#60A5FA',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 0,
                  }}
                  aria-label={`Remove ${role}`}
                >
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Technical Skills Sought */}
        <div className="form-group" style={{ marginTop: '1.5rem' }}>
          <label className="form-label">
            Core Technical Skills Sought <span className="required-star">*</span>
          </label>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: '0 0 0.5rem' }}>
            Select skills to highlight in candidate Skill Passport evaluation:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {POPULAR_TECHNICAL_SKILLS.map((skill) => {
              const selected = (data.technicalSkillsSought || []).includes(skill);
              return (
                <button
                  key={skill}
                  type="button"
                  onClick={() => toggleArrayItem('technicalSkillsSought', skill)}
                  className={`skill-chip ${selected ? 'is-selected' : ''}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    padding: '0.35rem 0.75rem',
                    borderRadius: 0,
                    fontSize: '0.8125rem',
                    border: selected ? '1px solid var(--color-blue)' : '1px solid var(--color-border)',
                    background: selected ? 'var(--color-blue-tint)' : 'var(--color-surface)',
                    color: selected ? 'var(--color-blue-hover)' : 'var(--color-text-primary)',
                    cursor: 'pointer',
                    fontWeight: selected ? 600 : 400,
                  }}
                >
                  {selected && <Check size={14} />}
                  {skill}
                </button>
              );
            })}
          </div>

          {/* Add custom skill */}
          <div style={{ display: 'flex', gap: '0.5rem', maxWidth: '380px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Add other skill (e.g. Rust, PyTorch)"
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddSkill();
                }
              }}
              style={{ fontSize: '0.8125rem' }}
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={handleAddSkill}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8125rem' }}
            >
              <Plus size={14} /> Add
            </button>
          </div>
        </div>

        {/* Experience Ranges */}
        <div className="form-group" style={{ marginTop: '1.5rem' }}>
          <label className="form-label">Target Seniority &amp; Experience Levels</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {POPULAR_EXPERIENCE_RANGES.map((range) => {
              const selected = (data.experienceRanges || []).includes(range);
              return (
                <button
                  key={range}
                  type="button"
                  onClick={() => toggleArrayItem('experienceRanges', range)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: 0,
                    fontSize: '0.8125rem',
                    border: selected ? '1px solid #0D9488' : '1px solid var(--color-border)',
                    background: selected ? '#F0FDFA' : 'var(--color-surface)',
                    color: selected ? '#0F766E' : 'var(--color-text-primary)',
                    cursor: 'pointer',
                    fontWeight: selected ? 600 : 400,
                  }}
                >
                  {range}
                </button>
              );
            })}
          </div>
        </div>

        {/* Work Arrangement & Employment Type Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem', marginTop: '1.5rem' }}>
          <div className="form-group">
            <label className="form-label">Work Arrangement</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {WORK_ARRANGEMENT_OPTIONS.map((opt) => {
                const selected = (data.workArrangements || []).includes(opt);
                return (
                  <label
                    key={opt}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleArrayItem('workArrangements', opt)}
                    />
                    <span>{opt}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Employment Type</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {EMPLOYMENT_TYPE_OPTIONS.map((opt) => {
                const selected = (data.employmentTypes || []).includes(opt);
                return (
                  <label
                    key={opt}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleArrayItem('employmentTypes', opt)}
                    />
                    <span>{opt}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Preferred Locations */}
        <div className="form-group" style={{ marginTop: '1.5rem' }}>
          <label className="form-label">Target Locations</label>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', maxWidth: '380px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Bengaluru, Remote, Hyderabad"
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddLocation();
                }
              }}
              style={{ fontSize: '0.8125rem' }}
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={handleAddLocation}
              style={{ fontSize: '0.8125rem' }}
            >
              Add
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
            {(data.preferredLocations || []).map((loc) => (
              <span
                key={loc}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.25rem 0.55rem',
                  borderRadius: 0,
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border-hover)',
                  color: 'var(--color-navy)',
                  fontSize: '0.75rem',
                }}
              >
                {loc}
                <button
                  type="button"
                  onClick={() => handleRemoveLocation(loc)}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-faint)', padding: 0 }}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Hiring Priorities */}
        <div className="form-group" style={{ marginTop: '1.5rem' }}>
          <label className="form-label">Hiring Priorities &amp; Philosophy</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {HIRING_PRIORITIES_OPTIONS.map((priority) => {
              const selected = (data.hiringPriorities || []).includes(priority);
              return (
                <button
                  key={priority}
                  type="button"
                  onClick={() => toggleArrayItem('hiringPriorities', priority)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    padding: '0.35rem 0.75rem',
                    borderRadius: 0,
                    fontSize: '0.8125rem',
                    border: selected ? '1px solid var(--color-blue)' : '1px solid var(--color-border)',
                    background: selected ? 'var(--color-blue-tint)' : 'var(--color-surface)',
                    color: selected ? 'var(--color-blue-hover)' : 'var(--color-text-primary)',
                    cursor: 'pointer',
                    fontWeight: selected ? 600 : 400,
                  }}
                >
                  <Target size={13} />
                  {priority}
                </button>
              );
            })}
          </div>
        </div>

        {/* Form Actions */}
        <div className="founder-step-actions" style={{ marginTop: '2.5rem' }}>
          <button type="button" className="btn-secondary" onClick={onBack}>
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>
          <button type="submit" className="btn-primary" style={{ minWidth: '180px' }}>
            <span>Review Profile</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </div>
  );
};
