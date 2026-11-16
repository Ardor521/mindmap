import type { UsersFile } from './auth';

/** Fetch shared users DB from API (Vite plugin / server / Vercel). */
export async function fetchUsersRemote(): Promise<UsersFile | null> {
  try {
    const res = await fetch(`/api/users?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data !== 'object') return null;
    return {
      version: 2,
      inviteCode:
        typeof data.inviteCode === 'string' && data.inviteCode.trim()
          ? data.inviteCode.trim()
          : 'KU-FIRST-ACCESS',
      users: Array.isArray(data.users) ? data.users : [],
    };
  } catch {
    return null;
  }
}

/** Persist users DB to API → writes public/users.json on Node (dev/server). */
export async function pushUsersRemote(db: UsersFile): Promise<boolean> {
  try {
    const res = await fetch('/api/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        version: 2,
        inviteCode: db.inviteCode,
        users: db.users,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
