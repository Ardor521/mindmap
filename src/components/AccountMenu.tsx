
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronDown, LogOut, Settings, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function AccountMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  if (!user) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-white/10 bg-[#12121a]/85 backdrop-blur text-[11px] text-white/70 hover:text-white hover:bg-white/8 max-w-[200px]"
      >
        <div className="w-5 h-5 rounded-md bg-violet-500/25 flex items-center justify-center shrink-0">
          <User size={12} className="text-violet-300" />
        </div>
        <span className="truncate">{user.name}</span>
        <ChevronDown size={12} className="text-white/30 shrink-0" />
      </button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-[120]" onClick={() => setOpen(false)} aria-label="Fermer" />
          <div className="absolute right-0 mt-1.5 w-56 z-[130] rounded-xl border border-white/10 bg-[#14141e] shadow-2xl overflow-hidden">
            <div className="px-3 py-2.5 border-b border-white/8">
              <div className="text-xs font-medium text-white/90 truncate">{user.name}</div>
              <div className="text-[10px] text-white/35 truncate">{user.username}</div>
            </div>
            <Link
              to="/app?guide=1"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-xs text-amber-100/90 hover:bg-amber-500/10"
            >
              <BookOpen size={13} /> Guide 2D / 3D
            </Link>
            <Link
              to="/account"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-xs text-white/70 hover:bg-white/5"
            >
              <Settings size={13} /> Compte & fichier users
            </Link>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-300/80 hover:bg-rose-500/10 border-t border-white/8"
            >
              <LogOut size={13} /> Déconnexion
            </button>
          </div>
        </>
      )}
    </div>
  );
}
