import React, { useCallback, useRef, useState } from 'react';
import type { ResumeSkillsData, DeclaredSkill } from '../types';
import {
  StepWrapper, StepHeader, FormNav, InfoNotice,
} from '../shared';
import { Upload, X, FileText, Plus, Pencil, Check } from 'lucide-react';

const MAX_SIZE_MB = 5;
const ALLOWED_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const ALLOWED_EXTS = ['.pdf', '.docx'];

const SKILL_CATEGORIES = [
  'Programming', 'Design', 'Data & Analytics', 'Marketing',
  'Project Management', 'Communication', 'Finance', 'Operations', 'Other',
];

let skillIdCounter = 1;

interface ResumeSkillsStepProps {
  data: ResumeSkillsData;
  onChange: (d: ResumeSkillsData) => void;
  onNext: () => void;
  onBack: () => void;
}

export const ResumeSkillsStep: React.FC<ResumeSkillsStepProps> = ({
  data,
  onChange,
  onNext,
  onBack,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState('');
  const [skillInput, setSkillInput] = useState('');
  const [skillCategory, setSkillCategory] = useState(SKILL_CATEGORIES[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // ── File Handling ──────────────────────────────────────────────────────────

  const processFile = useCallback(
    (file: File) => {
      setFileError('');
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTS.includes(ext)) {
        setFileError('Unsupported file format. Please upload a PDF or DOCX file.');
        return;
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setFileError(`File too large. Maximum size is ${MAX_SIZE_MB} MB.`);
        return;
      }
      onChange({
        ...data,
        resumeFile: { name: file.name, sizeBytes: file.size, type: file.type },
      });
    },
    [data, onChange]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleRemoveResume = () => {
    onChange({ ...data, resumeFile: null });
    setFileError('');
  };

  // ── Skill Management ───────────────────────────────────────────────────────

  const addSkill = () => {
    const name = skillInput.trim();
    if (!name) return;
    if (data.skills.some((s) => s.name.toLowerCase() === name.toLowerCase())) return;
    const skill: DeclaredSkill = {
      id: `skill-${skillIdCounter++}`,
      name,
      category: skillCategory,
    };
    onChange({ ...data, skills: [...data.skills, skill] });
    setSkillInput('');
  };

  const removeSkill = (id: string) => {
    onChange({ ...data, skills: data.skills.filter((s) => s.id !== id) });
  };

  const startEdit = (skill: DeclaredSkill) => {
    setEditingId(skill.id);
    setEditValue(skill.name);
  };

  const saveEdit = (id: string) => {
    const name = editValue.trim();
    if (!name) return;
    onChange({
      ...data,
      skills: data.skills.map((s) => (s.id === id ? { ...s, name } : s)),
    });
    setEditingId(null);
    setEditValue('');
  };

  const formatBytes = (bytes: number) => {
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(0)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  return (
    <StepWrapper>
      <StepHeader
        eyebrow="Step 3 of 5 — Resume & Skills"
        heading="Let your experience speak."
        subheading="Upload your resume or build your professional profile manually."
      />

      {/* ── Resume Upload ── */}
      <div className="ob-section-box">
        <div className="ob-section-box-header">
          <div className="ob-section-box-title-group">
            <div className="ob-icon-badge">
              <FileText size={18} />
            </div>
            <div>
              <h2 className="ob-section-box-title">Resume Upload</h2>
              <p className="ob-section-box-sub">Drop your resume to auto-fill experience (PDF or DOCX, max {MAX_SIZE_MB} MB)</p>
            </div>
          </div>
          <span className="ob-pill-badge">Optional</span>
        </div>

        {!data.resumeFile ? (
          <div
            className={`ob-dropzone ${isDragging ? 'is-dragging' : ''} ${fileError ? 'has-error' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            role="button"
            tabIndex={0}
            aria-label="Upload resume file — drop here or click to browse"
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
            onClick={() => fileInputRef.current?.click()}
            style={{
              borderRadius: '16px',
              padding: '36px 24px',
              border: '2px dashed #CBD5E1',
              background: '#F8FAFD',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <div className="ob-dropzone-icon" aria-hidden="true" style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#EEF4FF', color: '#3559DF', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px', border: '1px solid #D2E0FF' }}>
              <Upload size={26} />
            </div>
            <p className="ob-dropzone-title" style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F1A44', marginBottom: '4px' }}>
              Drag & drop your resume here
            </p>
            <p className="ob-dropzone-sub" style={{ fontSize: '0.88rem', color: '#64748B', marginBottom: '8px' }}>
              or click to browse from your computer
            </p>
            <p className="ob-dropzone-meta" style={{ fontSize: '0.78rem', color: '#94A3B8', marginBottom: '16px' }}>
              Supported formats: PDF, DOCX (Max {MAX_SIZE_MB} MB)
            </p>
            <button
              type="button"
              className="ob-btn-secondary ob-dropzone-browse"
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              style={{ borderRadius: '10px', fontWeight: 600 }}
            >
              Select file
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="ob-file-input-hidden"
              onChange={handleFileChange}
              aria-hidden="true"
              tabIndex={-1}
            />
          </div>
        ) : (
          <div className="ob-file-preview" style={{ borderRadius: '14px', border: '1.5px solid #CBD5E1', padding: '16px 20px', background: '#F8FAFD' }}>
            <div className="ob-file-preview-icon" aria-hidden="true" style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#EEF4FF', color: '#3559DF' }}>
              <FileText size={22} />
            </div>
            <div className="ob-file-preview-info">
              <p className="ob-file-preview-name" style={{ fontSize: '0.96rem', fontWeight: 700, color: '#0F1A44' }}>{data.resumeFile.name}</p>
              <p className="ob-file-preview-size" style={{ fontSize: '0.8rem', color: '#64748B' }}>{formatBytes(data.resumeFile.sizeBytes)} · Uploaded</p>
            </div>
            <div className="ob-file-preview-actions">
              <button
                type="button"
                className="ob-icon-btn"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Replace resume file"
                title="Replace file"
                style={{ borderRadius: '8px' }}
              >
                <Upload size={15} />
              </button>
              <button
                type="button"
                className="ob-icon-btn ob-icon-btn-danger"
                onClick={handleRemoveResume}
                aria-label="Remove resume file"
                title="Remove file"
                style={{ borderRadius: '8px' }}
              >
                <X size={15} />
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx"
              className="ob-file-input-hidden"
              onChange={handleFileChange}
              aria-hidden="true"
              tabIndex={-1}
            />
          </div>
        )}

        {fileError && (
          <p className="ob-field-error" role="alert" style={{ marginTop: '10px' }}>{fileError}</p>
        )}
      </div>

      {/* ── Declared Skills ── */}
      <div className="ob-section-box">
        <div className="ob-section-box-header">
          <div className="ob-section-box-title-group">
            <div className="ob-icon-badge" aria-hidden="true">
              <Plus size={18} />
            </div>
            <div>
              <h2 className="ob-section-box-title">Your declared skills</h2>
              <p className="ob-section-box-sub">Add technical, design, and domain competencies to match with startup tasks</p>
            </div>
          </div>
          <span className="ob-pill-badge">{data.skills.length} added</span>
        </div>

        <InfoNotice variant="info">
          <strong>Declared skills</strong> are self-reported. You can prove them later via live founder tasks or assessments to earn <strong>Verified</strong> or <strong>Assessed</strong> badges on your Skill Passport.
        </InfoNotice>

        {/* Quick Suggestions */}
        <div style={{ marginTop: '14px', marginBottom: '8px' }}>
          <p style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748B', letterSpacing: '0.04em', marginBottom: '8px' }}>
            Quick add suggestions
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {['React', 'Node.js', 'Python', 'TypeScript', 'SQL', 'Figma', 'UI/UX Design', 'Data Analysis', 'Docker', 'Product Management'].map((suggested) => {
              const alreadyHas = data.skills.some((s) => s.name.toLowerCase() === suggested.toLowerCase());
              if (alreadyHas) return null;
              return (
                <button
                  key={suggested}
                  type="button"
                  onClick={() => {
                    const skill: DeclaredSkill = {
                      id: `skill-${skillIdCounter++}`,
                      name: suggested,
                      category: ['Figma', 'UI/UX Design'].includes(suggested) ? 'Design' : ['Data Analysis', 'SQL'].includes(suggested) ? 'Data & Analytics' : 'Programming',
                    };
                    onChange({ ...data, skills: [...data.skills, skill] });
                  }}
                  style={{
                    background: '#FFFFFF',
                    border: '1.5px solid #CBD5E1',
                    borderRadius: '9999px',
                    padding: '4px 12px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: '#334155',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#3559DF';
                    e.currentTarget.style.background = '#EEF2FD';
                    e.currentTarget.style.color = '#3559DF';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#CBD5E1';
                    e.currentTarget.style.background = '#FFFFFF';
                    e.currentTarget.style.color = '#334155';
                  }}
                >
                  <Plus size={12} /> {suggested}
                </button>
              );
            })}
          </div>
        </div>

        {/* Add skill input row */}
        <div className="ob-skill-add-row" style={{ marginTop: '16px' }}>
          <div className="ob-skill-add-input-group">
            <label htmlFor="skill-input" className="ob-label">Skill name</label>
            <input
              id="skill-input"
              type="text"
              className="ob-input"
              placeholder="e.g. Next.js, PostgreSQL, TailwindCSS, AWS"
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
              style={{ borderRadius: '10px' }}
            />
          </div>
          <div className="ob-skill-category-group">
            <label htmlFor="skill-category" className="ob-label">Category</label>
            <select
              id="skill-category"
              className="ob-select"
              value={skillCategory}
              onChange={(e) => setSkillCategory(e.target.value)}
              style={{ borderRadius: '10px' }}
            >
              {SKILL_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="ob-skill-add-btn-wrap">
            <label className="ob-label ob-label-spacer" aria-hidden="true"> </label>
            <button
              type="button"
              className="ob-btn-primary ob-skill-add-btn"
              onClick={addSkill}
              id="add-skill-btn"
              aria-label="Add skill"
              style={{ borderRadius: '10px' }}
            >
              <Plus size={16} aria-hidden="true" />
              Add
            </button>
          </div>
        </div>

        {/* Skills list */}
        {data.skills.length === 0 ? (
          <p className="ob-empty-state-text" style={{ padding: '24px 16px', background: '#F8FAFD', borderRadius: '12px', border: '1px dashed #CBD5E1', marginTop: '16px' }}>
            No skills added yet. Type a skill above or click a suggestion to start building your profile.
          </p>
        ) : (
          <ul className="ob-skills-list" aria-label="Declared skills" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.skills.map((skill) => (
              <li key={skill.id} className="ob-skill-item" style={{ borderRadius: '12px', border: '1px solid #E2E8F0', padding: '12px 16px', background: '#FFFFFF' }}>
                <span className="ob-skill-badge-declared" style={{ borderRadius: '6px' }}>DECLARED</span>
                {editingId === skill.id ? (
                  <input
                    type="text"
                    className="ob-input ob-skill-edit-input"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(skill.id); }}
                    autoFocus
                    aria-label={`Edit skill: ${skill.name}`}
                  />
                ) : (
                  <>
                    <strong className="ob-skill-name" style={{ color: '#0F1A44' }}>{skill.name}</strong>
                    <span className="ob-skill-category-tag" style={{ borderRadius: '6px' }}>{skill.category}</span>
                  </>
                )}
                <div className="ob-skill-actions">
                  {editingId === skill.id ? (
                    <button
                      type="button"
                      className="ob-icon-btn ob-icon-btn-success"
                      onClick={() => saveEdit(skill.id)}
                      aria-label="Save skill edit"
                      style={{ borderRadius: '6px' }}
                    >
                      <Check size={14} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="ob-icon-btn"
                      onClick={() => startEdit(skill)}
                      aria-label={`Edit skill: ${skill.name}`}
                      style={{ borderRadius: '6px' }}
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    className="ob-icon-btn ob-icon-btn-danger"
                    onClick={() => removeSkill(skill.id)}
                    aria-label={`Remove skill: ${skill.name}`}
                    style={{ borderRadius: '6px' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <FormNav
        onBack={onBack}
        onNext={onNext}
        nextLabel="Continue"
        nextId="resume-next-btn"
      />
    </StepWrapper>
  );
};
