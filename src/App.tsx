import { Suspense, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth-context';
import { Header } from './pages/Header';
import { RolePicker } from './pages/RolePicker';
import { AuthPage } from './pages/AuthPage';
import { RoleHome } from './pages/RoleHome';
import { ResetPasswordPage } from './pages/ResetPasswordPage';

/** Signed-in users skip the public pages and go straight to their role's area. */
function PublicOnly({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  if (session === undefined) return null;
  if (session) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

function App() {
  const { pathname } = useLocation();
  // each page change starts at the top; switching log in / sign up tabs (same path) keeps the scroll
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <Routes>
      <Route
        path="/"
        element={
          <PublicOnly>
            <Header />
            <RolePicker />
          </PublicOnly>
        }
      />
      <Route
        path="/auth/:role"
        element={
          <PublicOnly>
            <AuthPage />
          </PublicOnly>
        }
      />
      {/* the reset link signs the user in, so this page must not bounce signed-in visitors */}
      <Route path="/auth/reset" element={<ResetPasswordPage />} />
      <Route
        path="/app/:area?"
        element={
          <Suspense fallback={<p className="yg-loading">Loading…</p>}>
            <RoleHome />
          </Suspense>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
