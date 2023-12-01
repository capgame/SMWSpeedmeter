const { ipcRenderer, contextBridge } = require('electron');

contextBridge.exposeInMainWorld('api', {
	changeWindowSize: (width,height) => ipcRenderer.invoke('changeWindowSize',width,height),
	setAlwaysOnTop: (bool) => ipcRenderer.invoke('setAlwaysOnTop',bool),
});