// ==============================================================
// AINCRAD STREAM — FICHIER STABLE QUI NE SERA PLUS MODIFIÉ
// Tu modifies UNIQUEMENT la ligne DISK_ROOT_PATH ci-dessous.
// Exemples:
//   Windows : "E:/external_USB" ou "E:/external_USB/anime"
//   Mac     : "/Volumes/external_USB/anime"
// Ce chemin est affiché dans l'UI à titre informatif et pour mémoire.
// Le navigateur demande toujours une seule fois l'autorisation du dossier,
// puis le handle est sauvé en IndexedDB pour éviter la demande suivante.
// ==============================================================

export const DISK_ROOT_PATH = "D:\anime";

export const DISK_CONFIG = {
  rootPath: DISK_ROOT_PATH,
  diskName: "external_USB",
};
