const { ipcRenderer, contextBridge } = require('electron');

contextBridge.exposeInMainWorld('api', {
	changeWindowSize: (width,height) => ipcRenderer.invoke('changeWindowSize',width,height),
	setAlwaysOnTop: (bool) => ipcRenderer.invoke('setAlwaysOnTop',bool),
	store_set: (key,value) => ipcRenderer.invoke('store_set',key,JSON.parse(value)),
	store_get: (key) => ipcRenderer.invoke('store_get',key),
	store_has: (key) => ipcRenderer.invoke('store_has',key),
});