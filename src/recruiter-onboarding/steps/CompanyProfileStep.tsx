import React, { useState } from 'react';
import {
  Building2,
  Globe,
  MapPin,
  Users,
  Layers,
  ArrowRight,
  ArrowLeft,
  Check,
  Plus,
} from 'lucide-react';
import type { CompanyProfile } from '../types';
import { POPULAR_HIRING_DOMAINS } from '../types';
import { sanitizeRecruiterUrl } from '../storage';

interface CompanyProfileStepProps {
  data: CompanyProfile;
  onChange: (data: Partial<CompanyProfile>) => void;
  onNext: () => void;
  onBack: () => void;
}

export const CompanyProfileStep: React.FC<CompanyProfileStepProps> = ({
  data,
  onChange,
  onNext,
  onBack,
}) => {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [customDomainInput, setCustomDomainInput] = useState('');

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!data.companyName.trim()) {
      errs.companyName = 'Company name is required';
    }

    if (!data.website.trim()) {
      errs.website = 'Company website is required';
    } else {
      const sanitized = sanitizeRecruiterUrl(data.website);
      if (!sanitized) {
        errs.website = 'Please provide a valid website URL';
      }
    }

    if (!data.description.trim()) {
      errs.description = 'Company description is required';
    } else if (data.description.trim().length < 30) {
      errs.description = 'Description should be at least 30 characters';
    }

    if (!data.location.trim()) {
      errs.location = 'Primary location is required';
    }

    if (!data.hiringDomains || data.hiringDomains.length === 0) {
      errs.hiringDomains = 'Select at least one hiring domain';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const toggleDomain = (domain: string) => {
    const current = data.hiringDomains || [];
    const exists = current.includes(domain);
    const updated = exists ? current.filter((d) => d !== domain) : [...current, domain];
    onChange({ hiringDomains: updated });
    if (errors.hiringDomains) setErrors((prev) => ({ ...prev, hiringDomains: '' }));
  };

  const handleAddCustomDomain = () => {
    const trimmed = customDomainInput.trim();
    if (!trimmed) return;
    const current = data.hiringDomains || [];
    if (!current.includes(trimmed)) {
      onChange({ hiringDomains: [...current, trimmed] });
    }
    setCustomDomainInput('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onNext();
    }
  };

  return (
    <div className="founder-step-card">
      <div className="founder-step-header">
        <h2 className="founder-step-title">Company Profile</h2>
        <p className="founder-step-subtitle">
          Define your organization, industry, and hiring domains for prospective talent.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {/* Company Name */}
        <div className="form-group">
          <label htmlFor="company-name" className="form-label">
            Company / Organization Name <span className="required-star">*</span>
          </label>
          <div className="input-with-icon">
            <Building2 size={18} className="input-icon" />
            <input
              id="company-name"
              type="text"
              className={`form-input ${errors.companyName ? 'has-error' : ''}`}
              placeholder="e.g. HyperScale Tech Labs"
              value={data.companyName}
              onChange={(e) => {
                onChange({ companyName: e.target.value });
                if (errors.companyName) setErrors((prev) => ({ ...prev, companyName: '' }));
              }}
            />
          </div>
          {errors.companyName && <p className="form-error-msg">{errors.companyName}</p>}
        </div>

        {/* Industry & Company Size */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          <div className="form-group">
            <label htmlFor="company-industry" className="form-label">
              Industry Sector <span className="required-star">*</span>
            </label>
            <select
              id="company-industry"
              className="form-input"
              value={data.industry}
              onChange={(e) => onChange({ industry: e.target.value })}
            >
              <option value="Technology / SaaS">Enterprise SaaS &amp; Cloud</option>
              <option value="Fintech & Payments">Fintech, Banking &amp; Payments</option>
              <option value="Artificial Intelligence / ML">AI / Machine Learning</option>
              <option value="Healthcare & Healthtech">Healthcare &amp; Medtech</option>
              <option value="E-Commerce & Retail">E-Commerce &amp; Consumer Tech</option>
              <option value="EdTech & Talent">EdTech &amp; Talent Ecosystems</option>
              <option value="DeepTech / Robotics">DeepTech &amp; Hardware</option>
              <option value="Other">Other Specialized Sector</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="company-size" className="form-label">
              Company Size <span className="required-star">*</span>
            </label>
            <div className="input-with-icon">
              <Users size={18} className="input-icon" />
              <select
                id="company-size"
                className="form-input"
                value={data.companySize}
                onChange={(e) => onChange({ companySize: e.target.value })}
              >
                <option value="1-10 employees">1 - 10 employees (Early Stage)</option>
                <option value="11-50 employees">11 - 50 employees (Growing)</option>
                <option value="51-200 employees">51 - 200 employees (Scaleup)</option>
                <option value="201-500 employees">201 - 500 employees (Mid-Market)</option>
                <option value="500+ employees">500+ employees (Enterprise)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Website & Location */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          <div className="form-group">
            <label htmlFor="company-website" className="form-label">
              Company Website <span className="required-star">*</span>
            </label>
            <div className="input-with-icon">
              <Globe size={18} className="input-icon" />
              <input
                id="company-website"
                type="url"
                className={`form-input ${errors.website ? 'has-error' : ''}`}
                placeholder="https://acmecorp.com"
                value={data.website}
                onChange={(e) => {
                  onChange({ website: e.target.value });
                  if (errors.website) setErrors((prev) => ({ ...prev, website: '' }));
                }}
              />
            </div>
            {errors.website && <p className="form-error-msg">{errors.website}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="company-location" className="form-label">
              Headquarters / Primary Location <span className="required-star">*</span>
            </label>
            <div className="input-with-icon">
              <MapPin size={18} className="input-icon" />
              <input
                id="company-location"
                type="text"
                className={`form-input ${errors.location ? 'has-error' : ''}`}
                placeholder="e.g. Bengaluru, India (Hybrid)"
                value={data.location}
                onChange={(e) => {
                  onChange({ location: e.target.value });
                  if (errors.location) setErrors((prev) => ({ ...prev, location: '' }));
                }}
              />
            </div>
            {errors.location && <p className="form-error-msg">{errors.location}</p>}
          </div>
        </div>

        {/* Company Stage */}
        <div className="form-group">
          <label htmlFor="company-stage" className="form-label">
            Funding Stage / Maturity <span className="required-star">*</span>
          </label>
          <div className="input-with-icon">
            <Layers size={18} className="input-icon" />
            <select
              id="company-stage"
              className="form-input"
              value={data.companyStage}
              onChange={(e) => onChange({ companyStage: e.target.value })}
            >
              <option value="Bootstrapped / Self-Funded">Bootstrapped / Self-Funded</option>
              <option value="Seed / Pre-Series A">Seed / Pre-Series A</option>
              <option value="Series A / Growth">Series A / Growth</option>
              <option value="Series B+ / Late Stage">Series B+ / Late Stage</option>
              <option value="Public Company / Global Enterprise">Public Company / Global Enterprise</option>
            </select>
          </div>
        </div>

        {/* Company Description */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label htmlFor="company-description" className="form-label">
              Company Description &amp; Mission <span className="required-star">*</span>
            </label>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)' }}>
              {data.description.length}/600 chars
            </span>
          </div>
          <textarea
            id="company-description"
            rows={3}
            maxLength={600}
            className={`form-input ${errors.description ? 'has-error' : ''}`}
            placeholder="Describe what your company builds, the market problem you solve, and what makes your engineering team unique..."
            value={data.description}
            onChange={(e) => {
              onChange({ description: e.target.value });
              if (errors.description) setErrors((prev) => ({ ...prev, description: '' }));
            }}
            style={{ resize: 'vertical' }}
          />
          {errors.description && <p className="form-error-msg">{errors.description}</p>}
        </div>

        {/* Hiring Domains Chips */}
        <div className="form-group">
          <label className="form-label">
            Primary Hiring Domains <span className="required-star">*</span>
          </label>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: '0 0 0.75rem' }}>
            Select the engineering and product domains your team hires for:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {POPULAR_HIRING_DOMAINS.map((domain) => {
              const selected = (data.hiringDomains || []).includes(domain);
              return (
                <button
                  key={domain}
                  type="button"
                  onClick={() => toggleDomain(domain)}
                  className={`skill-chip ${selected ? 'is-selected' : ''}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '20px',
                    fontSize: '0.8125rem',
                    border: selected ? '1px solid #16A34A' : '1px solid var(--color-border)',
                    background: selected ? '#F0FDF4' : 'var(--color-surface)',
                    color: selected ? '#15803D' : 'var(--color-text-primary)',
                    cursor: 'pointer',
                    fontWeight: selected ? 600 : 400,
                  }}
                >
                  {selected && <Check size={14} />}
                  {domain}
                </button>
              );
            })}
          </div>

          {/* Add custom domain */}
          <div style={{ display: 'flex', gap: '0.5rem', maxWidth: '380px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Add other domain (e.g. Embedded Firmware)"
              value={customDomainInput}
              onChange={(e) => setCustomDomainInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCustomDomain();
                }
              }}
              style={{ fontSize: '0.8125rem' }}
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={handleAddCustomDomain}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8125rem' }}
            >
              <Plus size={14} /> Add
            </button>
          </div>
          {errors.hiringDomains && <p className="form-error-msg">{errors.hiringDomains}</p>}
        </div>

        {/* Navigation Actions */}
        <div className="founder-step-actions" style={{ marginTop: '2rem' }}>
          <button type="button" className="btn-secondary" onClick={onBack}>
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>
          <button type="submit" className="btn-primary" style={{ minWidth: '180px' }}>
            <span>Hiring Preferences</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </div>
  );
};
