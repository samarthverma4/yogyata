// The role page someone logged in from, kept for this tab only. RoleHome compares it with the
// account's real role, so logging in on the Mentor page with a Seeker account is caught.
const KEY = 'yogyata-intended-role';

export function rememberIntendedRole(role: string) {
  try {
    sessionStorage.setItem(KEY, role);
  } catch {
    /* storage unavailable: the role check is skipped */
  }
}

export function forgetIntendedRole() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}

/** Reads the remembered role without clearing it (safe to call during render). */
export function peekIntendedRole(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}
