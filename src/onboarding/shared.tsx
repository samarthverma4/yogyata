import React from 'react';

// ─── Step Wrapper ─────────────────────────────────────────────────────────────

interface StepWrapperProps {
  children: React.ReactNode;
}

export const StepWrapper: React.FC<StepWrapperProps> = ({ children }) => (
  <div className="ob-step-wrapper">{children}</div>
);

// ─── Step Header ─────────────────────────────────────────────────────────────

interface StepHeaderProps {
  heading: string;
  subheading?: string;
  eyebrow?: string;
}

export const StepHeader: React.FC<StepHeaderProps> = ({
  heading,
  subheading,
  eyebrow,
}) => (
  <div className="ob-step-header">
    {eyebrow && <p className="ob-step-eyebrow">{eyebrow}</p>}
    <h1 className="ob-step-heading">{heading}</h1>
    {subheading && <p className="ob-step-subheading">{subheading}</p>}
  </div>
);

// ─── Field Group ─────────────────────────────────────────────────────────────

interface FieldGroupProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

export const FieldGroup: React.FC<FieldGroupProps> = ({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
}) => (
  <div className={`ob-field-group ${error ? 'has-error' : ''}`}>
    <label className="ob-label" htmlFor={htmlFor}>
      {label}
      {required && (
        <span className="ob-required-star" aria-hidden="true"> *</span>
      )}
    </label>
    {children}
    {hint && !error && <p className="ob-field-hint">{hint}</p>}
    {error && (
      <p className="ob-field-error" role="alert" aria-live="polite" id={`${htmlFor}-error`}>
        {error}
      </p>
    )}
  </div>
);

// ─── Text Input ──────────────────────────────────────────────────────────────

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  inputId: string;
}

export const TextInput: React.FC<TextInputProps> = ({
  error,
  inputId,
  ...rest
}) => (
  <input
    id={inputId}
    className={`ob-input ${error ? 'is-invalid' : ''}`}
    aria-invalid={!!error}
    aria-describedby={error ? `${inputId}-error` : undefined}
    {...rest}
  />
);

// ─── Select Input ─────────────────────────────────────────────────────────────

interface SelectInputProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  inputId: string;
  error?: string;
}

export const SelectInput: React.FC<SelectInputProps> = ({
  inputId,
  error,
  children,
  ...rest
}) => (
  <div className="ob-select-wrapper">
    <select
      id={inputId}
      className={`ob-select ${error ? 'is-invalid' : ''}`}
      aria-invalid={!!error}
      aria-describedby={error ? `${inputId}-error` : undefined}
      {...rest}
    >
      {children}
    </select>
  </div>
);

// ─── Textarea Input ──────────────────────────────────────────────────────────

interface TextAreaInputProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  inputId: string;
  maxLength?: number;
  currentLength?: number;
}

export const TextAreaInput: React.FC<TextAreaInputProps> = ({
  error,
  inputId,
  maxLength,
  currentLength,
  className = '',
  ...rest
}) => (
  <div className="ob-textarea-wrapper">
    <textarea
      id={inputId}
      className={`ob-textarea ${error ? 'is-invalid' : ''} ${className}`}
      aria-invalid={!!error}
      aria-describedby={error ? `${inputId}-error` : undefined}
      maxLength={maxLength}
      {...rest}
    />
    {maxLength !== undefined && currentLength !== undefined && (
      <div className="ob-char-counter" aria-live="polite">
        {currentLength} / {maxLength}
      </div>
    )}
  </div>
);

// ─── Form Navigation Buttons ──────────────────────────────────────────────────

interface FormNavProps {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  backLabel?: string;
  nextId?: string;
  loading?: boolean;
}

export const FormNav: React.FC<FormNavProps> = ({
  onBack,
  onNext,
  nextLabel = 'Continue',
  backLabel = 'Back',
  nextId = 'step-next-btn',
  loading = false,
}) => (
  <div className="ob-form-nav">
    {onBack && (
      <button
        type="button"
        className="ob-btn-secondary"
        onClick={onBack}
        id="step-back-btn"
      >
        ← {backLabel}
      </button>
    )}
    <button
      type="button"
      className="ob-btn-primary"
      onClick={onNext}
      disabled={loading}
      id={nextId}
    >
      {loading ? 'Please wait…' : nextLabel}
    </button>
  </div>
);

// ─── Section Divider ─────────────────────────────────────────────────────────

interface SectionDividerProps {
  title: string;
}

export const SectionDivider: React.FC<SectionDividerProps> = ({ title }) => (
  <div className="ob-section-divider" role="separator" aria-label={title}>
    <span>{title}</span>
  </div>
);

// ─── Inline Info Notice ───────────────────────────────────────────────────────

interface InfoNoticeProps {
  children: React.ReactNode;
  variant?: 'info' | 'warning' | 'success';
}

export const InfoNotice: React.FC<InfoNoticeProps> = ({
  children,
  variant = 'info',
}) => (
  <div className={`ob-info-notice ob-notice-${variant}`} role="note">
    {children}
  </div>
);

// ─── Checkbox Field ───────────────────────────────────────────────────────────

interface CheckboxFieldProps {
  id: string;
  label: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
}

export const CheckboxField: React.FC<CheckboxFieldProps> = ({
  id,
  label,
  checked,
  onChange,
  error,
}) => (
  <div className={`ob-checkbox-field ${error ? 'has-error' : ''}`}>
    <label className="ob-checkbox-label" htmlFor={id}>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="ob-checkbox-input"
        aria-describedby={error ? `${id}-error` : undefined}
      />
      <span className="ob-checkbox-box" aria-hidden="true" />
      <span className="ob-checkbox-text">{label}</span>
    </label>
    {error && (
      <p className="ob-field-error" role="alert" aria-live="polite" id={`${id}-error`}>
        {error}
      </p>
    )}
  </div>
);

// ─── Multi-select Chip Group ──────────────────────────────────────────────────

interface ChipGroupProps {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
  maxSelect?: number;
  error?: string;
  groupId: string;
}

export const ChipGroup: React.FC<ChipGroupProps> = ({
  label,
  options,
  selected,
  onChange,
  maxSelect,
  error,
  groupId,
}) => {
  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      if (maxSelect && selected.length >= maxSelect) return;
      onChange([...selected, value]);
    }
  };

  return (
    <div className="ob-chip-group">
      <p className="ob-chip-group-label" id={`${groupId}-label`}>
        {label}
      </p>
      <div
        className="ob-chip-list"
        role="group"
        aria-labelledby={`${groupId}-label`}
        aria-describedby={error ? `${groupId}-error` : undefined}
      >
        {options.map((opt) => {
          const isSelected = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              role="checkbox"
              aria-checked={isSelected}
              className={`ob-chip ${isSelected ? 'is-selected' : ''}`}
              onClick={() => toggle(opt.value)}
              id={`${groupId}-${opt.value}`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {error && (
        <p
          className="ob-field-error"
          role="alert"
          aria-live="polite"
          id={`${groupId}-error`}
        >
          {error}
        </p>
      )}
    </div>
  );
};
