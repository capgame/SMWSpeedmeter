/**
 * 同じサイズのImageDataを比較して一致率(0~1)を返す
 * @param {ImageData} imagedata 
 * @param {number} limit RGB値の差の合計が何まで許容する（同じ色とみなす）か
 * @returns {number} 一致率(0~1)
 */
ImageData.prototype.compareTo = function(imagedata,limit = 20){
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
};