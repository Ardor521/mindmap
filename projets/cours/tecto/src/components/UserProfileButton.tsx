
import { useState } from 'react';
import { User, X } from 'lucide-react';

export interface UserProfile { id: string; name: string; favoriteIcons: string[]; shortcutsNote: string; }

export function UserProfileButton({ profile, onChange }: { profile: UserProfile; onChange: (p: UserProfile) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(profile.name);
  const [note, setNote] = useState(profile.shortcutsNote);
  return (
    <>
      <button type="button" onClick={() => { setName(profile.name); setNote(profile.shortcutsNote); setOpen(true); }}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-white/10 bg-[#12121a]/85 backdrop-blur text-[11px] text-white/70 hover:text-white hover:bg-white/8 max-w-[160px]" title="Profil utilisateur">
        <User size={14} className="text-violet-300 shrink-0" />
        <span className="truncate">{profile.name || 'Profil'}</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#14141e] shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 p-4 border-b border-white/8">
              <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center"><User size={18} className="text-violet-300" /></div>
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-white/95">Profil utilisateur</h2>
                <p className="text-[11px] text-white/40">Préférences perso — distinctes des espaces.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-white/30 hover:bg-white/8"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-white/35 font-semibold">Nom</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/90 outline-none focus:border-violet-500/40" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-white/35 font-semibold">Id local</label>
                <div className="mt-1 text-[11px] font-mono text-white/35 px-2 py-1.5 rounded-lg bg-white/4 border border-white/8">{profile.id}</div>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-white/35 font-semibold">Notes</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/80 outline-none resize-none" />
              </div>
            </div>
            <div className="p-4 border-t border-white/8 flex gap-2">
              <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white/60">Annuler</button>
              <button type="button" onClick={() => { onChange({ ...profile, name: name.trim() || 'Utilisateur', shortcutsNote: note }); setOpen(false); }}
                className="flex-1 py-2.5 rounded-xl bg-violet-500/25 border border-violet-500/40 text-sm text-violet-100">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
