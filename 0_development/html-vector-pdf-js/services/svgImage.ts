export const svgToDataUrl = (svgSrc: string, width: number, height: number, rasterScale: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const scale = Number.isFinite(rasterScale) && rasterScale > 0 ? rasterScale : 2;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => reject(new Error('Failed to load SVG image'));
    img.src = svgSrc;
  });
};

export const isSvgImage = (src: string): boolean => {
  return src.startsWith('data:image/svg') || src.endsWith('.svg');
};
