window.onload = () => {
	app.setting.cropRect = {
		x: 36,
		y: 21,
		w: 1196,
		h: 898,
	};
	app.setting.deviceId = "d5d93eff390c50a18738503c5f40ccb5556e597d3d66ac1f73d927818072dc16";
	document.onkeydown = e => console.log(e);
};