import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Header } from './Header';
import { useAuth } from '../lib/auth-context';
import { supabase } from '../lib/supabase';
import { rememberIntendedRole } from '../lib/intendedRole';

/** Where the "set a new password" email link lands. The link itself signs the user in for this one step. */
export function ResetPasswordPage() {
  const uid = useId();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  // an expired or reused link comes back with an error in the URL hash instead of a session
  const [linkError] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('error_description'));
  const [waited, setWaited] = useState(false);

  useEffect(() => {
    document.title = 'Set a new password · Yogyata';
    // give the client a moment to read the session from the link before calling it invalid
    const t = window.setTimeout(() => setWaited(true), 2500);
    return () => {
      window.clearTimeout(t);
      document.title = 'Yogyata';
    };
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError('Use at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) {
      setError(
        /same|different from the old/i.test(err.message)
          ? 'Choose a password you have not used here before.'
          : /weak|pwned|leaked/i.test(err.message)
            ? 'That password appears in known data leaks. Choose a different one.'
            : err.message,
      );
      return;
    }
    // the email link opens in a new tab, so hand RoleHome the role page the reset started from
    const role = new URLSearchParams(window.location.search).get('role');
    if (role) rememberIntendedRole(role);
    navigate('/app', { replace: true });
  }

  const invalid = !session && (linkError || waited);

  return (
    <>
      <Header compact />
      <main className="auth">
        <div className="wrap reset-wrap">
          <section className="auth-card" aria-labelledby={`${uid}-title`}>
            <h2 id={`${uid}-title`}>Set a new password</h2>
            {invalid ? (
              <>
                <p className="sub">
                  This link has expired or was already used. Ask for a new one from the log in page, using Forgot password.
                </p>
                <Link className="btn" to="/">
                  Back to Yogyata
                </Link>
              </>
            ) : !session ? (
              <p className="sub">Checking your link…</p>
            ) : (
              <form noValidate onSubmit={save}>
                <p className="sub">For {session.user.email}. You stay logged in afterwards.</p>
                <div className="field">
                  <div className="label-row">
                    <label htmlFor={`${uid}-pw`}>New password</label>
                    <button type="button" className="link" onClick={() => setShow((v) => !v)} aria-pressed={show}>
                      {show ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <input
                    id={`${uid}-pw`}
                    type={show ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor={`${uid}-confirm`}>Confirm new password</label>
                  <input
                    id={`${uid}-confirm`}
                    type={show ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Type it again"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </div>
                <button className="btn" type="submit" disabled={busy}>
                  {busy ? 'Saving…' : 'Save new password'}
                </button>
                <p className="status error" role="alert">
                  {error}
                </p>
              </form>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
