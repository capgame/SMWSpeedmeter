const app = Vue.createApp({
	data(){
		return {
			videoDevicesList: [],
			video: document.createElement('video'),
			canvas: document.createElement('canvas'),
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
			se: new Audio(),
		}
	},
	mounted(){
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
		},
		meterScene(){
			this.connectVideo().then(() => {
				this.scene = 2;
				window.api.changeWindowSize(180,90);
				window.api.setAlwaysOnTop(true);
			
				const ctx = this.canvas.getContext("2d",{willReadFrequently: true});

				const GAME_WIDTH = 256;
				const GAME_HEIGHT = 224;
				const cropRect = this.setting.cropRect;

				const compareRect = {x: 64,y: 40,w: 128,h: 184};
				this.intervalId = setInterval(() => {
					ctx.drawImage(this.video,cropRect.x,cropRect.y,cropRect.w,cropRect.h,0,0,GAME_WIDTH,GAME_HEIGHT);
					
					let matchRates = [];

					const compareSourceImage =
					  this.setting.intervalFrame == 32 ? this.imageDataHistory[0]
					: this.setting.intervalFrame == 16 ? this.imageDataHistory[1]
					: this.setting.intervalFrame ==  8 ? this.imageDataHistory[3] : this.imageDataHistory[7];

					if(compareSourceImage === undefined){//ImageDataが無い時→保存だけしてReturn
						this.imageDataHistory.unshift(ctx.getImageData(compareRect.x,compareRect.y,compareRect.w,compareRect.h));
						return;
					}

					for(let x = 0;x < GAME_WIDTH - compareRect.w + 1;x++){
						const targetImage = ctx.getImageData(x,compareRect.y,compareRect.w,compareRect.h);
						const similarity = targetImage.compareTo(compareSourceImage,5,1);
						// const similarity = targetImage.compareTo(compareSourceImage,24,2);
						matchRates.push({x,similarity});
					}

					matchRates.sort((a,b) => b.similarity - a.similarity);	//similarityで降順ソート
					const estSpeed = 64 - matchRates[0].x;
					// console.log(matchRates[0].similarity);

					const diffLimit = 0.003;//２番目と１番目の一致率の差がこの値以上ならOK
					const isReliable = matchRates[0].similarity - matchRates[1].similarity > diffLimit;
					console.log(matchRates[0].similarity - matchRates[1].similarity);

					if(isReliable){
						this.speedHistory.unshift(estSpeed);
					}else{//Reliableじゃなかったら前回のを引き続き使用
						this.speedHistory.unshift(this.speedHistory[0]);
					}
					this.speedHistory.length = Math.min(this.speedHistory.length,20);

					const detectWarning = () => {
						const checkIndex = this.setting.SEPlayTimingFrame / this.setting.intervalFrame;	//historyの調べる数
						let speed50Count = 0;
						for(let i = 0;i < checkIndex;i++){
							if(this.speedHistory[i] === 50){
								speed50Count += 1;
							}
						}
						console.log(checkIndex,speed50Count);
						return speed50Count === checkIndex;
					};
					if(detectWarning()){
						this.isWarning = true;
						if(this.setting.playsSE) this.se.play();
					}else{
						this.isWarning = false;
					}

					this.imageDataHistory.unshift(ctx.getImageData(compareRect.x,compareRect.y,compareRect.w,compareRect.h));
					this.imageDataHistory.length = Math.min(this.imageDataHistory.length,8);
				},1000 / 60 * this.setting.intervalFrame);
			// },0);
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
				fullCtx.fillStyle = "#000000aa";

				const CANVAS_WIDTH  = 384;
				const CANVAS_HEIGHT = 216;

				const cropRect = this.setting.cropRect;
				const scaleX = CANVAS_WIDTH / this.video.videoWidth;
				const scaleY = CANVAS_HEIGHT / this.video.videoHeight;

				zoomCtx.fillStyle = "#ffffff";

				zoomCtx.fillRect(  0,  0,16,16);	//zoomCtxの四隅の白
				zoomCtx.fillRect(144,  0,16,16);
				zoomCtx.fillRect(  0,144,16,16);
				zoomCtx.fillRect(144,144,16,16);

				this.intervalId = setInterval(() => {
					fullCtx.drawImage(this.video,0,0,CANVAS_WIDTH,CANVAS_HEIGHT);
					
					const fillOutsideDark = () => {
						fullCtx.fillRect(0,0,this.video.videoWidth,parseInt(cropRect.y * scaleY));	//上
						fullCtx.fillRect(0,parseInt(cropRect.y * scaleX),cropRect.x * scaleX,parseInt(cropRect.h * scaleY));	//左
						fullCtx.fillRect((cropRect.x + cropRect.w) * scaleX,parseInt(cropRect.y * scaleX),this.video.videoWidth,parseInt(cropRect.h * scaleY));	//右
						fullCtx.fillRect(0,parseInt((cropRect.y + cropRect.h) * scaleY),this.video.videoWidth,this.video.videoHeight);	//下
					};
					const drawZoomedImages = () => {
						const zoomedSizeW = 12 * (cropRect.w / 256);
						const zoomedSizeH = 12 * (cropRect.h / 256);
	
						zoomCtx.drawImage(this.video,cropRect.x,cropRect.y,zoomedSizeW,zoomedSizeH, 4, 4,72,72);	//左上
						zoomCtx.drawImage(this.video,cropRect.x + cropRect.w - zoomedSizeW,cropRect.y,zoomedSizeW,zoomedSizeH,84, 4,72,72);	//右上
						zoomCtx.drawImage(this.video,cropRect.x,cropRect.y + cropRect.h - zoomedSizeH,zoomedSizeW,zoomedSizeH, 4,84,72,72);	//左下
						zoomCtx.drawImage(this.video,cropRect.x + cropRect.w - zoomedSizeW,cropRect.y + cropRect.h - zoomedSizeH,zoomedSizeW,zoomedSizeH,84,84,72,72);	//右下
					};

					fillOutsideDark();
					drawZoomedImages();
				},1000 / 60);
			}).catch((e) => {
				if(e === 1){
					alert("キャプチャデバイスを選択してください。");
				}else if(e === 2){
					alert("キャプチャデバイスに接続できませんでした。");
				}
			});
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
	},
}).mount("#app");

window.onload = () => {
	document.onkeydown = e => {
		if(e.ctrlKey && e.code === "KeyR"){
			return false;	//リロード無効化
		}
	};
};