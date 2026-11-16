import { Keyboard, Mouse, X, Link2 } from 'lucide-react';
import { FeatureGuideCTA } from './FeatureGuideCTA';

export function HelpOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#14141e] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-white/8">
          <h2 className="text-sm font-semibold text-white/90">Navigation</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/40 hover:bg-white/8"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-4 text-sm text-white/60">
          <div onClick={onClose}>
            <FeatureGuideCTA variant="banner" />
          </div>
          <div className="flex gap-3">
            <Mouse size={18} className="text-violet-400 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <p><span className="text-white/85">Glisser</span> — déplacer la vue</p>
              <p><span className="text-white/85">Molette</span> — zoom infini</p>
              <p><span className="text-white/85">Clic</span> — sélectionner</p>
              <p><span className="text-white/85">Ctrl+clic</span> — ajouter/retirer concept ou lien à la sélection</p>
              <p><span className="text-white/85">Shift/Ctrl+C</span> — mode multi concepts (+ rectangle)</p>
              <p><span className="text-white/85">Shift/Ctrl+L</span> — mode multi liens (+ rectangle)</p>
              <p><span className="text-white/85">Frise</span> — bouton « Chronologiquement » : nouvel événement sur la ligne, même taille</p>
              <p><span className="text-white/85">Clic concept</span> — illumine TOUS les chemins vers les racines</p>
              <p><span className="text-white/85">Nouvel espace (+)</span> — choisir Univers 3D ou Mindmap 2D à la création</p>
              <p><span className="text-white/85">Image (info)</span> — clic pour agrandir</p>
              <p><span className="text-white/85">Compte</span> — connexion · fichier users · code d’invitation unique</p>
              <p><span className="text-white/85">Double-clic nœud</span> — plonger</p>
              <p><span className="text-white/85">Double-clic vide</span> — créer</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Link2 size={18} className="text-cyan-400 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <p><span className="text-white/85">C</span> — mode connexion · Entrée pour valider</p>
              <p><span className="text-white/85">Clic lien</span> — caractéristiques</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Keyboard size={18} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <p><kbd className="px-1.5 py-0.5 rounded bg-white/8 text-[11px] font-mono">↑↓←→</kbd> — parcourir les liens · <kbd className="px-1.5 py-0.5 rounded bg-white/8 text-[11px] font-mono">Entrée</kbd> valider</p>
              <p><kbd className="px-1.5 py-0.5 rounded bg-white/8 text-[11px] font-mono">⌘K</kbd> — recherche</p>
              <p><kbd className="px-1.5 py-0.5 rounded bg-white/8 text-[11px] font-mono">⌘Z</kbd> — annuler</p>
              <p><kbd className="px-1.5 py-0.5 rounded bg-white/8 text-[11px] font-mono">N</kbd> — nouveau</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
