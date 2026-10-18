import React, { useState } from 'react';
import type { MentorshipPreferences, SessionFormat, SessionFrequency, PricingModel } from '../types';
import { AVAILABLE_MENTORSHIP_TRACKS } from '../types';
import { ArrowLeft, ArrowRight, Check, Compass, DollarSign } from 'lucide-react';

interface MentorshipTracksStepProps {
  data: MentorshipPreferences;
  onChange: (data: MentorshipPreferences) => void;
  onNext: () => void;
  onBack: () => void;
}

export const MentorshipTracksStep: React.FC<MentorshipTracksStepProps> = ({
  data,
  onChange,
  onNext,
  onBack,
}) => {
  const [error, setError] = useState('');

  const toggleTrack = (title: string) => {
    const current = data.selectedTracks;
    if (current.includes(title)) {
      onChange({ ...data, selectedTracks: current.filter((t) => t !== title) });
    } else {
      onChange({ ...data, selectedTracks: [...current, title] });
    }
    setError('');
  };

  const toggleLevel = (level: 'Beginner' | 'Intermediate' | 'Advanced') => {
    const current = data.preferredMenteeLevels;
    if (current.includes(level)) {
      if (current.length === 1) return; // Keep at least one
      onChange({ ...data, preferredMenteeLevels: current.filter((l) => l !== level) });
    } else {
      onChange({ ...data, preferredMenteeLevels: [...current, level] });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (data.selectedTracks.length === 0) {
      setError('Please select at least one mentorship track you wish to offer.');
      return;
    }
    if (data.weeklyAvailabilityHours <= 0) {
      setError('Please specify your weekly availability (at least 1 hour).');
      return;
    }
    if (data.maxActiveMentees <= 0) {
      setError('Please specify your maximum mentee capacity.');
      return;
    }
    onNext();
  };

  return (
    <div className="mob-step-container">
      <div className="mob-step-header">
        <span className="mob-step-tag">Step 5 of 6</span>
        <h2 className="mob-step-title">Mentorship Tracks & Availability</h2>
        <p className="mob-step-subtitle">
          Specify your coaching offerings, schedule parameters, and mentee cohort preferences.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mob-form">
        {error && (
          <div className="yw-alert yw-alert-danger" style={{ marginBottom: '1.25rem' }}>
            <span>{error}</span>
          </div>
        )}

        {/* Tracks Selection Grid */}
        <div style={{ marginBottom: '2rem' }}>
          <label className="yw-form-label" style={{ display: 'block', marginBottom: '0.625rem' }}>
            Select Mentorship Tracks <span style={{ color: '#DC2626' }}>*</span>{' '}
            <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(Choose one or more)</span>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.875rem' }}>
            {AVAILABLE_MENTORSHIP_TRACKS.map((track) => {
              const isSelected = data.selectedTracks.includes(track.title);
              return (
                <div
                  key={track.id}
                  onClick={() => toggleTrack(track.title)}
                  style={{
                    background: isSelected ? '#F0FDF4' : '#FFFFFF',
                    border: `1.5px solid ${isSelected ? '#16A34A' : 'var(--color-border)'}`,
                    borderRadius: 0,
                    padding: '1rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 2px 8px rgba(22, 163, 74, 0.12)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: isSelected ? '#166534' : 'var(--color-navy)' }}>
                        {track.title}
                      </span>
                      <div
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          background: isSelected ? '#16A34A' : 'var(--color-surface-2)',
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                        }}
                      >
                        {isSelected && <Check size={13} strokeWidth={3} />}
                      </div>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
                      {track.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cohort & Schedule Controls */}
        <div className="yw-card" style={{ padding: '1.25rem', marginBottom: '1.5rem', background: 'var(--color-bg)' }}>
          <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-navy)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Compass size={18} color="var(--color-blue)" />
            Session Preferences & Capacity
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            {/* Preferred Mentee Level */}
            <div>
              <label className="yw-form-label" style={{ marginBottom: '0.375rem' }}>
                Preferred Mentee Level
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {(['Beginner', 'Intermediate', 'Advanced'] as const).map((lvl) => {
                  const isChecked = data.preferredMenteeLevels.includes(lvl);
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => toggleLevel(lvl)}
                      className={`yw-btn yw-btn-sm ${isChecked ? 'yw-btn-primary' : 'yw-btn-secondary'}`}
                      style={{ fontSize: '0.78rem' }}
                    >
                      {isChecked ? '✓ ' : ''}{lvl}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Session Format */}
            <div className="yw-form-group">
              <label className="yw-form-label" htmlFor="mentor-format">
                Session Format
              </label>
              <select
                id="mentor-format"
                className="yw-form-select"
                value={data.sessionFormat}
                onChange={(e) => onChange({ ...data, sessionFormat: e.target.value as SessionFormat })}
              >
                <option value="online">Online Video & Screen-Share</option>
                <option value="flexible">Flexible (Video + Async Review)</option>
              </select>
            </div>

            {/* Session Duration */}
            <div className="yw-form-group">
              <label className="yw-form-label" htmlFor="mentor-duration">
                Session Duration
              </label>
              <select
                id="mentor-duration"
                className="yw-form-select"
                value={data.sessionDurationMinutes}
                onChange={(e) => onChange({ ...data, sessionDurationMinutes: Number(e.target.value) })}
              >
                <option value={30}>30 Minutes</option>
                <option value={45}>45 Minutes (Recommended)</option>
                <option value={60}>60 Minutes</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            {/* Frequency */}
            <div className="yw-form-group">
              <label className="yw-form-label" htmlFor="mentor-frequency">
                Meeting Frequency
              </label>
              <select
                id="mentor-frequency"
                className="yw-form-select"
                value={data.sessionFrequency}
                onChange={(e) => onChange({ ...data, sessionFrequency: e.target.value as SessionFrequency })}
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly (Every 2 weeks)</option>
                <option value="monthly">Monthly</option>
                <option value="as-needed">As Needed / Milestone-based</option>
              </select>
            </div>

            {/* Weekly Availability */}
            <div className="yw-form-group">
              <label className="yw-form-label" htmlFor="mentor-hours">
                Weekly Availability (Hours) <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <input
                id="mentor-hours"
                type="number"
                min={1}
                max={40}
                className="yw-form-input"
                value={data.weeklyAvailabilityHours}
                onChange={(e) => onChange({ ...data, weeklyAvailabilityHours: Math.max(1, Number(e.target.value)) })}
              />
            </div>

            {/* Max Mentees */}
            <div className="yw-form-group">
              <label className="yw-form-label" htmlFor="mentor-max-mentees">
                Max Active Mentees <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <input
                id="mentor-max-mentees"
                type="number"
                min={1}
                max={15}
                className="yw-form-input"
                value={data.maxActiveMentees}
                onChange={(e) => onChange({ ...data, maxActiveMentees: Math.max(1, Number(e.target.value)) })}
              />
            </div>
          </div>
        </div>

        {/* Pricing / Community Mentorship Preference */}
        <div className="yw-card" style={{ padding: '1.25rem', marginBottom: '2rem' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-navy)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <DollarSign size={18} color="#D97706" />
            Mentorship Model
          </h4>
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            YOGYATA prioritizes accessible talent development. Choose your preferred engagement model:
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            {[
              {
                id: 'free',
                title: 'Community / Free Mentorship',
                desc: 'Support aspiring talent as an ecosystem give-back. Highly recommended for early builders.',
              },
              {
                id: 'selective-scholarship',
                title: 'Selective Scholarship Model',
                desc: 'Free for verified underrepresented talent, optional compensation for commercial tracks.',
              },
              {
                id: 'paid',
                title: 'Professional Paid Coaching',
                desc: 'Structured professional consulting & executive advisory.',
              },
            ].map((m) => {
              const isSelected = data.pricingModel === m.id;
              return (
                <div
                  key={m.id}
                  onClick={() => onChange({ ...data, pricingModel: m.id as PricingModel })}
                  style={{
                    border: `1.5px solid ${isSelected ? '#D97706' : 'var(--color-border)'}`,
                    background: isSelected ? '#FFFBEB' : '#FFFFFF',
                    borderRadius: 0,
                    padding: '0.875rem',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: isSelected ? '#92400E' : 'var(--color-navy)', marginBottom: '0.25rem' }}>
                    {m.title}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                    {m.desc}
                  </p>
                </div>
              );
            })}
          </div>

          {data.pricingModel === 'paid' && (
            <div className="yw-form-group" style={{ marginTop: '1rem', maxWidth: '280px' }}>
              <label className="yw-form-label" htmlFor="mentor-rate">
                Target Rate (USD / Session)
              </label>
              <input
                id="mentor-rate"
                type="text"
                className="yw-form-input"
                placeholder="e.g. $75 / 45-min"
                value={data.hourlyRate || ''}
                onChange={(e) => onChange({ ...data, hourlyRate: e.target.value })}
              />
            </div>
          )}
        </div>

        <div className="mob-actions-row">
          <button type="button" className="yw-btn yw-btn-secondary" onClick={onBack}>
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>
          <button type="submit" className="yw-btn yw-btn-primary" id="mentor-step5-continue">
            <span>Continue to Review</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </div>
  );
};
