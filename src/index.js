const { app, BrowserWindow, ipcMain } = require('electron');
const path = require("path");

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
		},
	});

	ipcMain.handle('changeWindowSize', async (e,width,height) => {
		mainWindow.setBounds({width,height});
	});
	ipcMain.handle('setAlwaysOnTop', async (e,bool) => {
		mainWindow.setAlwaysOnTop(bool);
	});


	mainWindow.setMenuBarVisibility(false);
	//mainWindow.webContents.openDevTools({mode: "detach"});
	mainWindow.loadFile('index.html');
};

app.once('ready', () => {
	createWindow();
});

app.once('window-all-closed', () => app.quit());