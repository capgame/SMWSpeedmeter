const { app, BrowserWindow, ipcMain } = require('electron');
const Store = require('electron-store');
const path = require("path");

const store = new Store();

const createWindow = () => {
	const mainWindow = new BrowserWindow({
		width: 400,
		height: 570,
		resizable: false,
		backgroundColor: "#313436",
		titleBarStyle: 'hidden',
		titleBarOverlay: {
			color: "#313436",
			symbolColor: "#74b1be",
		},
		webPreferences: {
			preload: path.join(__dirname,"preload.js"),
			devTools: !app.isPackaged,
		},
	});

	ipcMain.handle('changeWindowSize', async (e,width,height) => {
		mainWindow.setBounds({width,height});
	});
	ipcMain.handle('setAlwaysOnTop', async (e,bool) => {
		mainWindow.setAlwaysOnTop(bool);
	});
	ipcMain.handle('store_set', async (e,key,value) => {
		store.set(key,value)
	});
	ipcMain.handle('store_get', async (e,key) => {
		return store.get(key);
	});
	ipcMain.handle('store_has', async (e,key) => {
		return store.has(key);
	});


	mainWindow.setMenuBarVisibility(false);
	mainWindow.loadFile('index.html');
};

app.once('ready', () => {
	createWindow();
});

app.once('window-all-closed', () => app.quit());