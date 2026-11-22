const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { start } = require('./server');

let srv;
app.whenReady().then(async () => {
  const exeName = process.platform === 'win32' ? 'stockfish.exe' : 'stockfish';
  const engine = app.isPackaged ? path.join(process.resourcesPath, 'engine', exeName) : path.join(__dirname, 'engine', exeName);
  srv = await start({ root: path.join(__dirname, 'app'), engine });
  const win = new BrowserWindow({ width: 1280, height: 860, title: 'ChessLens', autoHideMenuBar: true, backgroundColor: '#1b1d20' });
  win.loadURL(`http://127.0.0.1:${srv.port}/index.html`);
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
});
app.on('window-all-closed', () => { if (srv) srv.close(); app.quit(); });
