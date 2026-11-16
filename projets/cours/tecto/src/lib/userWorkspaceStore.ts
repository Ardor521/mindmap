import type { MapKind } from './types';

export type StoredWorkspace = {
  id: string;
  name: string;
  graphJson: string;
  mapKind?: MapKind;
  updatedAt?: string;
};

export type UserWorkspaceState = {
  workspaces: StoredWorkspace[];
  activeWorkspaceId: string;
};

const KEY = (userId: string) => `ku:workspaces:${userId}`;
const LEGACY_KEYS = (userId: string) => [
  `ku:u:${userId}:workspaces`,
  `ku:workspaces:${userId}`,
  `ku:workspaces`,
  `ku:u:${userId}:workspaces:v2`,
];

function isValidState(raw: unknown): raw is UserWorkspaceState {
  if (!raw || typeof raw !== 'object') return false;
  const o = raw as Record<string, unknown>;
  return Array.isArray(o.workspaces) && typeof o.activeWorkspaceId === 'string';
}

function normalizeState(raw: unknown): UserWorkspaceState | null {
  if (!isValidState(raw)) return null;
  const o = raw as UserWorkspaceState;
  const workspaces = o.workspaces.filter(
    (w) => w && typeof w.id === 'string' && typeof w.name === 'string' && typeof w.graphJson === 'string'
  );
  return { workspaces, activeWorkspaceId: String(o.activeWorkspaceId || workspaces[0]?.id || '') };
}

/** Charge les espaces de l'utilisateur — persiste désormais (fix menu déroulant vide) */
export function loadUserWorkspaces(userId: string): UserWorkspaceState {
  const keys = [KEY(userId), ...LEGACY_KEYS(userId)];
  for (const k of keys) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const norm = normalizeState(parsed);
      if (norm && norm.workspaces.length > 0) {
        // migrate to canonical key if needed
        if (k !== KEY(userId)) {
          try { localStorage.setItem(KEY(userId), JSON.stringify(norm)); } catch {}
        }
        return norm;
      }
      // keep empty but valid state as fallback
      if (norm) return norm;
    } catch {}
  }
  return { workspaces: [], activeWorkspaceId: '' };
}

/** Sauvegarde immédiate — sans debounce pour que le rechargement retrouve tout */
export function saveUserWorkspaces(userId: string, state: UserWorkspaceState) {
  if (!userId || userId === 'anon') return;
  const norm = normalizeState(state) ?? { workspaces: [], activeWorkspaceId: '' };
  try {
    localStorage.setItem(KEY(userId), JSON.stringify(norm));
  } catch {}
}

/** Ne purge plus les espaces — seulement les clés legacy corrompues */
export function resetWorkspacesIfLegacyClutter(_userId: string): UserWorkspaceState {
  // no-op: we no longer wipe workspaces on login. Keep for compat.
  return { workspaces: [], activeWorkspaceId: '' };
}

// helper to get all workspace keys for debugging
export function listWorkspaceKeys(): string[] {
  const out: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.includes('workspaces') || k.includes('ku:u:'))) out.push(k);
    }
  } catch {}
  return out;
}
