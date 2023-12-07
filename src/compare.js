/**
 * 受け取ったImageDataを比較して一致率(0~1)を返す
 * @param {ImageData} imagedata thisと同じサイズ
 * @param {number} limit RGB値の差の合計が何まで許容する（同じ色とみなす）か
 * @returns {number} 一致率(0~1)
 */
ImageData.prototype.compareTo = function(imagedata,limit = 10,type = 1){
	if(type === 1)
		return this._compareTo1(imagedata,limit);
	else if(type === 2)
		return this._compareTo2(imagedata,limit);
};

/**
 * 比較方法： 
 * 　ピクセル毎に色差を判定し、色差が少ないピクセルがいくつあるかをチェックする。
 */
ImageData.prototype._compareTo1 = function(imagedata,limit = 10){
	const imageSize = this.width * this.height;
	let samePixelCount = 0;
	for(let i = 0;i < imageSize * 4;i += 4){
		const diff	= Math.abs(this.data[i] - imagedata.data[i])
					+ Math.abs(this.data[i + 1] - imagedata.data[i + 1])
					+ Math.abs(this.data[i + 2] - imagedata.data[i + 2]);
		if(diff <= limit){
			samePixelCount += 1;
		}
	}
	return samePixelCount / imageSize;
}

/**
 * 比較方法： 
 * 　ピクセル毎に色差を判定し、その総和の小ささで判定する
 */
ImageData.prototype._compareTo2 = function(imagedata,limit = 10){
	const imageSize = this.width * this.height;
	let diffSum = 0;
	for(let i = 0;i < imageSize * 4;i += 4){
		const diff	= Math.min(limit,
			Math.abs(this.data[i] - imagedata.data[i])
			+ Math.abs(this.data[i + 1] - imagedata.data[i + 1])
			+ Math.abs(this.data[i + 2] - imagedata.data[i + 2])
		);	//limit以上→limitに丸め
		diffSum	+= diff / limit;
	}
	return 1 - diffSum / imageSize;
}