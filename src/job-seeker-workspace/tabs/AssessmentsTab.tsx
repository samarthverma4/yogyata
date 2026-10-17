import React, { useState } from 'react';
import {
  Award,
  CheckCircle2,
  Clock,
  ArrowRight,
  ArrowLeft,
  X,
  AlertCircle,
  HelpCircle,
  Check,
  RotateCcw,
} from 'lucide-react';
import type {
  SkillAssessment,
  AssessmentAttempt,
} from '../types';

interface AssessmentsTabProps {
  assessments: SkillAssessment[];
  attempts: AssessmentAttempt[];
  onCompleteAssessment: (attempt: AssessmentAttempt) => void;
}

export const AssessmentsTab: React.FC<AssessmentsTabProps> = ({
  assessments,
  attempts,
  onCompleteAssessment,
}) => {
  const [activeAssessment, setActiveAssessment] = useState<SkillAssessment | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, number>>({});
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [lastResult, setLastResult] = useState<AssessmentAttempt | null>(null);

  const startAssessment = (assessment: SkillAssessment) => {
    setActiveAssessment(assessment);
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setIsReviewMode(false);
    setLastResult(null);
  };

  const handleSelectOption = (questionId: string, optionIndex: number) => {
    setUserAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleCalculateAndSubmit = () => {
    if (!activeAssessment) return;

    let correctCount = 0;
    activeAssessment.questions.forEach((q) => {
      if (userAnswers[q.id] === q.correctOptionIndex) {
        correctCount++;
      }
    });

    const totalQuestions = activeAssessment.questions.length;
    const scorePercent = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const passed = scorePercent >= 75;

    const newAttempt: AssessmentAttempt = {
      id: `attempt-${Date.now()}`,
      assessmentId: activeAssessment.id,
      assessmentTitle: activeAssessment.title,
      associatedSkill: activeAssessment.associatedSkill,
      date: new Date().toISOString().split('T')[0],
      scorePercent,
      passed,
      totalQuestions,
      correctCount,
      userAnswers: { ...userAnswers },
    };

    onCompleteAssessment(newAttempt);
    setLastResult(newAttempt);
    setIsReviewMode(false);
  };

  const closeRunner = () => {
    setActiveAssessment(null);
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setIsReviewMode(false);
    setLastResult(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* ── Top Header ── */}
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', margin: '0 0 0.25rem' }}>
          Diagnostic Skill Assessments
        </h1>
        <p style={{ fontSize: '0.875rem', color: '#64748B', margin: 0 }}>
          Benchmark your technical depth with structured evaluations. Passing diagnostic assessments upgrades self-declared skills to the <strong>Assessed</strong> tier.
        </p>
      </div>

      {/* ── Disclaimer Banner ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.875rem 1.25rem',
          background: '#EEF2FF',
          border: '1px solid #C7D2FE',
          borderRadius: '8px',
          color: '#3730A3',
          fontSize: '0.8125rem',
        }}
      >
        <AlertCircle size={18} style={{ flexShrink: 0 }} />
        <div>
          <strong>Standardized Diagnostic Note:</strong> Assessments calculate benchmark performance directly from your submitted answers. Assessments grant <strong>Tier 2: Assessed</strong> status; verified credentials require practical project/code evaluation.
        </div>
      </div>

      {/* ── Available Assessments Grid ── */}
      <div>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0F172A', marginBottom: '1rem' }}>
          Available Assessments
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {assessments.map((assessment) => {
            const pastAttempt = attempts.find((a) => a.assessmentId === assessment.id);

            return (
              <div
                key={assessment.id}
                className="jsw-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4F46E5', background: '#EEF2FF', padding: '0.2rem 0.55rem', borderRadius: '4px' }}>
                      {assessment.skillCategory}
                    </span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B' }}>
                      {assessment.difficulty}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A', margin: '0 0 0.5rem' }}>
                    {assessment.title}
                  </h3>

                  <p style={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.5, margin: '0 0 1rem' }}>
                    {assessment.description}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.78rem', color: '#64748B' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Clock size={14} /> {assessment.durationMinutes} mins
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <HelpCircle size={14} /> {assessment.questions.length} Questions
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Award size={14} /> Skill: {assessment.associatedSkill}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid #E2E8F0' }}>
                  {pastAttempt ? (
                    <div style={{ fontSize: '0.78rem' }}>
                      <span style={{ color: pastAttempt.passed ? '#059669' : '#DC2626', fontWeight: 700 }}>
                        {pastAttempt.passed ? '✓ Passed' : 'Needs Practice'}: {pastAttempt.scorePercent}%
                      </span>
                      <span style={{ color: '#94A3B8', marginLeft: '0.5rem' }}>({pastAttempt.date})</span>
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.78rem', color: '#64748B' }}>Not attempted yet</span>
                  )}

                  <button
                    type="button"
                    className="jsw-btn jsw-btn-primary jsw-btn-sm"
                    onClick={() => startAssessment(assessment)}
                    id={`btn-start-${assessment.id}`}
                  >
                    <span>{pastAttempt ? 'Retake' : 'Start Assessment'}</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Assessment History Table ── */}
      <div className="jsw-card">
        <h2 className="jsw-card-title" style={{ marginBottom: '1rem' }}>
          <CheckCircle2 size={18} style={{ color: '#059669' }} />
          Assessment Attempt History
        </h2>

        {attempts.length === 0 ? (
          <p style={{ fontSize: '0.875rem', color: '#64748B', margin: 0 }}>
            No assessment attempts recorded yet. Select an assessment above to benchmark your skills.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Assessment</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Associated Skill</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Date</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Score</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((att) => (
                  <tr key={att.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600, color: '#0F172A' }}>
                      {att.assessmentTitle}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>{att.associatedSkill}</td>
                    <td style={{ padding: '0.75rem 0.5rem', color: '#64748B' }}>{att.date}</td>
                    <td style={{ padding: '0.75rem 0.5rem', fontWeight: 700 }}>
                      {att.correctCount}/{att.totalQuestions} ({att.scorePercent}%)
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          background: att.passed ? '#ECFDF5' : '#FEF2F2',
                          color: att.passed ? '#059669' : '#DC2626',
                        }}
                      >
                        {att.passed ? 'PASSED (Assessed Tier)' : 'RETRY SUGGESTED'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Interactive Assessment Runner Modal ── */}
      {activeAssessment && (
        <div
          className="yw-modal-overlay"
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem',
          }}
        >
          <div
            className="yw-modal-box"
            style={{
              background: '#FFFFFF',
              borderRadius: '14px',
              padding: '2rem',
              maxWidth: '680px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4F46E5', textTransform: 'uppercase' }}>
                  {activeAssessment.skillCategory}
                </span>
                <h3 style={{ margin: '0.25rem 0 0', fontSize: '1.25rem', color: '#0F172A' }}>
                  {activeAssessment.title}
                </h3>
              </div>
              <button type="button" className="btn-ghost" onClick={closeRunner}>
                <X size={20} />
              </button>
            </div>

            {/* Assessment State Branches: Results View vs Review View vs Question Runner */}
            {lastResult ? (
              /* ── 1. Result Breakdown Screen ── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div
                  style={{
                    background: lastResult.passed ? '#ECFDF5' : '#FEF2F2',
                    border: `1.5px solid ${lastResult.passed ? '#A7F3D0' : '#FECACA'}`,
                    borderRadius: '10px',
                    padding: '1.5rem',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '2.5rem', fontWeight: 800, color: lastResult.passed ? '#059669' : '#DC2626' }}>
                    {lastResult.scorePercent}%
                  </div>
                  <h4 style={{ margin: '0.35rem 0', fontSize: '1.125rem', color: '#0F172A' }}>
                    {lastResult.passed ? 'Assessment Passed!' : 'Assessment Complete'}
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#475569' }}>
                    You answered <strong>{lastResult.correctCount} of {lastResult.totalQuestions}</strong> questions correctly.
                    {lastResult.passed
                      ? ` ${lastResult.associatedSkill} has been benchmarked as an ASSESSED skill in your Skill Passport!`
                      : ' Passing score is 75%. Review the explanations below and feel free to retake the test.'}
                  </p>
                </div>

                <h4 style={{ margin: '0.5rem 0 0', fontSize: '1rem', color: '#0F172A' }}>
                  Question Breakdown &amp; Explanations
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {activeAssessment.questions.map((q, idx) => {
                    const chosenIdx = lastResult.userAnswers[q.id];
                    const isCorrect = chosenIdx === q.correctOptionIndex;

                    return (
                      <div
                        key={q.id}
                        style={{
                          background: '#F8FAFC',
                          border: `1px solid ${isCorrect ? '#BBF7D0' : '#FECACA'}`,
                          borderRadius: '8px',
                          padding: '1rem',
                          fontSize: '0.8125rem',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginBottom: '0.35rem' }}>
                          <span>Question {idx + 1}</span>
                          <span style={{ color: isCorrect ? '#059669' : '#DC2626' }}>
                            {isCorrect ? '✓ Correct' : '✗ Incorrect'}
                          </span>
                        </div>
                        <p style={{ margin: '0 0 0.5rem', color: '#0F172A', fontWeight: 500 }}>
                          {q.questionText}
                        </p>
                        <div style={{ color: '#475569', marginBottom: '0.25rem' }}>
                          <strong>Your Answer:</strong> {chosenIdx !== undefined ? q.options[chosenIdx] : 'Unanswered'}
                        </div>
                        {!isCorrect && (
                          <div style={{ color: '#059669', marginBottom: '0.35rem' }}>
                            <strong>Correct Answer:</strong> {q.options[q.correctOptionIndex]}
                          </div>
                        )}
                        <div style={{ fontSize: '0.75rem', color: '#64748B', fontStyle: 'italic', marginTop: '0.35rem' }}>
                          Explanation: {q.explanation}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                  <button
                    type="button"
                    className="jsw-btn jsw-btn-secondary"
                    onClick={() => startAssessment(activeAssessment)}
                  >
                    <RotateCcw size={14} />
                    <span>Retake Test</span>
                  </button>
                  <button
                    type="button"
                    className="jsw-btn jsw-btn-primary"
                    onClick={closeRunner}
                    id="btn-close-assessment-result"
                  >
                    Return to Assessments
                  </button>
                </div>
              </div>
            ) : isReviewMode ? (
              /* ── 2. Review Answers Screen Before Submit ── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem', color: '#0F172A', fontSize: '1rem' }}>
                    Review Your Answers
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748B' }}>
                    Confirm your responses before final score calculation. You can click on any question to modify your answer.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {activeAssessment.questions.map((q, idx) => {
                    const answered = userAnswers[q.id] !== undefined;
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => {
                          setCurrentQuestionIndex(idx);
                          setIsReviewMode(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.875rem 1rem',
                          background: '#FFFFFF',
                          border: '1px solid #CBD5E1',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontSize: '0.8125rem',
                        }}
                      >
                        <div>
                          <strong>Q{idx + 1}:</strong> {q.questionText.slice(0, 60)}...
                        </div>
                        <span style={{ fontWeight: 600, color: answered ? '#059669' : '#DC2626' }}>
                          {answered ? `Selected: Option ${userAnswers[q.id] + 1}` : 'Unanswered'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
                  <button
                    type="button"
                    className="jsw-btn jsw-btn-secondary"
                    onClick={() => setIsReviewMode(false)}
                  >
                    <ArrowLeft size={14} />
                    <span>Back to Questions</span>
                  </button>
                  <button
                    type="button"
                    className="jsw-btn jsw-btn-success"
                    onClick={handleCalculateAndSubmit}
                    id="btn-confirm-submit-assessment"
                  >
                    <Check size={16} />
                    <span>Confirm &amp; Calculate Score</span>
                  </button>
                </div>
              </div>
            ) : (
              /* ── 3. Question Navigation Runner ── */
              <div>
                {/* Progress Tracker */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.8125rem', color: '#64748B' }}>
                  <span>Question {currentQuestionIndex + 1} of {activeAssessment.questions.length}</span>
                  <span>{Object.keys(userAnswers).length} of {activeAssessment.questions.length} Answered</span>
                </div>

                <div style={{ width: '100%', height: '6px', background: '#E2E8F0', borderRadius: '3px', overflow: 'hidden', marginBottom: '1.5rem' }}>
                  <div
                    style={{
                      width: `${((currentQuestionIndex + 1) / activeAssessment.questions.length) * 100}%`,
                      height: '100%',
                      background: '#4F46E5',
                      transition: 'width 0.2s ease',
                    }}
                  />
                </div>

                {/* Active Question */}
                {(() => {
                  const q = activeAssessment.questions[currentQuestionIndex];
                  const selectedOpt = userAnswers[q.id];

                  return (
                    <div>
                      <h4 style={{ fontSize: '1.05rem', color: '#0F172A', lineHeight: 1.5, margin: '0 0 1.25rem' }}>
                        {q.questionText}
                      </h4>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '1.75rem' }}>
                        {q.options.map((optText, optIdx) => {
                          const isSelected = selectedOpt === optIdx;

                          return (
                            <label
                              key={optIdx}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.875rem 1rem',
                                background: isSelected ? '#EEF2FF' : '#F8FAFC',
                                border: `1.5px solid ${isSelected ? '#4F46E5' : '#CBD5E1'}`,
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                                color: isSelected ? '#1E1B4B' : '#334155',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <input
                                type="radio"
                                name={`q-${q.id}`}
                                checked={isSelected}
                                onChange={() => handleSelectOption(q.id, optIdx)}
                                style={{ accentColor: '#4F46E5', width: '16px', height: '16px' }}
                              />
                              <span>{optText}</span>
                            </label>
                          );
                        })}
                      </div>

                      {/* Navigation buttons */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <button
                          type="button"
                          className="jsw-btn jsw-btn-secondary"
                          onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                          disabled={currentQuestionIndex === 0}
                          style={{ opacity: currentQuestionIndex === 0 ? 0.5 : 1 }}
                        >
                          <ArrowLeft size={14} />
                          <span>Previous</span>
                        </button>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            type="button"
                            className="jsw-btn jsw-btn-secondary"
                            onClick={() => setIsReviewMode(true)}
                          >
                            Review ({Object.keys(userAnswers).length}/{activeAssessment.questions.length})
                          </button>

                          {currentQuestionIndex < activeAssessment.questions.length - 1 ? (
                            <button
                              type="button"
                              className="jsw-btn jsw-btn-primary"
                              onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
                              id="btn-next-question"
                            >
                              <span>Next</span>
                              <ArrowRight size={14} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="jsw-btn jsw-btn-success"
                              onClick={() => setIsReviewMode(true)}
                              id="btn-finish-review"
                            >
                              <span>Review &amp; Submit</span>
                              <Check size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
