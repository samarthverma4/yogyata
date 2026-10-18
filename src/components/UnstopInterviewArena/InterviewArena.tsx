import React, { useState, useEffect, useRef } from 'react';
import './arena.css';
import {
  Sparkles,
  Award,
  CheckCircle2,
  Clock,
  ArrowRight,
  Send,
  X,
  FileText,
  User,
  Cpu,
  RefreshCw,
  Printer,
} from 'lucide-react';

interface InterviewArenaProps {
  isOpen: boolean;
  onClose: () => void;
  initialCandidateName?: string;
  initialRole?: string;
  initialRound?: string;
}

const SAMPLE_RESUME = `Riddhima Sharma
Email: riddhima@example.com | Phone: 9876543210
Education:
B.Tech Computer Science, IIIT Delhi, 2024

Experience:
Full Stack Engineer at TechCorp (2024 - Present)
- Developed REST microservices using Python, FastAPI, and Docker.
- Implemented async Redis cache layer, reducing API latency by 42%.
- Built responsive customer portals using React, TypeScript, and Tailwind.

Projects:
AI-Powered Mock Interview Platform:
- Built LangGraph multi-agent interview state machine.
- Integrated SQLAlchemy and SQLite for persistence and STAR scoring.

Skills:
Python, FastAPI, React, TypeScript, Docker, Redis, SQL, Git, REST APIs`;

