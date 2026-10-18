import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Header } from './Header';
import { findStakeholder, type Stakeholder } from '../data/stakeholders';
import { supabase } from '../lib/supabase';
import type { UserRole } from '../lib/database.types';
import { ROLE_NAME } from '../lib/authRules';
import { forgetIntendedRole, rememberIntendedRole } from '../lib/intendedRole';

type Mode = 'login' | 'signup';
type Errors = Partial<Record<'name' | 'email' | 'org' | 'password' | 'confirm', string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthPage() {
  const { role } = useParams();
  const stakeholder = findStakeholder(role);
  const [params, setParams] = useSearchParams();
  const mode: Mode = params.get('mode') === 'login' ? 'login' : 'signup';
  const wrong = params.get('wrongRole');
  const wrongRole = wrong && wrong in ROLE_NAME ? (wrong as UserRole) : undefined;

  useEffect(() => {
    if (stakeholder) document.title = `${mode === 'login' ? 'Log in' : 'Sign up'} as ${stakeholder.name} · Yogyata`;
    return () => {
      document.title = 'Yogyata';
    };
  }, [mode, stakeholder]);

  if (!stakeholder) return <Navigate to="/" replace />;

  const setMode = (m: Mode) => setParams({ mode: m }, { replace: true });

  return (
    <>
      <Header compact />
      <main className="auth">
        <div className="wrap">
          <aside className="role-panel">
            <img className="role-art" src={stakeholder.art} alt="" />
            <div className="role-text">
              <p className="eyebrow">Continuing as</p>
              <h1>{stakeholder.name}</h1>
              <p className="role-group">{stakeholder.group}</p>
              <p className="role-does">{stakeholder.does}</p>
              <Link className="change" to="/">
                ← Change role
              </Link>
            </div>
          </aside>
          <AuthCard
            key={`${stakeholder.id}-${mode}`}
            stakeholder={stakeholder}
            mode={mode}
            onMode={setMode}
            wrongRole={wrongRole}
          />
        </div>
      </main>
    </>
  );
}

interface AuthCardProps {
  stakeholder: Stakeholder;
  mode: Mode;
  onMode: (m: Mode) => void;
  /** Role of the account that just tried to log in here, when it was not this page's role. */
  wrongRole?: UserRole;
}

type Status = { kind: 'info' | 'error'; text: string; resend?: string };

