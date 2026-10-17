import React, { useState } from 'react';
import type { MentorExpertise } from '../types';
import {
  POPULAR_EXPERTISE_AREAS,
  POPULAR_TECHNICAL_SKILLS,
  POPULAR_INDUSTRIES,
} from '../types';
import { ArrowLeft, ArrowRight, Plus, X, Info } from 'lucide-react';

interface MentorExpertiseStepProps {
  data: MentorExpertise;
  onChange: (data: MentorExpertise) => void;
  onNext: () => void;
  onBack: () => void;
}

export const MentorExpertiseStep: React.FC<MentorExpertiseStepProps> = ({
  data,
  onChange,
  onNext,
  onBack,
}) => {
  const [customExpertiseInput, setCustomExpertiseInput] = useState('');
  const [customSkillInput, setCustomSkillInput] = useState('');
  const [customIndustryInput, setCustomIndustryInput] = useState('');
  const [customLangInput, setCustomLangInput] = useState('');
  const [error, setError] = useState('');

  const toggleItem = (listKey: keyof MentorExpertise, item: string) => {
    const current = (data[listKey] as string[]) || [];
    if (current.includes(item)) {
      onChange({ ...data, [listKey]: current.filter((i) => i !== item) });
    } else {
      onChange({ ...data, [listKey]: [...current, item] });
    }
    setError('');
  };

  const addCustomItem = (
    listKey: keyof MentorExpertise,
    value: string,
    clearInput: () => void
  ) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const current = (data[listKey] as string[]) || [];
    if (current.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      setError(`"${trimmed}" is already added.`);
      return;
    }
    onChange({ ...data, [listKey]: [...current, trimmed] });
    clearInput();
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (data.expertiseAreas.length === 0) {
      setError('Please select at least one area of expertise.');
      return;
    }
    if (data.technicalSkills.length === 0) {
      setError('Please select at least one technical skill.');
      return;
    }
    if (data.languages.length === 0) {
      setError('Please add at least one language you can mentor in.');
      return;
    }
    onNext();
  };

  return (
    <div className="mob-step-container">
      <div className="mob-step-header">
        <span className="mob-step-tag">Step 4 of 6</span>
        <h2 className="mob-step-title">Expertise, Skills & Domains</h2>
        <p className="mob-step-subtitle">
          Define your core competencies so mentees seeking relevant technical or career guidance can find you.
        </p>
      </div>

      <div className="yw-alert yw-alert-info" style={{ marginBottom: '1.5rem' }}>
        <Info size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <strong>Skill Passport Standard Notice:</strong> Expertise and skills declared by mentors on this page
          reflect self-reported areas of professional coaching. Under YOGYATA's evidence model, they are treated as
          declared capabilities for coaching matches and are not presented as cryptographically verified credentials.
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mob-form">
        {error && (
          <div className="yw-alert yw-alert-danger" style={{ marginBottom: '1.25rem' }}>
            <span>{error}</span>
          </div>
        )}

        {/* Experience Level Selector */}
        <div className="yw-form-group" style={{ marginBottom: '1.75rem' }}>
          <label className="yw-form-label" htmlFor="mentor-exp-level">
            Seniority & Practice Level <span style={{ color: '#DC2626' }}>*</span>
          </label>
          <select
            id="mentor-exp-level"
            className="yw-form-select"
            value={data.experienceLevel}
            onChange={(e) =>
              onChange({
                ...data,
                experienceLevel: e.target.value as MentorExpertise['experienceLevel'],
              })
            }
          >
            <option value="Senior">Senior Practitioner (4–7 years)</option>
            <option value="Lead / Staff">Lead / Staff Specialist (7–10 years)</option>
            <option value="Principal / Director">Principal / Director / Architect (10+ years)</option>
            <option value="Executive / Founder">Executive / VP / Technical Founder</option>
          </select>
        </div>

        {/* 1. Areas of Expertise */}
        <div style={{ marginBottom: '1.75rem' }}>
          <label className="yw-form-label" style={{ display: 'block', marginBottom: '0.5rem' }}>
            Core Mentorship Domains <span style={{ color: '#DC2626' }}>*</span>{' '}
            <span style={{ color: '#64748B', fontWeight: 400 }}>(Select all that apply)</span>
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            {POPULAR_EXPERTISE_AREAS.map((area) => {
              const isSelected = data.expertiseAreas.includes(area);
              return (
                <button
                  key={area}
                  type="button"
                  onClick={() => toggleItem('expertiseAreas', area)}
                  className={`yw-btn yw-btn-sm ${isSelected ? 'yw-btn-primary' : 'yw-btn-secondary'}`}
                  style={{
                    borderRadius: '20px',
                    borderColor: isSelected ? '#1B2A4E' : '#CBD5E1',
                    background: isSelected ? '#1B2A4E' : '#FFFFFF',
                    color: isSelected ? '#FFFFFF' : '#334155',
                  }}
                >
                  {isSelected ? '✓ ' : '+ '}
                  {area}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', maxWidth: '360px' }}>
            <input
              type="text"
              className="yw-form-input"
              placeholder="Add other expertise..."
              value={customExpertiseInput}
              onChange={(e) => setCustomExpertiseInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomItem('expertiseAreas', customExpertiseInput, () => setCustomExpertiseInput(''));
                }
              }}
            />
            <button
              type="button"
              className="yw-btn yw-btn-secondary yw-btn-sm"
              onClick={() => addCustomItem('expertiseAreas', customExpertiseInput, () => setCustomExpertiseInput(''))}
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* 2. Technical Skills */}
        <div style={{ marginBottom: '1.75rem' }}>
          <label className="yw-form-label" style={{ display: 'block', marginBottom: '0.5rem' }}>
            Key Technologies & Tools <span style={{ color: '#DC2626' }}>*</span>
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            {POPULAR_TECHNICAL_SKILLS.map((skill) => {
              const isSelected = data.technicalSkills.includes(skill);
              return (
                <button
                  key={skill}
                  type="button"
                  onClick={() => toggleItem('technicalSkills', skill)}
                  className={`yw-btn yw-btn-sm ${isSelected ? 'yw-btn-primary' : 'yw-btn-secondary'}`}
                  style={{
                    borderRadius: '20px',
                    borderColor: isSelected ? '#2563EB' : '#CBD5E1',
                    background: isSelected ? '#EFF6FF' : '#FFFFFF',
                    color: isSelected ? '#1D4ED8' : '#334155',
                    fontWeight: isSelected ? 700 : 500,
                  }}
                >
                  {isSelected ? '✓ ' : '+ '}
                  {skill}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', maxWidth: '360px' }}>
            <input
              type="text"
              className="yw-form-input"
              placeholder="Add custom skill (e.g. Rust, Kafka)..."
              value={customSkillInput}
              onChange={(e) => setCustomSkillInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomItem('technicalSkills', customSkillInput, () => setCustomSkillInput(''));
                }
              }}
            />
            <button
              type="button"
              className="yw-btn yw-btn-secondary yw-btn-sm"
              onClick={() => addCustomItem('technicalSkills', customSkillInput, () => setCustomSkillInput(''))}
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* 3. Industry Experience */}
        <div style={{ marginBottom: '1.75rem' }}>
          <label className="yw-form-label" style={{ display: 'block', marginBottom: '0.5rem' }}>
            Industry Domains
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            {POPULAR_INDUSTRIES.map((ind) => {
              const isSelected = data.industries.includes(ind);
              return (
                <button
                  key={ind}
                  type="button"
                  onClick={() => toggleItem('industries', ind)}
                  className={`yw-btn yw-btn-sm ${isSelected ? 'yw-btn-primary' : 'yw-btn-secondary'}`}
                  style={{
                    borderRadius: '20px',
                    borderColor: isSelected ? '#D97706' : '#CBD5E1',
                    background: isSelected ? '#FFFBEB' : '#FFFFFF',
                    color: isSelected ? '#B45309' : '#334155',
                  }}
                >
                  {isSelected ? '✓ ' : '+ '}
                  {ind}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', maxWidth: '360px' }}>
            <input
              type="text"
              className="yw-form-input"
              placeholder="Add custom industry..."
              value={customIndustryInput}
              onChange={(e) => setCustomIndustryInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomItem('industries', customIndustryInput, () => setCustomIndustryInput(''));
                }
              }}
            />
            <button
              type="button"
              className="yw-btn yw-btn-secondary yw-btn-sm"
              onClick={() => addCustomItem('industries', customIndustryInput, () => setCustomIndustryInput(''))}
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* 4. Mentoring Languages */}
        <div style={{ marginBottom: '2rem' }}>
          <label className="yw-form-label" style={{ display: 'block', marginBottom: '0.5rem' }}>
            Languages for Mentorship Sessions <span style={{ color: '#DC2626' }}>*</span>
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            {data.languages.map((lang) => (
              <span
                key={lang}
                className="yw-badge yw-badge-blue"
                style={{
                  padding: '6px 12px',
                  borderRadius: '20px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  fontSize: '0.8125rem',
                }}
              >
                {lang}
                <button
                  type="button"
                  onClick={() => onChange({ ...data, languages: data.languages.filter((l) => l !== lang) })}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1D4ED8', padding: 0 }}
                  aria-label={`Remove ${lang}`}
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', maxWidth: '360px' }}>
            <input
              type="text"
              className="yw-form-input"
              placeholder="Add language (e.g. Hindi, Spanish)..."
              value={customLangInput}
              onChange={(e) => setCustomLangInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomItem('languages', customLangInput, () => setCustomLangInput(''));
                }
              }}
            />
            <button
              type="button"
              className="yw-btn yw-btn-secondary yw-btn-sm"
              onClick={() => addCustomItem('languages', customLangInput, () => setCustomLangInput(''))}
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        <div className="mob-actions-row">
          <button type="button" className="yw-btn yw-btn-secondary" onClick={onBack}>
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>
          <button type="submit" className="yw-btn yw-btn-primary" id="mentor-step4-continue">
            <span>Continue to Tracks</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </div>
  );
};