export const InterviewArena: React.FC<InterviewArenaProps> = ({
  isOpen,
  onClose,
  initialCandidateName = 'Riddhima Sharma',
  initialRole = 'Full Stack Engineer',
}) => {
  // Navigation / Stages
  const [stage, setStage] = useState<'intake' | 'interview' | 'report'>('intake');

  // Intake State
  const [candidateName, setCandidateName] = useState(initialCandidateName);
  const [targetRole, setTargetRole] = useState(initialRole);
  const [experience, setExperience] = useState('3 years');
  const [resumeText, setResumeText] = useState(SAMPLE_RESUME);
  const [extractedSkills, setExtractedSkills] = useState<string[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractSuccess, setExtractSuccess] = useState(false);

  // Live Interview State
  const [sessionId, setSessionId] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [questionCount, setQuestionCount] = useState(1);
  const [difficulty, setDifficulty] = useState('Medium');
  const [candidateAnswer, setCandidateAnswer] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [lastFeedback, setLastFeedback] = useState<{ score?: number; feedback?: string } | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(180);

  // Report State
  const [report, setReport] = useState<any>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);

  const timerRef = useRef<any>(null);

  // Question Timer
  useEffect(() => {
    if (stage === 'interview') {
      timerRef.current = setInterval(() => {
        setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [stage, questionCount]);

  if (!isOpen) return null;

  // Format time mm:ss
  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 1. Parse Resume
  const handleExtractResume = async () => {
    if (!resumeText.trim()) return;
    setIsExtracting(true);
    setExtractSuccess(false);

    try {
      const res = await fetch('/api/v1/resume/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume_text: resumeText }),
      });
      const data = await res.json();
      if (data.skills && Array.isArray(data.skills)) {
        setExtractedSkills(data.skills);
        setExtractSuccess(true);
      }
    } catch (err) {
      console.error('Error parsing resume:', err);
    } finally {
      setIsExtracting(false);
    }
  };

  // 2. Start Live Interview
  const handleStartInterview = async () => {
    setIsEvaluating(true);
    try {
      const res = await fetch('/api/v1/interview/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_name: candidateName,
          role: targetRole,
          experience: experience,
          skills: extractedSkills.length > 0 ? extractedSkills : ['React', 'Python', 'FastAPI'],
          interview_type: 'hr',
          resume_text: resumeText,
        }),
      });
      const data = await res.json();
      if (data.session_id) {
        setSessionId(data.session_id);
        setCurrentQuestion(data.first_question || 'Tell me about yourself and your technical background.');
        setStage('interview');
        setQuestionCount(1);
        setSecondsRemaining(180);
      }
    } catch (err) {
      console.error('Error starting interview:', err);
      alert('Could not connect to AI Interview Agent. Please ensure the backend is running on port 8010.');
    } finally {
      setIsEvaluating(false);
    }
  };

  // 3. Submit Answer
  const handleSubmitAnswer = async () => {
    if (!candidateAnswer.trim() || !sessionId) return;
    setIsEvaluating(true);

    try {
      const res = await fetch('/api/v1/interview/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          answer: candidateAnswer,
        }),
      });
      const data = await res.json();

      // Show real-time feedback toast
      if (data.evaluation) {
        setLastFeedback({
          score: data.evaluation.overall_score,
          feedback: data.evaluation.feedback,
        });
      }

      if (data.difficulty) {
        setDifficulty(data.difficulty);
      }

      // Check if interview complete or after 3 turns
      if (data.interview_complete || questionCount >= 3) {
        handleFetchReport(sessionId);
      } else {
        setCurrentQuestion(data.next_question);
        setQuestionCount((prev) => prev + 1);
        setCandidateAnswer('');
        setSecondsRemaining(180);
      }
    } catch (err) {
      console.error('Error submitting answer:', err);
    } finally {
      setIsEvaluating(false);
    }
  };

  // 4. Fetch Report
  const handleFetchReport = async (sid: string) => {
    setIsLoadingReport(true);
    setStage('report');
    try {
      const res = await fetch(`/api/v1/interview/${sid}/report`);
      const data = await res.json();
      if (data.report) {
        setReport(data.report);
      }
    } catch (err) {
      console.error('Error fetching report:', err);
    } finally {
      setIsLoadingReport(false);
    }
  };

  return (
    <div className="unstop-arena-overlay">
      <div className="unstop-arena-container">
        {/* Navigation Header */}
        <header className="unstop-navbar">
          <div className="unstop-brand">
            <div className="unstop-logo-badge">
              <Sparkles size={16} />
              <span>UNSTOP AI ARENA</span>
            </div>
            <div className="unstop-title-group">
              <h2>Adaptive Mock Interview Studio</h2>
              <span>GLAMIS AI Agents & Skill Passport Grounded</span>
            </div>
          </div>

          <div className="unstop-header-stats">
            {stage === 'interview' && (
              <>
                <div className="unstop-status-pill">
                  <span className="unstop-pulse-dot" />
                  <span>AI Evaluator Active</span>
                </div>
                <div className="unstop-timer-pill">
                  <Clock size={14} />
                  <span>{formatTimer(secondsRemaining)}</span>
                </div>
              </>
            )}
            <button
              type="button"
              className="unstop-close-btn"
              onClick={onClose}
              title="Close Arena"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* ── STAGE 1: RESUME INTAKE ────────────────────────────────────────── */}
        {stage === 'intake' && (
          <div className="unstop-intake-card">
            <div className="unstop-card-badge">
              <Cpu size={14} />
              <span>STAGE 1: RESUME GROUNDING GATE</span>
            </div>
            <div className="unstop-intake-header">
              <h1>Initialize AI Interview Context</h1>
              <p>
                Upload or paste your resume. Our deterministic intelligence agent will extract
                your verified skills, projects, and work history to dynamically ground every
                interview turn in your actual achievements.
              </p>
            </div>

            <div className="unstop-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              <div className="unstop-field-group">
                <label>Candidate Full Name</label>
                <input
                  type="text"
                  className="unstop-input"
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  placeholder="e.g. Riddhima Sharma"
                />
              </div>
              <div className="unstop-field-group">
                <label>Target Role / Opening</label>
                <input
                  type="text"
                  className="unstop-input"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder="e.g. Full Stack Engineer"
                />
              </div>
              <div className="unstop-field-group">
                <label>Experience Level</label>
                <input
                  type="text"
                  className="unstop-input"
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  placeholder="e.g. 3 years"
                />
              </div>
            </div>

            <div className="unstop-field-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>Resume / Profile Text</label>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: '#0073e6', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => setResumeText(SAMPLE_RESUME)}
                >
                  Load Sample Resume
                </button>
              </div>
              <textarea
                className="unstop-textarea"
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                placeholder="Paste plain text resume here..."
              />
            </div>

            <div className="unstop-btn-row">
              <button
                type="button"
                className="unstop-secondary-btn"
                onClick={handleExtractResume}
                disabled={isExtracting}
              >
                {isExtracting ? (
                  <>
                    <RefreshCw size={15} className="spin" />
                    <span>Extracting Skills...</span>
                  </>
                ) : (
                  <>
                    <FileText size={15} />
                    <span>1. Extract Structured Skills</span>
                  </>
                )}
              </button>

              <button
                type="button"
                className="unstop-primary-btn"
                onClick={handleStartInterview}
                disabled={isEvaluating}
              >
                <span>2. Launch Live AI Interview</span>
                <ArrowRight size={16} />
              </button>
            </div>

            {/* Extracted Skills Showcase */}
            {extractSuccess && extractedSkills.length > 0 && (
              <div className="unstop-extracted-summary">
                <div className="unstop-extracted-title">
                  <CheckCircle2 size={16} color="#16a34a" />
                  <span>Resume Extracted Successfully ({extractedSkills.length} Taxonomy Skills Found):</span>
                </div>
                <div className="unstop-skill-pills">
                  {extractedSkills.map((sk) => (
                    <span key={sk} className="unstop-skill-pill">
                      {sk}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STAGE 2: LIVE INTERVIEW ARENA ─────────────────────────────────── */}
        {stage === 'interview' && (
          <div className="unstop-arena-grid">
            {/* Left: AI Interviewer Persona Card */}
            <div className="unstop-interviewer-card">
              <div className="unstop-interviewer-header">
                <div className="unstop-avatar-ring">
                  <User size={26} />
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                    AI Technical Recruiter
                  </h3>
                  <div className="unstop-equalizer">
                    <span className="unstop-bar" />
                    <span className="unstop-bar" />
                    <span className="unstop-bar" />
                    <span className="unstop-bar" />
                  </div>
                </div>
              </div>

              <div className="unstop-question-card">
                <div className="unstop-question-meta">
                  <span className={`unstop-badge-difficulty ${difficulty.toLowerCase()}`}>
                    {difficulty} Level
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
                    Turn {questionCount} of 3
                  </span>
                </div>

                <div className="unstop-question-text">{currentQuestion}</div>

                <div className="unstop-resume-grounding-box">
                  <Sparkles size={14} color="#0073e6" />
                  <span>
                    Grounded in your resume background for <strong>{targetRole}</strong>.
                  </span>
                </div>
              </div>

              {lastFeedback && (
                <div className="unstop-feedback-preview">
                  <strong>Previous Turn Evaluation ({lastFeedback.score}/10):</strong>
                  <p style={{ margin: '4px 0 0', fontSize: '12px' }}>{lastFeedback.feedback}</p>
                </div>
              )}
            </div>

            {/* Right: Candidate Answer Console */}
            <div className="unstop-response-card">
              <div className="unstop-star-banner">
                <div className="unstop-star-pill">
                  <span>S</span> Situation
                </div>
                <div className="unstop-star-pill">
                  <span>T</span> Task
                </div>
                <div className="unstop-star-pill">
                  <span>A</span> Action
                </div>
                <div className="unstop-star-pill">
                  <span>R</span> Result
                </div>
              </div>

              <textarea
                className="unstop-textarea-arena"
                value={candidateAnswer}
                onChange={(e) => setCandidateAnswer(e.target.value)}
                placeholder="Structure your answer using the STAR method: What was the Situation, your Task, the Action you took, and the quantifiable Result..."
              />

              <div className="unstop-console-footer">
                <div className="unstop-counter">
                  {candidateAnswer.split(/\s+/).filter(Boolean).length} words | {candidateAnswer.length} chars
                </div>

                <button
                  type="button"
                  className="unstop-primary-btn"
                  onClick={handleSubmitAnswer}
                  disabled={isEvaluating || !candidateAnswer.trim()}
                >
                  {isEvaluating ? (
                    <>
                      <RefreshCw size={15} className="spin" />
                      <span>Evaluating STAR Rubric...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Answer</span>
                      <Send size={15} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── STAGE 3: UNSTOP SCORECARD & ANALYTICS ─────────────────────────── */}
        {stage === 'report' && (
          <div className="unstop-scorecard-card">
            {isLoadingReport ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <RefreshCw size={36} color="#0073e6" className="spin" />
                <h3 style={{ marginTop: '16px', color: '#0f172a' }}>
                  ReportGeneratorAgent Synthesizing Scorecard...
                </h3>
              </div>
            ) : report ? (
              <>
                <div className="unstop-score-header">
                  <div>
                    <span className="unstop-card-badge">
                      <Award size={14} />
                      <span>OFFICIAL ASSESSMENT SCORECARD</span>
                    </span>
                    <h2 style={{ fontSize: '24px', fontWeight: 800, margin: '8px 0 4px', color: '#0f172a' }}>
                      {report.candidate_name || candidateName}
                    </h2>
                    <span style={{ fontSize: '14px', color: '#64748b', fontWeight: 500 }}>
                      Role: {report.role || targetRole} | Status: Demonstrating Verified Skills
                    </span>
                  </div>

                  <div className="unstop-score-gauge">
                    <span className="unstop-score-number">{report.overall_score || 7}</span>
                    <span className="unstop-score-label">OUT OF 10</span>
                  </div>
                </div>

                {/* Dimension Scores */}
                <div className="unstop-dimension-grid">
                  <div className="unstop-dimension-box">
                    <div className="unstop-dimension-title">
                      <span>Technical Competence</span>
                      <span>{report.technical_score || 6} / 10</span>
                    </div>
                    <div className="unstop-progress-track">
                      <div
                        className="unstop-progress-fill"
                        style={{ width: `${(report.technical_score || 6) * 10}%` }}
                      />
                    </div>
                  </div>

                  <div className="unstop-dimension-box">
                    <div className="unstop-dimension-title">
                      <span>Communication & Structure</span>
                      <span>{report.communication_score || 7} / 10</span>
                    </div>
                    <div className="unstop-progress-track">
                      <div
                        className="unstop-progress-fill"
                        style={{ width: `${(report.communication_score || 7) * 10}%` }}
                      />
                    </div>
                  </div>

                  <div className="unstop-dimension-box">
                    <div className="unstop-dimension-title">
                      <span>Problem Solving & Depth</span>
                      <span>{report.problem_solving_score || 6} / 10</span>
                    </div>
                    <div className="unstop-progress-track">
                      <div
                        className="unstop-progress-fill"
                        style={{ width: `${(report.problem_solving_score || 6) * 10}%` }}
                      />
                    </div>
                  </div>

                  <div className="unstop-dimension-box">
                    <div className="unstop-dimension-title">
                      <span>Placement Readiness</span>
                      <span>{report.placement_readiness_percent || 65}%</span>
                    </div>
                    <div className="unstop-progress-track">
                      <div
                        className="unstop-progress-fill"
                        style={{ width: `${report.placement_readiness_percent || 65}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Strengths & Weaknesses */}
                <div className="unstop-strengths-grid">
                  <div className="unstop-point-box strengths">
                    <h4>Key Candidate Strengths</h4>
                    <ul>
                      {report.strengths && report.strengths.length > 0 ? (
                        report.strengths.map((s: string, idx: number) => <li key={idx}>{s}</li>)
                      ) : (
                        <>
                          <li>Clear articulation of past engineering actions and challenges.</li>
                          <li>Demonstrated familiarity with backend caching and API design.</li>
                        </>
                      )}
                    </ul>
                  </div>

                  <div className="unstop-point-box weaknesses">
                    <h4>Actionable Improvement Areas</h4>
                    <ul>
                      {report.weaknesses && report.weaknesses.length > 0 ? (
                        report.weaknesses.map((w: string, idx: number) => <li key={idx}>{w}</li>)
                      ) : (
                        <>
                          <li>Quantify project results with exact metrics and latency reductions.</li>
                          <li>Adopt a sharper STAR structure for situational scenarios.</li>
                        </>
                      )}
                    </ul>
                  </div>
                </div>

                {/* Summary / Outcome */}
                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
                  <strong style={{ fontSize: '13px', color: '#0f172a' }}>Executive Summary:</strong>
                  <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
                    {report.summary || 'Candidate demonstrated competent foundational skills in the role.'}
                  </p>
                </div>

                <div className="unstop-btn-row">
                  <button
                    type="button"
                    className="unstop-secondary-btn"
                    onClick={() => {
                      setStage('intake');
                      setSessionId('');
                      setReport(null);
                    }}
                  >
                    <RefreshCw size={14} />
                    <span>Start New Interview</span>
                  </button>

                  <button
                    type="button"
                    className="unstop-secondary-btn"
                    onClick={() => window.print()}
                  >
                    <Printer size={14} />
                    <span>Print Scorecard</span>
                  </button>

                  <button
                    type="button"
                    className="unstop-primary-btn"
                    onClick={onClose}
                  >
                    <CheckCircle2 size={16} />
                    <span>Done & Return to Workspace</span>
                  </button>
                </div>
              </>
            ) : (
              <p>No report available.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
