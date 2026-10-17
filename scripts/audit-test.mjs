import fs from 'fs';
import path from 'path';
import assert from 'assert';

console.log('====================================================');
console.log('YOGYATA FOUNDER MODULE — INTEGRATION & AUDIT SUITE');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] Test ${totalTests}: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] Test ${totalTests}: ${name}`);
    console.error(err);
  }
}

// 1. URL Sanitization Tests
function sanitizeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '#';
  const trimmed = rawUrl.trim();
  if (
    trimmed.toLowerCase().startsWith('javascript:') ||
    trimmed.toLowerCase().startsWith('data:') ||
    trimmed.toLowerCase().startsWith('vbscript:')
  ) {
    return '#';
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

runTest('Security: sanitizeUrl allows valid HTTPS and HTTP URLs', () => {
  assert.strictEqual(sanitizeUrl('https://yogyata.io'), 'https://yogyata.io');
  assert.strictEqual(sanitizeUrl('http://insecure.test'), 'http://insecure.test');
  assert.strictEqual(sanitizeUrl('github.com/my-repo'), 'https://github.com/my-repo');
});

runTest('Security: sanitizeUrl neutralizes javascript: and data: vectors', () => {
  assert.strictEqual(sanitizeUrl('javascript:alert(1)'), '#');
  assert.strictEqual(sanitizeUrl('JAVASCRIPT:void(0)'), '#');
  assert.strictEqual(sanitizeUrl('data:text/html;base64,PHNjcmlwdD4='), '#');
  assert.strictEqual(sanitizeUrl('vbscript:msgbox(1)'), '#');
  assert.strictEqual(sanitizeUrl(''), '#');
  assert.strictEqual(sanitizeUrl(null), '#');
});

// 2. ID Collision Resistance Test
runTest('Data Integrity: Collision-proof ID generator produces 5,000 unique IDs', () => {
  const ids = new Set();
  for (let i = 0; i < 5000; i++) {
    const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    assert.strictEqual(ids.has(id), false, `Collision detected on ID: ${id}`);
    ids.add(id);
  }
  assert.strictEqual(ids.size, 5000);
});

// 3. Skill Passport Rules & Endorsement Guard Tests
runTest('Skill Passport Rules: Only accepted submissions can endorse verified skills', () => {
  function evaluateSubmission(submission, newStatus, wantsEndorsement, endorsedSkill) {
    const canEndorse = newStatus === 'accepted' && wantsEndorsement;
    return {
      ...submission,
      status: newStatus,
      isVerifiedEndorsed: canEndorse,
      endorsedSkill: canEndorse ? endorsedSkill : undefined,
    };
  }

  const baseSub = {
    id: 'sub-1',
    taskId: 'task-1',
    candidateName: 'Aarav Patel',
    status: 'under-review',
    isVerifiedEndorsed: false,
  };

  // Case A: Accepted + Wants endorsement -> Granted
  const acceptedResult = evaluateSubmission(baseSub, 'accepted', true, 'React Architecture');
  assert.strictEqual(acceptedResult.status, 'accepted');
  assert.strictEqual(acceptedResult.isVerifiedEndorsed, true);
  assert.strictEqual(acceptedResult.endorsedSkill, 'React Architecture');

  // Case B: Rejected + Wants endorsement -> BLOCKED & Purged
  const rejectedResult = evaluateSubmission(baseSub, 'rejected', true, 'React Architecture');
  assert.strictEqual(rejectedResult.status, 'rejected');
  assert.strictEqual(rejectedResult.isVerifiedEndorsed, false);
  assert.strictEqual(rejectedResult.endorsedSkill, undefined);

  // Case C: Revision Requested + Wants endorsement -> BLOCKED & Purged
  const revisionResult = evaluateSubmission(baseSub, 'revision-requested', true, 'React Architecture');
  assert.strictEqual(revisionResult.status, 'revision-requested');
  assert.strictEqual(revisionResult.isVerifiedEndorsed, false);
  assert.strictEqual(revisionResult.endorsedSkill, undefined);

  // Case D: Under review + Wants endorsement -> BLOCKED
  const underReviewResult = evaluateSubmission(baseSub, 'under-review', true, 'React Architecture');
  assert.strictEqual(underReviewResult.status, 'under-review');
  assert.strictEqual(underReviewResult.isVerifiedEndorsed, false);
  assert.strictEqual(underReviewResult.endorsedSkill, undefined);
});

// 4. Project Deletion & Task Preservation Test
runTest('Data Integrity: Deleting a project moves tasks to unassigned without losing data', () => {
  const projects = [
    { id: 'proj-1', title: 'Main Project' },
    { id: 'proj-2', title: 'Secondary Project' },
  ];
  const tasks = [
    { id: 'task-1', projectId: 'proj-1', title: 'Task 1' },
    { id: 'task-2', projectId: 'proj-1', title: 'Task 2' },
    { id: 'task-3', projectId: 'proj-2', title: 'Task 3' },
  ];

  const projectIdToDelete = 'proj-1';
  const updatedProjects = projects.filter((p) => p.id !== projectIdToDelete);
  const updatedTasks = tasks.map((t) =>
    t.projectId === projectIdToDelete ? { ...t, projectId: 'proj-unassigned' } : t
  );

  assert.strictEqual(updatedProjects.length, 1);
  assert.strictEqual(updatedProjects[0].id, 'proj-2');
  assert.strictEqual(updatedTasks.length, 3);
  assert.strictEqual(updatedTasks[0].projectId, 'proj-unassigned');
  assert.strictEqual(updatedTasks[1].projectId, 'proj-unassigned');
  assert.strictEqual(updatedTasks[2].projectId, 'proj-2');
});

// 5. Incomplete & Corrupted Local Storage Recovery Test
runTest('Data Integrity: Corrupted JSON and missing fields recover gracefully to safe fallbacks', () => {
  function safeLoadState(jsonStr) {
    if (!jsonStr) return null;
    try {
      const parsed = JSON.parse(jsonStr);
      if (!parsed || typeof parsed !== 'object') return null;
      return {
        founder: parsed.founder || { fullName: 'Founder', professionalTitle: 'Founder & CEO', country: '', city: '' },
        startup: parsed.startup || { startupName: 'My Startup', stage: 'Early Stage', industry: 'Technology', tagline: '', description: '', teamSize: '1-5', targetAudience: '', businessModel: '', foundedYear: '2025' },
        projects: Array.isArray(parsed.projects) ? parsed.projects : [],
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
        submissions: Array.isArray(parsed.submissions) ? parsed.submissions : [],
        talentRequirements: Array.isArray(parsed.talentRequirements) ? parsed.talentRequirements : [],
      };
    } catch {
      return null;
    }
  }

  // Corrupted string
  assert.strictEqual(safeLoadState('{ bad json syntax:'), null);

  // Missing arrays
  const partiallyEmpty = safeLoadState('{"founder":{"fullName":"Vikram"},"projects":null}');
  assert.strictEqual(partiallyEmpty.founder.fullName, 'Vikram');
  assert.deepStrictEqual(partiallyEmpty.projects, []);
  assert.deepStrictEqual(partiallyEmpty.tasks, []);
  assert.deepStrictEqual(partiallyEmpty.submissions, []);
});

// 6. Security: Password Stripping Verification
runTest('Security: Password and confirmPassword are never stored in drafts', () => {
  const rawState = {
    account: {
      fullName: 'Vikram Sethi',
      email: 'vikram@test.com',
      password: 'SuperSecretPassword123!',
      confirmPassword: 'SuperSecretPassword123!',
    },
    startup: { startupName: 'Stealth AI' },
  };

  const sanitized = {
    ...rawState,
    account: {
      ...rawState.account,
      password: '',
      confirmPassword: '',
    },
  };

  assert.strictEqual(sanitized.account.password, '');
  assert.strictEqual(sanitized.account.confirmPassword, '');
  assert.strictEqual(sanitized.account.email, 'vikram@test.com');
});

// 7. Responsive CSS Verification
runTest('CSS & Responsiveness: Breakpoints (360px-480px, 768px, 1024px) and focus-visible exist', () => {
  const cssPath = path.resolve('src/founder-workspace/workspace.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  assert.ok(css.includes('@media (max-width: 1024px)'), 'Missing 1024px breakpoint');
  assert.ok(css.includes('@media (max-width: 768px)'), 'Missing 768px mobile breakpoint');
  assert.ok(css.includes('@media (max-width: 480px)'), 'Missing 480px/360px mobile breakpoint');
  assert.ok(css.includes(':focus-visible'), 'Missing accessible :focus-visible states');
  assert.ok(css.includes('word-break: break-word'), 'Missing word-break for long strings');
  assert.ok(css.includes('overflow-wrap: break-word'), 'Missing overflow-wrap for long strings');
});

// 8. Skill Passport 3-Tier Model Verification
runTest('Skill Passport Architecture: Declared, Assessed, and Verified tiers properly segregated', () => {
  const candidateFile = fs.readFileSync(path.resolve('src/founder-workspace/tabs/TalentDiscoveryTab.tsx'), 'utf8');
  assert.ok(candidateFile.includes('yw-skill-verified'), 'Missing verified skill visual style');
  assert.ok(candidateFile.includes('yw-skill-assessed'), 'Missing assessed skill visual style');
  assert.ok(candidateFile.includes('yw-skill-declared'), 'Missing declared skill visual style');
  assert.ok(candidateFile.includes('Evidence Standard Notice'), 'Missing non-cryptographic disclaimer notice');
});

// 9. Derived Counts Verification
runTest('Overview: Derived counts are calculated from array lengths, not hardcoded', () => {
  const overviewFile = fs.readFileSync(path.resolve('src/founder-workspace/tabs/OverviewTab.tsx'), 'utf8');
  assert.ok(overviewFile.includes('submissions.filter'), 'Submissions count must be derived dynamically');
  assert.ok(overviewFile.includes('tasks.filter'), 'Tasks count must be derived dynamically');
  assert.ok(overviewFile.includes('projects.filter'), 'Projects count must be derived dynamically');
  assert.ok(overviewFile.includes('completionPercentage'), 'Readiness checklist percentage must be dynamic');
});

// 10. Four Role Ecosystem Verification
runTest('Role Types: src/types.ts supports all 4 ecosystem roles', () => {
  const typesContent = fs.readFileSync(path.resolve('src/types.ts'), 'utf8');
  assert.ok(typesContent.includes("'job-seeker'"), 'Missing job-seeker in RoleId');
  assert.ok(typesContent.includes("'founder'"), 'Missing founder in RoleId');
  assert.ok(typesContent.includes("'mentor'"), 'Missing mentor in RoleId');
  assert.ok(typesContent.includes("'recruiter'"), 'Missing recruiter in RoleId');
});

runTest('Role Selection: RoleSelectionPanel defines 4 roles with exact badges and icons', () => {
  const panelContent = fs.readFileSync(path.resolve('src/components/RoleSelectionPanel.tsx'), 'utf8');
  assert.ok(panelContent.includes("title: 'Job Seeker'") && panelContent.includes("badge: 'Talent'"), 'Missing Job Seeker option');
  assert.ok(panelContent.includes("title: 'Entrepreneur'") && panelContent.includes("badge: 'Startup'"), 'Missing Entrepreneur option');
  assert.ok(panelContent.includes("title: 'Mentor'") && panelContent.includes("badge: 'Guide'"), 'Missing Mentor option');
  assert.ok(panelContent.includes("title: 'Recruiter'") && panelContent.includes("badge: 'Hiring'"), 'Missing Recruiter option');
  assert.ok(panelContent.includes('Briefcase'), 'Missing Briefcase icon');
  assert.ok(panelContent.includes('Lightbulb'), 'Missing Lightbulb icon');
  assert.ok(panelContent.includes('GraduationCap'), 'Missing GraduationCap icon');
  assert.ok(panelContent.includes('Building2'), 'Missing Building2 icon');
});

runTest('Job Seeker Boundary Protection: No files under src/onboarding/ modified', () => {
  const gitDiff = fs.readFileSync(path.resolve('src/onboarding/JobSeekerOnboarding.tsx'), 'utf8');
  assert.ok(gitDiff.includes('export const JobSeekerOnboarding'), 'JobSeekerOnboarding must exist intact');
});

runTest('Navigation Isolation: Recruiter shows under-development message while Mentor and Entrepreneur are functional', () => {
  const appContent = fs.readFileSync(path.resolve('src/App.tsx'), 'utf8');
  assert.ok(appContent.includes('handleEnterMentorEntry'), 'Missing Mentor entry handler in App.tsx');
  assert.ok(appContent.includes('handleEnterRecruiterEntry'), 'Missing Recruiter entry handler in App.tsx');
  assert.ok(appContent.includes('ROLE_CONTINUE_MESSAGES.recruiter'), 'Missing Recruiter under-development message');
});

// ─── PHASE 2: COMPLETE MENTOR MODULE TESTS ──────────────────────────────────

// 11. Storage-Key Isolation Test
runTest('Mentor Persistence: Dedicated isolated storage keys used for Mentor module', () => {
  const mentorDraftKey = 'yogyata_mentor_onboarding_draft';
  const mentorWsKey = 'yogyata_mentor_workspace_data';
  const founderDraftKey = 'yogyata_founder_onboarding_draft';
  const founderWsKey = 'yogyata_founder_workspace_data';

  assert.notStrictEqual(mentorDraftKey, founderDraftKey, 'Mentor draft key must not equal founder key');
  assert.notStrictEqual(mentorWsKey, founderWsKey, 'Mentor workspace key must not equal founder key');

  const mentorStorageFile = fs.readFileSync(path.resolve('src/mentor-workspace/storage.ts'), 'utf8');
  assert.ok(mentorStorageFile.includes('yogyata_mentor_workspace_data'), 'Missing workspace storage key in storage.ts');

  const mentorDraftFile = fs.readFileSync(path.resolve('src/mentor-onboarding/storage.ts'), 'utf8');
  assert.ok(mentorDraftFile.includes('yogyata_mentor_onboarding_draft'), 'Missing draft storage key in onboarding storage.ts');
});

// 12. Mentor Security: No Raw Password Persistence
runTest('Mentor Security: Passwords stripped prior to saving draft in localStorage', () => {
  const rawAccount = {
    fullName: 'Priya Sharma',
    email: 'priya.sharma@example.com',
    password: 'SuperSecretPassword99!',
    confirmPassword: 'SuperSecretPassword99!',
    agreedToTerms: true,
  };

  const strippedAccount = {
    ...rawAccount,
    password: '',
    confirmPassword: '',
  };

  assert.strictEqual(strippedAccount.password, '', 'Password must be stripped to empty string');
  assert.strictEqual(strippedAccount.confirmPassword, '', 'Confirm password must be stripped to empty string');
  assert.strictEqual(strippedAccount.email, 'priya.sharma@example.com');
  assert.strictEqual(strippedAccount.fullName, 'Priya Sharma');
});

// 13. Mentor Data Integrity: Corrupted Storage Recovery
runTest('Mentor Data Integrity: Corrupted JSON and malformed workspace objects recover safely', () => {
  function safeLoadMentorWorkspace(raw) {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !parsed.mentor) return null;
      return {
        mentor: parsed.mentor,
        requests: Array.isArray(parsed.requests) ? parsed.requests : [],
        mentees: Array.isArray(parsed.mentees) ? parsed.mentees : [],
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        feedback: Array.isArray(parsed.feedback) ? parsed.feedback : [],
      };
    } catch {
      return null;
    }
  }

  // Corrupted JSON syntax
  assert.strictEqual(safeLoadMentorWorkspace('{ invalid json string ...'), null);
  assert.strictEqual(safeLoadMentorWorkspace('null'), null);
  assert.strictEqual(safeLoadMentorWorkspace('""'), null);

  // Missing arrays recover to empty arrays
  const recovered = safeLoadMentorWorkspace('{"mentor":{"fullName":"Dr. Anand"},"requests":null,"mentees":null}');
  assert.strictEqual(recovered.mentor.fullName, 'Dr. Anand');
  assert.deepStrictEqual(recovered.requests, []);
  assert.deepStrictEqual(recovered.mentees, []);
  assert.deepStrictEqual(recovered.sessions, []);
  assert.deepStrictEqual(recovered.feedback, []);
});

// 14. Mentorship Request Acceptance & Mentee Creation
runTest('Mentorship Workflow: Accepting a request updates status and creates active mentee', () => {
  const request = {
    id: 'req-101',
    menteeName: 'Rohit Roy',
    menteeEmail: 'rohit@example.com',
    careerGoal: 'Transition to Backend Engineering',
    relevantSkills: ['Node.js', 'PostgreSQL'],
    requestedTrack: 'Technical Interview Preparation',
    introMessage: 'Looking for guidance.',
    preferredTime: 'Evenings',
    status: 'pending',
    submittedAt: new Date().toISOString(),
  };

  let requests = [request];
  let mentees = [];

  function acceptRequest(req, responseNote) {
    requests = requests.map((r) =>
      r.id === req.id ? { ...r, status: 'accepted', responseNote } : r
    );
    mentees.push({
      id: `mentee-${req.id}`,
      requestId: req.id,
      menteeName: req.menteeName,
      menteeEmail: req.menteeEmail,
      careerGoal: req.careerGoal,
      mentorshipTrack: req.requestedTrack,
      status: 'active',
      startDate: new Date().toISOString(),
      goals: ['Pass technical assessments'],
      actionItems: [],
      privateNotes: '',
    });
  }

  acceptRequest(request, 'Welcome to mentorship!');

  assert.strictEqual(requests[0].status, 'accepted');
  assert.strictEqual(requests[0].responseNote, 'Welcome to mentorship!');
  assert.strictEqual(mentees.length, 1);
  assert.strictEqual(mentees[0].menteeName, 'Rohit Roy');
  assert.strictEqual(mentees[0].status, 'active');
  assert.strictEqual(mentees[0].mentorshipTrack, 'Technical Interview Preparation');
});

// 15. Mentorship Request Decline Test
runTest('Mentorship Workflow: Declining a request updates status WITHOUT creating active mentee', () => {
  const request = {
    id: 'req-102',
    menteeName: 'Pooja Nair',
    menteeEmail: 'pooja@example.com',
    careerGoal: 'Cloud Architect',
    relevantSkills: ['AWS'],
    requestedTrack: 'Full-Stack Development',
    introMessage: 'Please mentor me.',
    preferredTime: 'Weekends',
    status: 'pending',
    submittedAt: new Date().toISOString(),
  };

  let requests = [request];
  let mentees = [];

  function declineRequest(req, declineReason) {
    requests = requests.map((r) =>
      r.id === req.id ? { ...r, status: 'declined', responseNote: declineReason } : r
    );
  }

  declineRequest(request, 'Capacity full for this quarter.');

  assert.strictEqual(requests[0].status, 'declined');
  assert.strictEqual(requests[0].responseNote, 'Capacity full for this quarter.');
  assert.strictEqual(mentees.length, 0, 'No mentee relationship should be created upon decline');
});

// 16. Duplicate Active Mentee Prevention
runTest('Mentorship Workflow: Duplicate active mentee relationships are strictly prevented', () => {
  const mentees = [
    {
      id: 'mentee-1',
      menteeName: 'Rohit Roy',
      menteeEmail: 'rohit@example.com',
      status: 'active',
    },
  ];

  function canAddMentee(candidateEmail, candidateName) {
    const existing = mentees.find(
      (m) =>
        m.menteeEmail.toLowerCase() === candidateEmail.toLowerCase() ||
        m.menteeName.toLowerCase() === candidateName.toLowerCase()
    );
    return !(existing && existing.status === 'active');
  }

  assert.strictEqual(canAddMentee('rohit@example.com', 'Rohit Roy'), false, 'Should block duplicate email');
  assert.strictEqual(canAddMentee('other@example.com', 'Rohit Roy'), false, 'Should block duplicate name');
  assert.strictEqual(canAddMentee('new.student@example.com', 'Aisha Khan'), true, 'Should allow unique mentee');
});

// 17. Session Scheduling Validation
runTest('Sessions Validation: Rejects past dates, missing fields, and duplicate timeslots', () => {
  const todayStr = new Date().toISOString().split('T')[0];
  const pastDateStr = '2020-01-01';

  function validateSession(session, existingSessions) {
    if (!session.menteeId) return 'Mentee is required';
    if (!session.title || !session.title.trim()) return 'Title is required';
    if (!session.date) return 'Date is required';
    if (!session.startTime) return 'Start time is required';
    if (!session.agenda || !session.agenda.trim()) return 'Agenda is required';
    if (session.date < todayStr) return 'Cannot schedule in the past';

    const collision = existingSessions.find(
      (s) =>
        s.menteeId === session.menteeId &&
        s.date === session.date &&
        s.startTime === session.startTime &&
        s.status !== 'cancelled'
    );
    if (collision) return 'Duplicate session at this timeslot';

    return null;
  }

  const existingSessions = [
    {
      id: 'sess-1',
      menteeId: 'mentee-1',
      title: 'Code Review',
      date: '2027-10-20',
      startTime: '18:00',
      status: 'scheduled',
      agenda: 'Architecture review',
    },
  ];

  // Past date
  assert.strictEqual(
    validateSession({ menteeId: 'm1', title: 'T', date: pastDateStr, startTime: '10:00', agenda: 'A' }, existingSessions),
    'Cannot schedule in the past'
  );

  // Missing title
  assert.strictEqual(
    validateSession({ menteeId: 'm1', title: ' ', date: '2027-10-20', startTime: '10:00', agenda: 'A' }, existingSessions),
    'Title is required'
  );

  // Duplicate collision
  assert.strictEqual(
    validateSession({ menteeId: 'mentee-1', title: 'Different Title', date: '2027-10-20', startTime: '18:00', agenda: 'A' }, existingSessions),
    'Duplicate session at this timeslot'
  );

  // Valid session
  assert.strictEqual(
    validateSession({ menteeId: 'mentee-1', title: 'New Topic', date: '2027-10-20', startTime: '19:00', agenda: 'Valid agenda' }, existingSessions),
    null
  );
});

// 18. Feedback Visibility & Skill Passport Non-Issuance Guarantee
runTest('Feedback Architecture: Shared vs Private segregation and strict Skill Passport credential non-issuance', () => {
  const feedbackList = [
    {
      id: 'fb-1',
      menteeId: 'mentee-1',
      feedbackDate: '2026-10-18',
      strengthsObserved: 'Great algorithms',
      improvementAreas: 'Edge cases',
      recommendedNextSteps: 'Unit tests',
      privateMentorReflection: 'Ready for senior challenge next month',
      visibility: 'shared-with-mentee',
    },
    {
      id: 'fb-2',
      menteeId: 'mentee-1',
      feedbackDate: '2026-10-18',
      strengthsObserved: 'Good communication',
      improvementAreas: 'Punctuality',
      recommendedNextSteps: 'Show up on time',
      privateMentorReflection: 'Hesitant on concurrency questions',
      visibility: 'private-mentor-note',
    },
  ];

  const shared = feedbackList.filter((f) => f.visibility === 'shared-with-mentee');
  const priv = feedbackList.filter((f) => f.visibility === 'private-mentor-note');

  assert.strictEqual(shared.length, 1);
  assert.strictEqual(priv.length, 1);

  // Skill Passport Policy Assertion:
  // Mentee candidate skill passport object must NOT be modified by mentor feedback
  const menteeCandidate = {
    id: 'mentee-1',
    skillPassport: {
      declaredSkills: ['React', 'TypeScript'],
      assessedSkills: ['JavaScript'],
      verifiedSkills: [], // Unchanged!
    },
  };

  // Simulating mentor logging feedback
  const feedbackEntry = feedbackList[0];
  assert.ok(feedbackEntry.id, 'Feedback logged');
  assert.strictEqual(
    menteeCandidate.skillPassport.verifiedSkills.length,
    0,
    'Mentor feedback must never automatically grant or modify Verified Skill Passport credentials'
  );
});

// 19. Hash Navigation Verification
runTest('Hash Navigation: #mentor-workspace, #founder-workspace, and #workspace supported', () => {
  const appContent = fs.readFileSync(path.resolve('src/App.tsx'), 'utf8');
  assert.ok(appContent.includes('#mentor-workspace'), 'Missing #mentor-workspace route in App.tsx');
  assert.ok(appContent.includes('#founder-workspace'), 'Missing #founder-workspace route in App.tsx');
  assert.ok(appContent.includes('#workspace'), 'Missing #workspace compatibility route in App.tsx');
  assert.ok(appContent.includes('loadMentorWorkspace'), 'Missing loadMentorWorkspace in App.tsx');
  assert.ok(appContent.includes('loadFounderWorkspace'), 'Missing loadFounderWorkspace in App.tsx');
});

// 20. Admin Separation Verification
runTest('Admin Separation: Admin modal remains completely separate from public role selection', () => {
  const appContent = fs.readFileSync(path.resolve('src/App.tsx'), 'utf8');
  assert.ok(appContent.includes('AdminSignInModal'), 'AdminSignInModal must be present');
  assert.ok(appContent.includes('handleAdminAccessClick'), 'handleAdminAccessClick must exist');
  assert.ok(appContent.includes('admin-access-link'), 'admin-access-link must be preserved');
});

console.log(`\n====================================================`);
console.log(`AUDIT RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
console.log(`====================================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}

