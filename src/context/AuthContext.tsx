import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  bootstrapUsersDb,
  changePassword,
  downloadUsersFile,
  exportUsersFileJson,
  getCurrentUser,
  getInviteCode,
  getUsersDbSnapshot,
  importUsersFileJson,
  listUsernames,
  loginUser,
  logoutUser,
  registerUser,
  requestPasswordReset,
  resetPassword,
  setCurrentUserEmail,
  updateCurrentUser,
  type PublicUser,
  type UsersFile,
} from '../lib/auth';

interface AuthContextValue {
  user: PublicUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (input: {
    username: string;
    email?: string;
    password: string;
    inviteCode: string;
  }) => Promise<{ ok: boolean; error?: string; nextInviteCode?: string }>;
  logout: () => void;
  refresh: () => void;
  updateProfile: (patch: {
    name?: string;
    email?: string;
    favoriteIcons?: string[];
    shortcutsNote?: string;
  }) => void;
  changePassword: (
    current: string,
    next: string
  ) => Promise<{ ok: boolean; error?: string }>;
  requestPasswordReset: (email: string) => Promise<{ ok: boolean; error?: string; message?: string; token?: string }>;
  resetPassword: (email: string, token: string, newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  setEmail: (email: string) => Promise<{ ok: boolean; error?: string }>;
  exportUsersFile: () => string;
  downloadUsersFile: () => void;
  importUsersFile: (raw: string) => { ok: boolean; error?: string };
  getInviteCode: () => string;
  listUsernames: () => string[];
  getDbSnapshot: () => UsersFile;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setUser(getCurrentUser());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await bootstrapUsersDb();
      } finally {
        if (!cancelled) {
          setUser(getCurrentUser());
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await loginUser(username, password);
    if (!res.ok) return { ok: false, error: res.error };
    setUser(res.user);
    return { ok: true };
  }, []);

  const register = useCallback(
    async (input: { username: string; email?: string; password: string; inviteCode: string }) => {
      const res = await registerUser(input as any);
      if (!res.ok) return { ok: false, error: res.error };
      setUser(res.user);
      return { ok: true, nextInviteCode: res.nextInviteCode };
    },
    []
  );

  const logout = useCallback(() => {
    logoutUser();
    setUser(null);
  }, []);

  const updateProfile = useCallback(
    (patch: { name?: string; email?: string; favoriteIcons?: string[]; shortcutsNote?: string }) => {
      const u = updateCurrentUser(patch as any);
      if (!u) return { ok: false as const, error: 'E-mail invalide ou déjà utilisé.' };
      setUser(u);
      return { ok: true as const };
    },
    []
  );
  const requestReset = useCallback(async (email: string) => {
    return requestPasswordReset(email);
  }, []);
  const confirmReset = useCallback(async (email: string, token: string, newPassword: string) => {
    return resetPassword(email, token, newPassword);
  }, []);
  const setEmail = useCallback(async (email: string) => {
    const r = setCurrentUserEmail(email);
    if (!r.ok) return { ok: false, error: r.error };
    setUser(r.user);
    return { ok: true };
  }, []);

  const changePwd = useCallback(async (current: string, next: string) => {
    const res = await changePassword(current, next);
    if (!res.ok) return { ok: false, error: res.error };
    return { ok: true };
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      refresh,
      updateProfile,
      changePassword: changePwd,
      requestPasswordReset: requestReset,
      resetPassword: confirmReset,
      setEmail,
      exportUsersFile: exportUsersFileJson,
      downloadUsersFile: () => {
        downloadUsersFile('users.json');
      },
      importUsersFile: (raw: string) => {
        const r = importUsersFileJson(raw);
        if (!r.ok) return { ok: false, error: r.error };
        refresh();
        return { ok: true };
      },
      getInviteCode,
      listUsernames,
      getDbSnapshot: getUsersDbSnapshot,
    }),
    [user, loading, login, register, logout, refresh, updateProfile, changePwd, requestReset, confirmReset, setEmail]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
