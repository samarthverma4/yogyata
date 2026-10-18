import { lazy, useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { findStakeholder } from '../data/stakeholders';
import { Header } from './Header';
import { loadFounderWorkspace } from '../founder-workspace/storage';
import { hasMentorProfile, saveMentorOnboarding } from '../lib/mentorData';
import { hasRecruiterProfile, saveRecruiterOnboarding } from '../lib/recruiterData';
import { saveSeekerOnboarding } from '../lib/seekerData';
import { supabase } from '../lib/supabase';
import { forgetIntendedRole, peekIntendedRole } from '../lib/intendedRole';

// Each role loads only its own screens (code-splitting, as upstream does with React.lazy).
const JobSeekerOnboarding = lazy(() => import('../onboarding/JobSeekerOnboarding').then((m) => ({ default: m.JobSeekerOnboarding })));
const FounderOnboarding = lazy(() => import('../founder-onboarding/FounderOnboarding').then((m) => ({ default: m.FounderOnboarding })));
const FounderWorkspace = lazy(() => import('../founder-workspace/FounderWorkspace').then((m) => ({ default: m.FounderWorkspace })));
const SeekerWorkspace = lazy(() => import('../seeker-workspace/SeekerWorkspace').then((m) => ({ default: m.SeekerWorkspace })));
const MentorWorkspace = lazy(() => import('../mentor-workspace/MentorWorkspace').then((m) => ({ default: m.MentorWorkspace })));
const RecruiterWorkspace = lazy(() => import('../recruiter-workspace/RecruiterWorkspace').then((m) => ({ default: m.RecruiterWorkspace })));
const MentorOnboarding = lazy(() => import('../mentor-onboarding/MentorOnboarding').then((m) => ({ default: m.MentorOnboarding })));
const RecruiterOnboarding = lazy(() => import('../recruiter-onboarding/RecruiterOnboarding').then((m) => ({ default: m.RecruiterOnboarding })));

/** Sends a signed-in user to the area for the role stored on their Supabase profile. */
export function RoleHome() {
  const { session, profile, profileError, signOut } = useAuth();
  const { area } = useParams();
  // where to go once signed out: home, or back to the log in page after a wrong-role login
  const [exitTo, setExitTo] = useState('/');
  // the role page this login started from; read in render, cleared once handled
  const [intended] = useState(peekIntendedRole);
  const mismatch = Boolean(profile && intended && intended !== profile.role);

  useEffect(() => {
    if (!profile) return;
    forgetIntendedRole();
    if (mismatch && intended) {
      const target = `/auth/${intended}?mode=login&wrongRole=${profile.role}`;
      // set the target before signing out, so the signed-out redirect returns to that log in page
      void Promise.resolve().then(() => {
        setExitTo(target);
        return signOut();
      });
    }
  }, [profile, mismatch, intended, signOut]);

  if (session === undefined || (session && profile === undefined)) return <p className="yg-loading">Loading…</p>;
  if (!session) return <Navigate to={exitTo} replace />;
  if (!profile) return <RoleShell title="Profile missing" note={profileError || 'No profile was found for this account.'} onSignOut={signOut} />;
  if (mismatch) return <p className="yg-loading">Checking your role…</p>;
  // every role lives at its own address; someone typing another role's URL lands back on theirs
  if (area !== profile.role) return <Navigate to={`/app/${profile.role}`} replace />;

  const account = { fullName: profile.full_name, email: session.user.email ?? '' };
  const leave = async () => {
    setExitTo('/');
    await signOut();
  };

  switch (profile.role) {
    case 'entrepreneur':
      return <FounderArea account={account} onSignOut={leave} />;
    case 'seeker':
      return <SeekerArea userId={profile.id} account={account} onSignOut={leave} />;
    case 'mentor':
      return <MentorArea userId={profile.id} account={account} onSignOut={leave} />;
    case 'recruiter':
      return (
        <RecruiterArea userId={profile.id} account={account} onSignOut={leave} />
      );
    default:
      return (
        <RoleShell
          role={profile.role}
          title={`Welcome, ${profile.full_name.split(' ')[0]}`}
          note="Your workspace is being built next. You will land here automatically once it is ready."
          onSignOut={leave}
        />
      );
  }
}

function FounderArea({ account, onSignOut }: { account: { fullName: string; email: string }; onSignOut: () => void }) {
  const [hasWorkspace, setHasWorkspace] = useState(() => loadFounderWorkspace() !== null);
  if (hasWorkspace) return <FounderWorkspace cloudSync onExitToHome={onSignOut} />;
  return (
    <div className="yogyata-app">
      <FounderOnboarding account={account} onExit={onSignOut} onEnterWorkspace={() => setHasWorkspace(true)} />
    </div>
  );
}

function SeekerArea({
  userId,
  account,
  onSignOut,
}: {
  userId: string;
  account: { fullName: string; email: string };
  onSignOut: () => void;
}) {
  // undefined while checking whether onboarding answers are already saved
  const [details, setDetails] = useState<{ headline: string; primaryRole: string } | null | undefined>(undefined);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    supabase
      .from('seeker_details')
      .select('headline, answers')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!live) return;
        const goals = (data?.answers as { careerGoals?: { primaryRole?: string } } | null)?.careerGoals;
        setDetails(data ? { headline: data.headline, primaryRole: goals?.primaryRole ?? '' } : null);
      });
    return () => {
      live = false;
    };
  }, [userId]);

  if (details === undefined) return <p className="yg-loading">Loading…</p>;
  if (details) return <SeekerWorkspace userId={userId} fullName={account.fullName} headline={details.headline} primaryRole={details.primaryRole} onSignOut={onSignOut} />;

  return (
    <div className="yogyata-app">
      {error && (
        <p className="yg-sync-error" role="alert">
          {error}
        </p>
      )}
      <JobSeekerOnboarding
        account={account}
        onExit={onSignOut}
        onComplete={async (state) => {
          const res = await saveSeekerOnboarding(userId, state);
          if (res.error) setError(`Your answers could not be saved: ${res.error}`);
          else
            setDetails({
              headline: state.professional.headline || state.professional.currentTitle || '',
              primaryRole: state.careerGoals.primaryRole,
            });
        }}
      />
    </div>
  );
}

