import React, { useCallback, useRef, useState } from 'react';
import type { ResumeSkillsData, DeclaredSkill } from '../types';
import {
  StepWrapper, StepHeader, FormNav, InfoNotice, SectionDivider,
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
      <SectionDivider title="Resume upload" />

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
        >
          <div className="ob-dropzone-icon" aria-hidden="true">
            <Upload size={28} />
          </div>
          <p className="ob-dropzone-title">Drag & drop your resume here</p>
          <p className="ob-dropzone-sub">or click to browse your files</p>
          <p className="ob-dropzone-meta">PDF or DOCX · Max {MAX_SIZE_MB} MB</p>
          <button
            type="button"
            className="ob-btn-secondary ob-dropzone-browse"
            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
          >
            Browse files
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
        <div className="ob-file-preview">
          <div className="ob-file-preview-icon" aria-hidden="true">
            <FileText size={22} />
          </div>
          <div className="ob-file-preview-info">
            <p className="ob-file-preview-name">{data.resumeFile.name}</p>
            <p className="ob-file-preview-size">{formatBytes(data.resumeFile.sizeBytes)}</p>
          </div>
          <div className="ob-file-preview-actions">
            <button
              type="button"
              className="ob-icon-btn"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Replace resume file"
              title="Replace"
            >
              <Upload size={15} />
            </button>
            <button
              type="button"
              className="ob-icon-btn ob-icon-btn-danger"
              onClick={handleRemoveResume}
              aria-label="Remove resume file"
              title="Remove"
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
        <p className="ob-field-error" role="alert">{fileError}</p>
      )}

      {data.resumeFile && (
        <InfoNotice variant="info">
          Resume selected. Automatic skill extraction will be available when the
          processing service is connected.
        </InfoNotice>
      )}

      {/* ── Declared Skills ── */}
      <SectionDivider title="Your declared skills" />

      <InfoNotice variant="info">
        <strong>Declared skills</strong> are based on information you provide.
        They are not independently assessed or verified. Skills gain{' '}
        <strong>Assessed</strong> or <strong>Verified</strong> status only after
        a genuine assessment or evidence review.
      </InfoNotice>

      {/* Add skill */}
      <div className="ob-skill-add-row">
        <div className="ob-skill-add-input-group">
          <label htmlFor="skill-input" className="ob-label">Add a skill</label>
          <input
            id="skill-input"
            type="text"
            className="ob-input"
            placeholder="e.g. Python, Figma, Data Analysis"
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
          />
        </div>
        <div className="ob-skill-category-group">
          <label htmlFor="skill-category" className="ob-label">Category</label>
          <select
            id="skill-category"
            className="ob-select"
            value={skillCategory}
            onChange={(e) => setSkillCategory(e.target.value)}
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
          >
            <Plus size={16} aria-hidden="true" />
            Add
          </button>
        </div>
      </div>

      {/* Skills list */}
      {data.skills.length === 0 ? (
        <p className="ob-empty-state-text">
          No skills added yet. Add skills above to build your Declared skills list.
        </p>
      ) : (
        <ul className="ob-skills-list" aria-label="Declared skills">
          {data.skills.map((skill) => (
            <li key={skill.id} className="ob-skill-item">
              <span className="ob-skill-badge-declared">DECLARED</span>
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
                  <span className="ob-skill-name">{skill.name}</span>
                  <span className="ob-skill-category-tag">{skill.category}</span>
                </>
              )}
              <div className="ob-skill-actions">
                {editingId === skill.id ? (
                  <button
                    type="button"
                    className="ob-icon-btn ob-icon-btn-success"
                    onClick={() => saveEdit(skill.id)}
                    aria-label="Save skill edit"
                  >
                    <Check size={14} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="ob-icon-btn"
                    onClick={() => startEdit(skill)}
                    aria-label={`Edit skill: ${skill.name}`}
                  >
                    <Pencil size={14} />
                  </button>
                )}
                <button
                  type="button"
                  className="ob-icon-btn ob-icon-btn-danger"
                  onClick={() => removeSkill(skill.id)}
                  aria-label={`Remove skill: ${skill.name}`}
                >
                  <X size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <FormNav
        onBack={onBack}
        onNext={onNext}
        nextLabel="Continue"
        nextId="resume-next-btn"
      />
    </StepWrapper>
  );
};
