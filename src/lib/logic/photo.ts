// Photo handling: resize and compress an uploaded image to under 100 KB.
//
// Photos are optional, off by default, and stored only in this browser alongside the rest
// of the data. Compression matters because localStorage is small.

export const PHOTO_MAX_BYTES = 100 * 1024;
export const PHOTO_MAX_DIMENSION = 400;
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];

/**
 * Read an image file, scale it down, and return a JPEG data URL under PHOTO_MAX_BYTES.
 * Quality is stepped down until the size fits; if it still cannot fit we reject with a
 * clear message instead of silently storing something too large.
 */
export async function compressImage(file: File): Promise<string> {
	if (!ACCEPTED.includes(file.type)) {
		throw new Error('Please choose a PNG, JPEG or WebP image.');
	}
	// A guard before decoding: refuse absurd inputs early.
	if (file.size > 12 * 1024 * 1024) {
		throw new Error('That image is very large. Please choose one under 12 MB.');
	}

	const bitmap = await loadBitmap(file);
	const scale = Math.min(1, PHOTO_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
	const width = Math.max(1, Math.round(bitmap.width * scale));
	const height = Math.max(1, Math.round(bitmap.height * scale));

	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('This browser could not process the image.');
	ctx.drawImage(bitmap as CanvasImageSource, 0, 0, width, height);

	for (const quality of [0.82, 0.7, 0.6, 0.5, 0.4, 0.3]) {
		const dataUrl = canvas.toDataURL('image/jpeg', quality);
		if (approximateBytes(dataUrl) <= PHOTO_MAX_BYTES) return dataUrl;
	}

	throw new Error('Could not compress that photo under 100 KB. Try a smaller or simpler image.');
}

function approximateBytes(dataUrl: string): number {
	const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
	return Math.floor((base64.length * 3) / 4);
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
	if (typeof createImageBitmap === 'function') {
		try {
			return await createImageBitmap(file);
		} catch {
			// fall through to the <img> path
		}
	}
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(url);
			resolve(img);
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('That image could not be read.'));
		};
		img.src = url;
	});
}