/** Simple signed-in page in the Yogyata style, used until a role's workspace exists. */
function RoleShell({ role, title, note, onSignOut }: { role?: string; title: string; note: string; onSignOut: () => void }) {
  const stakeholder = findStakeholder(role);
  return (
    <>
      <Header compact />
      <main className="auth home">
        <div className="wrap">
          <aside className="role-panel">
            {stakeholder && <img className="role-art" src={stakeholder.art} alt="" />}
            <div className="role-text">
              <p className="eyebrow">Signed in as</p>
              <h1>{stakeholder?.name ?? 'Member'}</h1>
              {stakeholder && <p className="role-group">{stakeholder.group}</p>}
            </div>
          </aside>
          <section className="auth-card">
            <h2>{title}</h2>
            <p className="sub">{note}</p>
            <button className="btn ghost" type="button" onClick={onSignOut}>
              Sign out
            </button>
          </section>
        </div>
      </main>
    </>
  );
}

/** Mentors fill in their profile once (upstream onboarding), then land in the workspace. */
function MentorArea({
  userId,
  account,
  onSignOut,
}: {
  userId: string;
  account: { fullName: string; email: string };
  onSignOut: () => void;
}) {
  // undefined while checking whether the profile is already saved
  const [ready, setReady] = useState<boolean | undefined>(undefined);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    let live = true;
    hasMentorProfile(userId).then((has) => live && setReady(has));
    return () => {
      live = false;
    };
  }, [userId]);

  if (ready === undefined) return <p className="yg-loading">Loading…</p>;
  if (ready || entered) return <MentorWorkspace userId={userId} email={account.email} onSignOut={onSignOut} />;
  return (
    <div className="yogyata-app">
      <MentorOnboarding
        account={account}
        onExit={onSignOut}
        onSave={async (state) => (await saveMentorOnboarding(userId, state)).error}
        onEnterWorkspace={() => setEntered(true)}
      />
    </div>
  );
}

/** Recruiters fill in their company and hiring profile once (upstream onboarding), then land in the workspace. */
function RecruiterArea({
  userId,
  account,
  onSignOut,
}: {
  userId: string;
  account: { fullName: string; email: string };
  onSignOut: () => void;
}) {
  const [ready, setReady] = useState<boolean | undefined>(undefined);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    let live = true;
    hasRecruiterProfile(userId).then((has) => live && setReady(has));
    return () => {
      live = false;
    };
  }, [userId]);

  if (ready === undefined) return <p className="yg-loading">Loading…</p>;
  if (ready || entered) return <RecruiterWorkspace userId={userId} onSignOut={onSignOut} />;
  return (
    <div className="yogyata-app">
      <RecruiterOnboarding
        account={account}
        onExit={onSignOut}
        onSave={async (state) => (await saveRecruiterOnboarding(userId, state)).error}
        onEnterWorkspace={() => setEntered(true)}
      />
    </div>
  );
}
