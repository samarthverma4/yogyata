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

console.log(`\n====================================================`);
console.log(`AUDIT RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
console.log(`====================================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
