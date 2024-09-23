import {createApp} from '../node_modules/vue/dist/vue.esm-browser.js'

const app = createApp({
	data(){
		return {
			videoDevicesList: [],
			video: document.createElement('video'),
			canvas: document.createElement('canvas'),
			isReliable: true,
			speedHistory: [0],
			imageDataHistory: [],
			isWarning: false,

			scene: 0,	//0: 設定,1: クロップ,2: 実行中
			intervalId: -1,
			setting: {
				deviceId: "none",
				cropRect: {
					x: 0,
					y: 0,
					w: 1280,
					h: 960,
				},
				intervalFrame: 32,
				playsSE: false,
				SEPlayTimingFrame: 128,	//何フレーム以上50飛行をした場合に効果音を鳴らすか
			},
			cropping: {
				isDragMode: false,
				begin: {
					x: 0,
					y: 0,
				},
				current: {
					x: 0,
					y: 0,
				},
			},
			measureSetting: {
				
			},
			se: new Audio(),
		}
	},
	async mounted(){
		const isSaved = await window.api.store_has("setting");
		if(isSaved){
			this.setting = await window.api.store_get("setting");
		}

		this.getVideoDevices();
		this.settingScene();

		this.canvas.width = 256;
		this.canvas.height = 224;

		this.se.src = "assets/warning.mp3";
		this.se.volume = 0.3;
	},
	methods: {
		getVideoDevices(){
			navigator.mediaDevices.enumerateDevices().then((devices) => {
				this.videoDevicesList = devices.filter(e => e.kind == "videoinput");
			}).catch(error => {
				console.error("デバイスを取得できませんでした: ", error)
			});
		},
		settingScene(){
			window.api.changeWindowSize(400,570);
			window.api.setAlwaysOnTop(false);
			this.scene = 0;
			if(this.intervalId !== -1){
				clearInterval(this.intervalId);
			}
			this.saveSettings();
		},
		meterScene(){
			this.connectVideo().then(() => {
				this.scene = 2;
				// window.api.changeWindowSize(200,100);
				window.api.changeWindowSize(200,200);
				window.api.setAlwaysOnTop(true);
			
				const ctx = this.canvas.getContext("2d",{willReadFrequently: true});

				const GAME_WIDTH = 256;
				const GAME_HEIGHT = 224;
				const cropRect = this.setting.cropRect;

				const compareRect = {x: 64,y: 40,w: 128,h: 184};

				const process = () => {
					ctx.drawImage(this.video,cropRect.x,cropRect.y,cropRect.w,cropRect.h,0,0,GAME_WIDTH,GAME_HEIGHT);

					const compareSourceImage =
					  this.setting.intervalFrame == 32 ? this.imageDataHistory[0]
					: this.setting.intervalFrame == 16 ? this.imageDataHistory[1]
					: this.setting.intervalFrame ==  8 ? this.imageDataHistory[3] : this.imageDataHistory[7];

					if(compareSourceImage === undefined){//ImageDataが無い時→保存だけしてReturn
						this.imageDataHistory.unshift(ctx.getImageData(compareRect.x,compareRect.y,compareRect.w,compareRect.h));
						return;
					}
					
					let matchRates = [];
					for(let x = 0;x < GAME_WIDTH - compareRect.w + 1;x++){
						const targetImage = ctx.getImageData(x,compareRect.y,compareRect.w,compareRect.h);
						const similarity = targetImage.compareTo(compareSourceImage,5,1);
						// const similarity = targetImage.compareTo(compareSourceImage,24,2);
						matchRates.push({x,similarity});
					}

					matchRates.sort((a,b) => b.similarity - a.similarity);	//similarityで降順ソート
					const estSpeed = 64 - matchRates[0].x;

					const diffLimit = 0.005;//２番目と１番目の一致率の差がこの値以上ならOK
					const similarityDiff = matchRates[0].similarity - matchRates[1].similarity;
					this.isReliable = similarityDiff > diffLimit;

document.querySelector("#dev-log").innerHTML = 
`<table>
	<tr>
		<td>[0]</td>
		<td>${64 - matchRates[0].x}</td>
		<td>${matchRates[0].similarity.toFixed(5)}</td>
	</tr>
	<tr>
		<td>[1]</td>
		<td>${64 - matchRates[1].x}</td>
		<td>${matchRates[1].similarity.toFixed(5)}</td>
	</tr>
	<tr>
		<td>[2]</td>
		<td>${64 - matchRates[2].x}</td>
		<td>${matchRates[2].similarity.toFixed(5)}</td>
	</tr>
</table>`;

					this.speedHistory.unshift(estSpeed);
					this.speedHistory.length = Math.min(this.speedHistory.length,20);

					this.imageDataHistory.unshift(ctx.getImageData(compareRect.x,compareRect.y,compareRect.w,compareRect.h));
					this.imageDataHistory.length = Math.min(this.imageDataHistory.length,8);
				}
				
				const detectWarning = () => {
					if(this.isReliable === false) return false;
					const checkLength = this.setting.SEPlayTimingFrame / this.setting.intervalFrame;	//historyの調べる数
					let speed50Count = 0;
					for(let i = 0;i < checkLength;i++){
						if(this.speedHistory[i] === 50){
							speed50Count += 1;
						}
					}
					return speed50Count === checkLength;
				};

				this.intervalId = setInterval(() => {
					process();
					if(detectWarning()){
						this.isWarning = true;
						if(this.setting.playsSE) this.se.play();
					}else{
						this.isWarning = false;
					}
				// },1000 / 59.94 * this.setting.intervalFrame);
				},1000 / 60 * this.setting.intervalFrame);
			}).catch((e) => {
				if(e === 1){
					alert("キャプチャデバイスを選択してください。");
				}else if(e === 2){
					alert("キャプチャデバイスに接続できませんでした。");
				}
			});
		},

		cropScene(){
			this.connectVideo().then(() => {
				this.scene = 1;
				const fullCtx = document.querySelector("#crop-full").getContext("2d");
				const zoomCtx = document.querySelector("#crop-zoom").getContext("2d");
				zoomCtx.imageSmoothingEnabled = false;

				const CANVAS_WIDTH  = 384;
				const CANVAS_HEIGHT = 216;

				const scaleX = CANVAS_WIDTH / this.video.videoWidth;
				const scaleY = CANVAS_HEIGHT / this.video.videoHeight;

				zoomCtx.fillStyle = "#ffffff";

				zoomCtx.fillRect(  0,  0,16,16);	//zoomCtxの四隅の白
				zoomCtx.fillRect(144,  0,16,16);
				zoomCtx.fillRect(  0,144,16,16);
				zoomCtx.fillRect(144,144,16,16);

				const fillOutside = (rect) => {
					fullCtx.fillRect(0,0,this.video.videoWidth,Math.round(rect.y * scaleY));	//上
					fullCtx.fillRect(0,Math.round(rect.y * scaleY),rect.x * scaleX,Math.round(rect.h * scaleY));	//左
					fullCtx.fillRect((rect.x + rect.w) * scaleX,Math.round(rect.y * scaleY),this.video.videoWidth,Math.round(rect.h * scaleY));	//右
					fullCtx.fillRect(0,Math.round(rect.y * scaleY) + Math.round(rect.h * scaleY),this.video.videoWidth,this.video.videoHeight);	//下
					// fullCtx.fillRect(0,Math.round((rect.y + rect.h) * scaleY),this.video.videoWidth,this.video.videoHeight);	//下
				};

				this.intervalId = setInterval(() => {
					if(this.cropping.isDragMode){
						const rectSize = {
							x: Math.min(this.cropping.begin.x,this.cropping.current.x),
							y: Math.min(this.cropping.begin.y,this.cropping.current.y),
							w: Math.abs(this.cropping.begin.x - this.cropping.current.x),
							h: Math.abs(this.cropping.begin.y - this.cropping.current.y),
						};
						fullCtx.fillStyle = "#ffffff44";
						fullCtx.drawImage(this.video,0,0,CANVAS_WIDTH,CANVAS_HEIGHT);
						fillOutside(rectSize);
					}else{
						const drawZoomedImages = () => {
							const zoomedSizeW = 12 * (cropRect.w / 256);
							const zoomedSizeH = 12 * (cropRect.h / 256);
		
							zoomCtx.drawImage(this.video,cropRect.x,cropRect.y,zoomedSizeW,zoomedSizeH, 4, 4,72,72);	//左上
							zoomCtx.drawImage(this.video,cropRect.x + cropRect.w - zoomedSizeW,cropRect.y,zoomedSizeW,zoomedSizeH,84, 4,72,72);	//右上
							zoomCtx.drawImage(this.video,cropRect.x,cropRect.y + cropRect.h - zoomedSizeH,zoomedSizeW,zoomedSizeH, 4,84,72,72);	//左下
							zoomCtx.drawImage(this.video,cropRect.x + cropRect.w - zoomedSizeW,cropRect.y + cropRect.h - zoomedSizeH,zoomedSizeW,zoomedSizeH,84,84,72,72);	//右下
						};

						const cropRect = this.setting.cropRect;
						fullCtx.drawImage(this.video,0,0,CANVAS_WIDTH,CANVAS_HEIGHT);
						fullCtx.fillStyle = "#000000aa";
						fillOutside(cropRect);
						drawZoomedImages();
					}
				},1000 / 60);
			}).catch((e) => {
				if(e === 1){
					alert("キャプチャデバイスを選択してください。");
				}else if(e === 2){
					alert("キャプチャデバイスに接続できませんでした。");
				}
			});
		},
		cropWithDragging(){
			this.cropping.isDragMode = true;

			this.cropping.begin.x = 0;
			this.cropping.begin.y = 0;
			this.cropping.current.x = 0;
			this.cropping.current.y = 0;

			const cvs = document.querySelector("#crop-full");
			const rect = cvs.getBoundingClientRect();

			const CANVAS_WIDTH  = 384;
			const CANVAS_HEIGHT = 216;

			const scaleX = CANVAS_WIDTH / this.video.videoWidth;
			const scaleY = CANVAS_HEIGHT / this.video.videoHeight;

			const mousedown = e => {
				this.cropping.begin.x = Math.min(Math.max(0,(e.clientX - rect.left) / scaleX),this.video.videoWidth);
				this.cropping.begin.y = Math.min(Math.max(0,(e.clientY - rect.top) / scaleY),this.video.videoHeight);
				this.cropping.current.x = this.cropping.begin.x;
				this.cropping.current.y = this.cropping.begin.y;
				console.log(this.cropping.begin)

				const mousemove = e => {
					this.cropping.current.x = Math.min(Math.max(0,(e.clientX - rect.left) / scaleX),this.video.videoWidth);
					this.cropping.current.y = Math.min(Math.max(0,(e.clientY - rect.top) / scaleY),this.video.videoHeight);
				};
				const mouseup = e => {
					this.cropping.isDragMode = false;
					window.removeEventListener("mousedown",mousedown);
					window.removeEventListener("mousemove",mousemove);
					window.removeEventListener(  "mouseup",mouseup);

					const rectSize = {
						x: Math.min(this.cropping.begin.x,this.cropping.current.x),
						y: Math.min(this.cropping.begin.y,this.cropping.current.y),
						w: Math.abs(this.cropping.begin.x - this.cropping.current.x),
						h: Math.abs(this.cropping.begin.y - this.cropping.current.y),
					};
					if(rectSize.w < 256 || rectSize.h < 224){
						alert("範囲が小さすぎます。");
						return;
					}
					this.setting.cropRect = rectSize;
				};
				window.addEventListener("mousemove",mousemove);
				window.addEventListener(  "mouseup",mouseup);
			};
			window.addEventListener("mousedown",mousedown);
		},
		connectVideo(){
			if(this.setting.deviceId === "none"){
				return Promise.reject(1);
			}
			return new Promise((resolve,reject) => {
				navigator.mediaDevices.getUserMedia(
					{video: {deviceId: this.setting.deviceId}, audio: false}
				).then(stream => {
					this.video.srcObject = stream;
					this.video.play().then(resolve);
				}).catch(() => {
					reject(2);
				});
			});
		},
		saveSettings(alerts = false){
			window.api.store_set("setting",JSON.stringify(this.setting))
			.then(() => {
				if(alerts){
					alert("設定を保存しました。")
				}
			}).catch(() => {
				alert("設定を保存できませんでした。")
			});
		}
	},
}).mount("#app");

window.onload = () => {
	document.onkeydown = e => {
		if(e.ctrlKey && e.code === "KeyR"){
			return false;	//リロード無効化
		}
	};
};