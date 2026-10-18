import React, { useState } from 'react';
import {
  Building2,
  Globe,
  MapPin,
  Layers,
  Save,
  RotateCcw,
  Sparkles,
  Check,
  ExternalLink,
} from 'lucide-react';
import type { CompanyProfile } from '../../recruiter-onboarding/types';
import { POPULAR_HIRING_DOMAINS } from '../../recruiter-onboarding/types';
import { sanitizeRecruiterUrl } from '../../recruiter-onboarding/storage';

interface CompanyTabProps {
  company: CompanyProfile;
  onSaveCompany: (updated: CompanyProfile) => void;
}

export const CompanyTab: React.FC<CompanyTabProps> = ({
  company,
  onSaveCompany,
}) => {
  const [formData, setFormData] = useState<CompanyProfile>(company);
  const [customDomainInput, setCustomDomainInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!formData.companyName.trim()) {
      errs.companyName = 'Company name is required';
    }

    if (!formData.website.trim()) {
      errs.website = 'Company website is required';
    } else {
      const sanitized = sanitizeRecruiterUrl(formData.website);
      if (!sanitized) {
        errs.website = 'Please provide a valid website URL';
      }
    }

    if (!formData.description.trim()) {
      errs.description = 'Company description is required';
    }

    if (!formData.location.trim()) {
      errs.location = 'Primary location is required';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    onSaveCompany({
      ...formData,
      website: sanitizeRecruiterUrl(formData.website),
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleReset = () => {
    setFormData(company);
    setErrors({});
  };

  const toggleDomain = (domain: string) => {
    const current = formData.hiringDomains || [];
    const exists = current.includes(domain);
    const updated = exists ? current.filter((d) => d !== domain) : [...current, domain];
    setFormData({ ...formData, hiringDomains: updated });
  };

  const handleAddCustomDomain = () => {
    const trimmed = customDomainInput.trim();
    if (!trimmed) return;
    const current = formData.hiringDomains || [];
    if (!current.includes(trimmed)) {
      setFormData({ ...formData, hiringDomains: [...current, trimmed] });
    }
    setCustomDomainInput('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-navy)' }}>
          Company &amp; Organization Profile
        </h2>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
          Manage your company information, hiring domains, and team culture visible to candidates.
        </p>
      </div>

      {saveSuccess && (
        <div
          style={{
            background: '#F0FDF4',
            border: '1px solid #BBF7D0',
            color: '#15803D',
            padding: '0.625rem 1rem',
            borderRadius: 0,
            fontSize: '0.8125rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Check size={16} />
          <span>Company profile updated successfully and synchronized with your workspace.</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', alignItems: 'flex-start' }}>
        {/* Form Container */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid var(--color-border)',
            borderRadius: 0,
            padding: '1.5rem',
          }}
        >
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label className="form-label">
                Company Name <span className="required-star">*</span>
              </label>
              <div className="input-with-icon">
                <Building2 size={18} className="input-icon" />
                <input
                  type="text"
                  className={`form-input ${errors.companyName ? 'has-error' : ''}`}
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                />
              </div>
              {errors.companyName && <p className="form-error-msg">{errors.companyName}</p>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Industry Sector</label>
                <select
                  className="form-input"
                  value={formData.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                >
                  <option value="Technology / SaaS">Enterprise SaaS</option>
                  <option value="Fintech & Payments">Fintech &amp; Banking</option>
                  <option value="Artificial Intelligence / ML">AI &amp; Machine Learning</option>
                  <option value="Healthcare & Healthtech">Healthtech</option>
                  <option value="E-Commerce & Retail">E-Commerce</option>
                  <option value="EdTech & Talent">EdTech</option>
                  <option value="DeepTech / Robotics">DeepTech</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Company Size</label>
                <select
                  className="form-input"
                  value={formData.companySize}
                  onChange={(e) => setFormData({ ...formData, companySize: e.target.value })}
                >
                  <option value="1-10 employees">1 - 10 employees</option>
                  <option value="11-50 employees">11 - 50 employees</option>
                  <option value="51-200 employees">51 - 200 employees</option>
                  <option value="201-500 employees">201 - 500 employees</option>
                  <option value="500+ employees">500+ employees</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">
                  Website URL <span className="required-star">*</span>
                </label>
                <div className="input-with-icon">
                  <Globe size={18} className="input-icon" />
                  <input
                    type="url"
                    className={`form-input ${errors.website ? 'has-error' : ''}`}
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  />
                </div>
                {errors.website && <p className="form-error-msg">{errors.website}</p>}
              </div>

              <div className="form-group">
                <label className="form-label">
                  Location <span className="required-star">*</span>
                </label>
                <div className="input-with-icon">
                  <MapPin size={18} className="input-icon" />
                  <input
                    type="text"
                    className={`form-input ${errors.location ? 'has-error' : ''}`}
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>
                {errors.location && <p className="form-error-msg">{errors.location}</p>}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Funding Stage</label>
              <select
                className="form-input"
                value={formData.companyStage}
                onChange={(e) => setFormData({ ...formData, companyStage: e.target.value })}
              >
                <option value="Bootstrapped / Self-Funded">Bootstrapped / Self-Funded</option>
                <option value="Seed / Pre-Series A">Seed / Pre-Series A</option>
                <option value="Series A / Growth">Series A / Growth</option>
                <option value="Series B+ / Late Stage">Series B+ / Late Stage</option>
                <option value="Public Company / Global Enterprise">Public Company / Global Enterprise</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">
                Company Description &amp; Mission <span className="required-star">*</span>
              </label>
              <textarea
                rows={3}
                className={`form-input ${errors.description ? 'has-error' : ''}`}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                style={{ resize: 'vertical' }}
              />
              {errors.description && <p className="form-error-msg">{errors.description}</p>}
            </div>

            <div className="form-group">
              <label className="form-label">Engineering Culture &amp; Environment</label>
              <textarea
                rows={2}
                className="form-input"
                placeholder="Describe your work arrangement, autonomy, tooling stack, and engineering culture..."
                value={formData.workCultureSummary || ''}
                onChange={(e) => setFormData({ ...formData, workCultureSummary: e.target.value })}
                style={{ resize: 'vertical' }}
              />
            </div>

            {/* Hiring Domains */}
            <div className="form-group">
              <label className="form-label">Active Hiring Domains</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.625rem' }}>
                {POPULAR_HIRING_DOMAINS.map((domain) => {
                  const selected = (formData.hiringDomains || []).includes(domain);
                  return (
                    <button
                      key={domain}
                      type="button"
                      onClick={() => toggleDomain(domain)}
                      style={{
                        padding: '0.25rem 0.6rem',
                        borderRadius: 0,
                        fontSize: '0.75rem',
                        border: selected ? '1px solid #16A34A' : '1px solid var(--color-border-hover)',
                        background: selected ? '#F0FDF4' : '#FFFFFF',
                        color: selected ? '#15803D' : 'var(--color-text-muted)',
                        fontWeight: selected ? 600 : 400,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      {selected && <Check size={12} />}
                      {domain}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', maxWidth: '340px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Add custom domain..."
                  value={customDomainInput}
                  onChange={(e) => setCustomDomainInput(e.target.value)}
                  style={{ fontSize: '0.78rem' }}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleAddCustomDomain}
                  style={{ fontSize: '0.78rem' }}
                >
                  Add
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleReset}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <RotateCcw size={14} /> Revert
              </button>
              <button
                type="submit"
                className="btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: '#15803D', borderColor: '#15803D' }}
              >
                <Save size={15} /> Save Changes
              </button>
            </div>
          </form>
        </div>

        {/* Live Preview Card */}
        <div
          style={{
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 0,
            padding: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--color-navy)', fontWeight: 600, fontSize: '0.84rem' }}>
            <Sparkles size={16} style={{ color: 'var(--color-blue)' }} />
            <span>Candidate-Facing Company Preview</span>
          </div>

          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid var(--color-border)',
              borderRadius: 0,
              padding: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: 0,
                  background: '#F0FDF4',
                  color: '#15803D',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Building2 size={22} />
              </div>
              <div>
                <strong style={{ fontSize: '1.05rem', color: 'var(--color-navy)' }}>
                  {formData.companyName || 'Your Company'}
                </strong>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  {formData.industry} • {formData.companySize}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                <MapPin size={12} /> {formData.location || 'Location'}
              </span>
              <span>•</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                <Layers size={12} /> {formData.companyStage}
              </span>
            </div>

            <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--color-navy)', lineHeight: 1.45 }}>
              {formData.description || 'Company description will appear here...'}
            </p>

            {formData.workCultureSummary && (
              <div
                style={{
                  background: 'var(--color-bg)',
                  borderLeft: '3px solid var(--color-blue)',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0 4px 4px 0',
                  fontSize: '0.75rem',
                  color: 'var(--color-text-muted)',
                  marginBottom: '0.75rem',
                  lineHeight: 1.4,
                }}
              >
                <strong>Engineering Culture:</strong> {formData.workCultureSummary}
              </div>
            )}

            <div>
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                Hiring For:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {(formData.hiringDomains || []).map((d) => (
                  <span
                    key={d}
                    style={{
                      background: '#F0FDF4',
                      color: '#15803D',
                      border: '1px solid #BBF7D0',
                      padding: '0.15rem 0.5rem',
                      borderRadius: 0,
                      fontSize: '0.72rem',
                      fontWeight: 500,
                    }}
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>

            {formData.website && (
              <div style={{ marginTop: '1rem', borderTop: '1px solid var(--color-surface-2)', paddingTop: '0.75rem' }}>
                <a
                  href={formData.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--color-blue)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontWeight: 500,
                  }}
                >
                  <span>Visit Company Website</span>
                  <ExternalLink size={11} />
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
