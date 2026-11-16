const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');

let server;
let win;

async function waitForServer(url) {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return true;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return false;
}

app.whenReady().then(async () => {
  server = spawn(
    'npm.cmd',
    ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173', '--strictPort'],
    { cwd: __dirname, shell: true, stdio: 'inherit' }
  );

  const ready = await waitForServer('http://127.0.0.1:5173');

  if (!ready) {
    console.error('Vite ne demarre pas. Verifie les erreurs dans le terminal.');
    app.quit();
    return;
  }

  win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'Agon Agent',
    autoHideMenuBar: true
  });

  win.loadURL('http://127.0.0.1:5173');
});

app.on('before-quit', () => {
  if (server) server.kill();
});

app.on('window-all-closed', () => app.quit());