function AuthCard({ stakeholder: s, mode, onMode, wrongRole }: AuthCardProps) {
  const uid = useId();
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<Status | null>(() =>
    wrongRole && wrongRole !== s.id
      ? {
          kind: 'error',
          text: `That account is registered as ${ROLE_NAME[wrongRole]}, not ${s.name}. Each account has one role.`,
        }
      : null,
  );
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const signup = mode === 'signup';

  // after a failed submit, move focus to the first field that needs fixing
  useEffect(() => {
    if (Object.keys(errors).length) formRef.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus();
  }, [errors]);

  const emailValue = () => String(new FormData(formRef.current ?? undefined).get('email') ?? '').trim();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const get = (k: string) => String(data.get(k) ?? '').trim();
    const next: Errors = {};

    if (signup && !get('name')) next.name = 'Enter your full name.';
    if (!EMAIL.test(get('email'))) next.email = 'Enter a valid email, like you@college.edu.';
    if (signup && !get('org')) next.org = `Enter your ${s.signupField.label.toLowerCase()}.`;
    const password = String(data.get('password') ?? '');
    if (signup && password.length < 8) next.password = 'Use at least 8 characters.';
    if (!signup && !password) next.password = 'Enter your password.';
    if (signup && password !== String(data.get('confirm') ?? '')) next.confirm = 'Passwords do not match.';

    setErrors(next);
    setStatus(null);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      // RoleHome compares this with the account's real role and sends a mismatch back here
      rememberIntendedRole(s.id);
      if (signup) {
        // role, name and organization travel as user metadata; the on_auth_user_created trigger turns them into the profile row
        const { data: res, error } = await supabase.auth.signUp({
          email: get('email'),
          password,
          options: {
            data: { role: s.id, full_name: get('name'), organization: get('org') },
            emailRedirectTo: `${window.location.origin}/app`,
          },
        });
        if (error) throw error;
        // with email confirmation on, Supabase answers an already-used address with a user that has no identities
        if (res.user && res.user.identities?.length === 0) throw new Error(ONE_ROLE);
        if (res.session) {
          navigate('/app', { replace: true });
        } else {
          setStatus({
            kind: 'info',
            text: `Check ${get('email')} for a confirmation link.`,
            resend: get('email'),
          });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: get('email'), password });
        if (error) throw error;
        navigate('/app', { replace: true });
      }
    } catch (error) {
      forgetIntendedRole();
      const text = friendlyAuthError(error);
      setStatus({ kind: 'error', text, resend: /confirm your email/i.test(text) ? get('email') : undefined });
    } finally {
      setBusy(false);
    }
  }

  async function forgotPassword() {
    const email = emailValue();
    if (!EMAIL.test(email)) {
      setErrors({ email: 'Enter your email first, then choose Forgot password.' });
      return;
    }
    setErrors({});
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // carry the role page along, so a reset for another role's account is caught like a wrong-role login
      redirectTo: `${window.location.origin}/auth/reset?role=${s.id}`,
    });
    setBusy(false);
    // the same answer whether or not the account exists, so the form cannot be used to probe emails
    setStatus(
      error && /rate limit/i.test(error.message)
        ? { kind: 'error', text: friendlyAuthError(error) }
        : { kind: 'info', text: `If ${email} has a Yogyata account, a link to set a new password is on its way.` },
    );
  }

  async function resend(email: string) {
    setBusy(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/app` },
    });
    setBusy(false);
    setStatus(
      error
        ? { kind: 'error', text: friendlyAuthError(error), resend: email }
        : { kind: 'info', text: `A new confirmation link was sent to ${email}.` },
    );
  }

  const field = (name: keyof Errors) => ({
    id: `${uid}-${name}`,
    name,
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': errors[name] ? `${uid}-${name}-err` : undefined,
  });
  const err = (name: keyof Errors) =>
    errors[name] ? (
      <p className="err" id={`${uid}-${name}-err`}>
        {errors[name]}
      </p>
    ) : null;

  return (
    <section className="auth-card" aria-labelledby={`${uid}-title`}>
      <div className="tabs" role="tablist" aria-label="Account">
        <button type="button" role="tab" aria-selected={!signup} onClick={() => onMode('login')}>
          Log in
        </button>
        <button type="button" role="tab" aria-selected={signup} onClick={() => onMode('signup')}>
          Sign up
        </button>
      </div>

      <h2 id={`${uid}-title`}>{signup ? `Create your ${s.name} account` : `Welcome back, ${s.name}`}</h2>
      <p className="sub">
        {signup ? 'One Skill Passport for every student, built on real work.' : 'Log in to pick up where you left off.'}
      </p>

      <form ref={formRef} noValidate onSubmit={onSubmit}>
        {signup && (
          <div className="field">
            <label htmlFor={`${uid}-name`}>Full name</label>
            <input {...field('name')} type="text" autoComplete="name" placeholder="Your name" />
            {err('name')}
          </div>
        )}
        <div className="field">
          <label htmlFor={`${uid}-email`}>Email</label>
          <input {...field('email')} type="email" autoComplete="email" placeholder="you@college.edu" />
          {err('email')}
        </div>
        {signup && (
          <div className="field">
            <label htmlFor={`${uid}-org`}>{s.signupField.label}</label>
            <input {...field('org')} type="text" autoComplete={s.signupField.autoComplete} placeholder={s.signupField.placeholder} />
            {err('org')}
          </div>
        )}
        <div className="field">
          <div className="label-row">
            <label htmlFor={`${uid}-password`}>Password</label>
            <span className="label-actions">
              {!signup && (
                <button type="button" className="link" onClick={forgotPassword} disabled={busy}>
                  Forgot password?
                </button>
              )}
              <button type="button" className="link" onClick={() => setShowPassword((v) => !v)} aria-pressed={showPassword}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </span>
          </div>
          <input
            {...field('password')}
            type={showPassword ? 'text' : 'password'}
            autoComplete={signup ? 'new-password' : 'current-password'}
            placeholder={signup ? 'At least 8 characters' : 'Your password'}
          />
          {err('password')}
        </div>
        {signup && (
          <div className="field">
            <label htmlFor={`${uid}-confirm`}>Confirm password</label>
            <input {...field('confirm')} type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Type it again" />
            {err('confirm')}
          </div>
        )}

        <button className="btn" type="submit" disabled={busy}>
          {busy ? (signup ? 'Creating account…' : 'Logging in…') : signup ? `Create ${s.name} account` : 'Log in'}
        </button>
        <p className={status?.kind === 'error' ? 'status error' : 'status'} role={status?.kind === 'error' ? 'alert' : 'status'}>
          {status?.text}
          {status?.resend && (
            <>
              {' '}
              <button type="button" className="link" onClick={() => resend(status.resend!)} disabled={busy}>
                Resend confirmation email
              </button>
            </>
          )}
        </p>
      </form>

      <p className="switch">
        {signup ? 'Already have an account? ' : 'New to Yogyata? '}
        <button type="button" className="link" onClick={() => onMode(signup ? 'login' : 'signup')}>
          {signup ? 'Log in' : 'Sign up'}
        </button>
      </p>
    </section>
  );
}

const ONE_ROLE =
  'This email, or a variation of it, already has a Yogyata account. Each email holds one role: log in on the page for the role it was registered with.';

/** Supabase auth errors carry a stable `code`; the message wording is not guaranteed. */
function authErrorCode(error: unknown): string {
  if (typeof error !== 'object' || error === null || !('code' in error)) return '';
  return String((error as { code?: unknown }).code ?? '');
}

function friendlyAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const code = authErrorCode(error);
  if (/invalid login credentials/i.test(message)) return 'That email and password do not match an account.';
  if (/email not confirmed/i.test(message)) return 'Confirm your email first: open the link we sent you, then log in.';
  if (/already registered/i.test(message) || message === ONE_ROLE) return ONE_ROLE;
  // the project's own hourly cap on confirmation emails, not anything this person did
  if (code === 'over_email_send_rate_limit' || /email rate limit/i.test(message))
    return 'Your account was not created: Yogyata has hit its hourly limit for confirmation emails. Wait an hour and try again, or ask the Yogyata team to set up email delivery.';
  if (/rate limit/i.test(message)) return 'Too many attempts. Wait a few minutes and try again.';
  // the sign-up trigger's reasons reach the browser only as this generic message; a reused email is the
  // usual cause, but any rule still enforced in the trigger (such as a work-email check) also lands here
  if (/database error saving new user/i.test(message)) return ONE_ROLE;
  if (/same.*password|different from the old/i.test(message)) return 'Choose a password you have not used here before.';
  if (/weak|pwned|leaked/i.test(message)) return 'That password appears in known data leaks. Choose a different one.';
  if (/failed to fetch|network/i.test(message)) return 'Could not reach the server. Check your connection and try again.';
  return message;
}
