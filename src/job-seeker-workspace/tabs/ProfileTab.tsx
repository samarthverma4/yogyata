import React, { useState } from 'react';
import {
  User,
  Briefcase,
  GraduationCap,
  FileText,
  Target,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  FileCode2,
} from 'lucide-react';
import type { JobSeekerProfile } from '../types';

interface ProfileTabProps {
  profile: JobSeekerProfile;
  onSaveProfile: (updated: JobSeekerProfile) => void;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
  profile,
  onSaveProfile,
}) => {
  const [formData, setFormData] = useState<JobSeekerProfile>(profile);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.fullName.trim()) errs.fullName = 'Full name is required';
    if (!formData.email.trim()) errs.email = 'Email is required';
    if (!formData.headline.trim()) errs.headline = 'Professional headline is required';
    if (!formData.careerGoals.primaryRole.trim()) errs.primaryRole = 'Target primary role is required';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      setStatusMessage({ type: 'error', text: 'Please resolve form errors before saving.' });
      return;
    }

    onSaveProfile(formData);
    setStatusMessage({ type: 'success', text: 'Candidate profile saved successfully!' });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleCancel = () => {
    setFormData(profile);
    setErrors({});
    setStatusMessage(null);
  };

  return (
    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Header with Save actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', margin: '0 0 0.25rem' }}>
            My Candidate Profile
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#64748B', margin: 0 }}>
            Manage your personal details, target roles, and employment preferences.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            className="jsw-btn jsw-btn-secondary"
            onClick={handleCancel}
          >
            <RotateCcw size={15} />
            <span>Discard Changes</span>
          </button>
          <button
            type="submit"
            className="jsw-btn jsw-btn-primary"
            id="btn-save-profile"
          >
            <Save size={15} />
            <span>Save Profile</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            fontSize: '0.875rem',
            background: statusMessage.type === 'success' ? '#ECFDF5' : '#FEF2F2',
            color: statusMessage.type === 'success' ? '#065F46' : '#991B1B',
            border: `1px solid ${statusMessage.type === 'success' ? '#A7F3D0' : '#FECACA'}`,
          }}
        >
          {statusMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* ── 1. Basic Info & Headline ── */}
      <div className="jsw-card">
        <h2 className="jsw-card-title" style={{ marginBottom: '1.25rem' }}>
          <User size={18} style={{ color: '#2563EB' }} />
          Personal &amp; Contact Details
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="prof-name">Full Name *</label>
            <input
              id="prof-name"
              type="text"
              className={`form-input ${errors.fullName ? 'has-error' : ''}`}
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            />
            {errors.fullName && <span className="form-error-msg">{errors.fullName}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="prof-email">Email (Account Display) *</label>
            <input
              id="prof-email"
              type="email"
              className={`form-input ${errors.email ? 'has-error' : ''}`}
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            {errors.email && <span className="form-error-msg">{errors.email}</span>}
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label" htmlFor="prof-headline">Professional Headline *</label>
            <input
              id="prof-headline"
              type="text"
              className={`form-input ${errors.headline ? 'has-error' : ''}`}
              placeholder="e.g. Frontend Engineer | React & TypeScript Enthusiast"
              value={formData.headline}
              onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
            />
            {errors.headline && <span className="form-error-msg">{errors.headline}</span>}
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label" htmlFor="prof-bio">Short Biography</label>
            <textarea
              id="prof-bio"
              className="form-textarea"
              rows={3}
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="prof-country">Country</label>
            <input
              id="prof-country"
              type="text"
              className="form-input"
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="prof-city">City / Region</label>
            <input
              id="prof-city"
              type="text"
              className="form-input"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* ── 2. Professional Status ── */}
      <div className="jsw-card">
        <h2 className="jsw-card-title" style={{ marginBottom: '1.25rem' }}>
          <Briefcase size={18} style={{ color: '#2563EB' }} />
          Professional Experience &amp; Current Status
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="prof-status">Current Status</label>
            <select
              id="prof-status"
              className="form-select"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            >
              <option value="actively-looking">Actively Looking for Jobs</option>
              <option value="open-to-opportunities">Open to Opportunities</option>
              <option value="employed">Employed</option>
              <option value="freelancer">Freelancer / Independent</option>
              <option value="career-switcher">Career Switcher</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="prof-exp">Experience Level</label>
            <select
              id="prof-exp"
              className="form-select"
              value={formData.experience}
              onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
            >
              <option value="fresher">Fresher / Recent Graduate (0 yrs)</option>
              <option value="less-than-1">Less than 1 year</option>
              <option value="1-2">1 - 2 years</option>
              <option value="3-5">3 - 5 years</option>
              <option value="6-10">6 - 10 years</option>
              <option value="more-than-10">10+ years</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="prof-cur-title">Current / Recent Title</label>
            <input
              id="prof-cur-title"
              type="text"
              className="form-input"
              value={formData.currentTitle}
              onChange={(e) => setFormData({ ...formData, currentTitle: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="prof-cur-company">Current / Recent Company</label>
            <input
              id="prof-cur-company"
              type="text"
              className="form-input"
              value={formData.currentCompany}
              onChange={(e) => setFormData({ ...formData, currentCompany: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* ── 3. Education ── */}
      <div className="jsw-card">
        <h2 className="jsw-card-title" style={{ marginBottom: '1.25rem' }}>
          <GraduationCap size={18} style={{ color: '#2563EB' }} />
          Education
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="prof-degree">Degree / Qualification</label>
            <input
              id="prof-degree"
              type="text"
              className="form-input"
              placeholder="e.g. Bachelor of Technology"
              value={formData.education.degree}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  education: { ...formData.education, degree: e.target.value },
                })
              }
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="prof-field">Field of Study</label>
            <input
              id="prof-field"
              type="text"
              className="form-input"
              placeholder="e.g. Computer Science & Engineering"
              value={formData.education.fieldOfStudy}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  education: { ...formData.education, fieldOfStudy: e.target.value },
                })
              }
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="prof-inst">Institution / University</label>
            <input
              id="prof-inst"
              type="text"
              className="form-input"
              placeholder="e.g. National Institute of Technology"
              value={formData.education.institution}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  education: { ...formData.education, institution: e.target.value },
                })
              }
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="prof-grad-year">Graduation Year</label>
            <input
              id="prof-grad-year"
              type="text"
              className="form-input"
              placeholder="e.g. 2025"
              value={formData.education.graduationYear}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  education: { ...formData.education, graduationYear: e.target.value },
                })
              }
            />
          </div>
        </div>
      </div>

      {/* ── 4. Resume & Document Metadata ── */}
      <div className="jsw-card">
        <h2 className="jsw-card-title" style={{ marginBottom: '1.25rem' }}>
          <FileText size={18} style={{ color: '#2563EB' }} />
          Resume Information
        </h2>

        {formData.resumeFile ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <FileCode2 size={24} style={{ color: '#2563EB' }} />
              <div>
                <strong style={{ fontSize: '0.875rem', color: '#0F172A' }}>{formData.resumeFile.name}</strong>
                <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                  {(formData.resumeFile.sizeBytes / 1024).toFixed(0)} KB • Recorded on {formData.resumeFile.uploadedAt}
                </div>
              </div>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#059669', background: '#ECFDF5', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
              Attached to Profile
            </span>
          </div>
        ) : (
          <div style={{ padding: '1rem', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#64748B', fontSize: '0.875rem' }}>
            No resume file metadata attached yet.
          </div>
        )}

        <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#64748B', lineHeight: 1.4 }}>
          <em>Note:</em> YOGYATA stores client-side resume metadata in this prototype. Skills in your Skill Passport require direct assessment or verified evidence rather than resume parsing.
        </div>
      </div>

      {/* ── 5. Target Career Goals & Preferences ── */}
      <div className="jsw-card">
        <h2 className="jsw-card-title" style={{ marginBottom: '1.25rem' }}>
          <Target size={18} style={{ color: '#2563EB' }} />
          Career Goals &amp; Target Roles
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="prof-primary-role">Primary Target Role *</label>
            <input
              id="prof-primary-role"
              type="text"
              className={`form-input ${errors.primaryRole ? 'has-error' : ''}`}
              placeholder="e.g. Frontend Engineer"
              value={formData.careerGoals.primaryRole}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  careerGoals: { ...formData.careerGoals, primaryRole: e.target.value },
                })
              }
            />
            {errors.primaryRole && <span className="form-error-msg">{errors.primaryRole}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="prof-exp-salary">Expected Compensation</label>
            <input
              id="prof-exp-salary"
              type="text"
              className="form-input"
              placeholder="e.g. ₹12 - 16 LPA"
              value={formData.jobPrefs.expectedSalary}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  jobPrefs: { ...formData.jobPrefs, expectedSalary: e.target.value },
                })
              }
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="prof-notice">Notice Period</label>
            <input
              id="prof-notice"
              type="text"
              className="form-input"
              placeholder="e.g. Immediate / 15 Days"
              value={formData.jobPrefs.noticePeriod}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  jobPrefs: { ...formData.jobPrefs, noticePeriod: e.target.value },
                })
              }
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="prof-avail">Availability</label>
            <select
              id="prof-avail"
              className="form-select"
              value={formData.jobPrefs.availability}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  jobPrefs: { ...formData.jobPrefs, availability: e.target.value },
                })
              }
            >
              <option value="immediately">Immediately</option>
              <option value="within-30">Within 30 Days</option>
              <option value="within-60">Within 60 Days</option>
              <option value="flexible">Flexible</option>
            </select>
          </div>
        </div>
      </div>
    </form>
  );
};
