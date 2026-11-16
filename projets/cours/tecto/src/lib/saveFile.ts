// File System Access — save + autosave every 3 min to the last picked file
// If no file was ever picked (no handle), no autosave happens (spec).

let cachedHandle: FileSystemFileHandle | null = null;
let cachedFilename: string | null = null;
let cachedMime: string | null = null;

const DB_NAME = 'ku-autosave';
const STORE = 'handles';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function persistHandle(handle: FileSystemFileHandle, filename: string, mime: string) {
  cachedHandle = handle;
  cachedFilename = filename;
  cachedMime = mime;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ id: 'last', handle, filename, mime, savedAt: Date.now() });
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
      tx.onabort = () => rej(tx.error);
    });
  } catch {
    // memory only — still usable this session
  }
}

export async function getStoredHandleInfo(): Promise<{ handle: FileSystemFileHandle; filename: string; mime: string } | null> {
  if (cachedHandle && cachedFilename) return { handle: cachedHandle, filename: cachedFilename!, mime: cachedMime || 'application/json' };
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get('last');
    const rec: any = await new Promise((res, rej) => {
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    if (rec?.handle) {
      cachedHandle = rec.handle;
      cachedFilename = rec.filename || 'mon-univers.json';
      cachedMime = rec.mime || 'application/json';
      return { handle: cachedHandle!, filename: cachedFilename!, mime: cachedMime! };
    }
  } catch {}
  return null;
}

export async function hasStoredHandle(): Promise<boolean> {
  const info = await getStoredHandleInfo();
  return !!info?.handle;
}

export async function clearStoredHandle(): Promise<void> {
  cachedHandle = null;
  cachedFilename = null;
  cachedMime = null;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete('last');
  } catch {}
}

async function ensurePermission(handle: FileSystemFileHandle): Promise<boolean> {
  const h: any = handle as any;
  try {
    if (h.queryPermission) {
      let p = await h.queryPermission({ mode: 'readwrite' });
      if (p === 'granted') return true;
      if (h.requestPermission) {
        p = await h.requestPermission({ mode: 'readwrite' });
        return p === 'granted';
      }
    }
  } catch {}
  return true;
}

/** Try to overwrite the last picked file without dialog. Returns 'saved'|'no-handle'|'error' */
export async function tryAutoSave(content: string): Promise<'saved' | 'no-handle' | 'error'> {
  const info = await getStoredHandleInfo();
  if (!info?.handle) return 'no-handle';
  try {
    const ok = await ensurePermission(info.handle);
    if (!ok) return 'error';
    const mime = info.mime || 'application/json';
    const blob = new Blob([content], { type: mime });
    const writable: any = await (info.handle as any).createWritable();
    await writable.write(blob);
    await writable.close();
    return 'saved';
  } catch (e) {
    console.warn('[autosave] write failed', e);
    return 'error';
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  // Must be in DOM for Firefox
  document.body.appendChild(a);
  a.click();
  // Delay revoke to avoid Safari bug
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 400);
}

export async function saveTextFile(filename: string, content: string, mime: string): Promise<'saved' | 'downloaded' | 'cancelled'> {
  const blob = new Blob([content], { type: mime });
  const w = window as Window & { showSaveFilePicker?: (o?: unknown) => Promise<FileSystemFileHandle> };
  // In cross-origin iframe (Vercel preview) the picker is blocked — detect and skip to fallback
  const inIframe = (() => { try { return window.self !== window.top; } catch { return true; }})();
  const canUsePicker = typeof w.showSaveFilePicker === 'function' && window.isSecureContext && !inIframe;

  if (canUsePicker) {
    try {
      const ext = filename.includes('.') ? filename.split('.').pop()! : 'json';
      const handle = await w.showSaveFilePicker!({
        suggestedName: filename,
        types: [{ description: ext.toUpperCase(), accept: { [mime]: [`.${ext}`] } }],
      });
      const writable: any = await (handle as any).createWritable();
      await writable.write(blob);
      await writable.close();
      // Persist handle for autosave — do not let a DB error break the save result
      if (mime === 'application/json') {
        try { await persistHandle(handle, filename, mime); } catch {}
      } else {
        try {
          const cur = await getStoredHandleInfo();
          if (!cur) await persistHandle(handle, filename, mime);
        } catch {}
      }
      return 'saved';
    } catch (err: any) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
      // NotAllowedError / SecurityError / etc. → fall through to download
      console.warn('[save] picker failed, fallback to download', err?.name || err);
    }
  }
  try {
    downloadBlob(blob, filename);
    return 'downloaded';
  } catch (e) {
    console.error('[save] download fallback failed', e);
    return 'cancelled';
  }
}
