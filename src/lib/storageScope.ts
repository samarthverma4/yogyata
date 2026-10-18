// Browser storage belongs to the signed-in account, so two people sharing a browser never
// open (or sync to Supabase) each other's founder drafts and workspaces.
let owner = '';

/** Called with the signed-in user's id before any account data is read. */
export function setStorageOwner(userId: string) {
  owner = userId;
}

/**
 * The per-account key for `base`. Data saved before keys were per-account is handed to the
 * first account that reads it, then removed, so it can never reach a second account.
 */
export function scopedKey(base: string): string {
  if (!owner) return base;
  const key = `${base}:${owner}`;
  try {
    const legacy = localStorage.getItem(base);
    if (legacy !== null) {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, legacy);
      localStorage.removeItem(base);
    }
  } catch {
    /* storage unavailable: callers already handle that */
  }
  return key;
}
