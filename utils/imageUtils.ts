import { FilterConfig } from '../types';

interface TextConfig {
  text: string;
  xPercent: number; // 0-1 relative to image width
  yPercent: number; // 0-1 relative to image height (or canvas height)
  scale: number;
}

/**
 * Draws the High-Res Polaroid
 */
export const createPolaroidImage = async (
  sourceImage: string, // Changed to string (DataURL)
  dateString: string,
  filter: FilterConfig,
  textConfig: TextConfig
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            reject(new Error("Could not get canvas context"));
            return;
        }

        // High Resolution Output
        const width = 1080;
        const height = 1440; // 3:4 aspect ratio

        canvas.width = width;
        canvas.height = height;

        // 1. Background (Cream Paper)
        ctx.fillStyle = '#f8f5ee';
        ctx.fillRect(0, 0, width, height);

        // 2. Photo Area Calculations
        const marginSide = 70;
        const marginTop = 70;
        const photoWidth = width - (marginSide * 2);
        const photoHeight = photoWidth; // Square aspect ratio 1:1

        // 3. Photo Placeholder Shadow
        ctx.fillStyle = '#e6e2da';
        ctx.fillRect(marginSide, marginTop, photoWidth, photoHeight);

        // 4. Process Image Source
        const tempCanvas = document.createElement('canvas');
        const tCtx = tempCanvas.getContext('2d');
        if(!tCtx) return;

        const sw = img.naturalWidth;
        const sh = img.naturalHeight;
        
        tempCanvas.width = sw;
        tempCanvas.height = sh;
        
        // Apply Filter
        tCtx.filter = filter.canvasFilter;
        tCtx.drawImage(img, 0, 0);
        tCtx.filter = 'none';

        // Crop logic: Center Crop to Square (1:1)
        const sSize = Math.min(sw, sh);
        const sx = (sw - sSize) / 2;
        const sy = (sh - sSize) / 2;

        // Draw processed image to main canvas
        ctx.drawImage(tempCanvas, sx, sy, sSize, sSize, marginSide, marginTop, photoWidth, photoHeight);

        // 5. Effects Overlays
        if (filter.vignette) {
            const gradient = ctx.createRadialGradient(
                width / 2, marginTop + photoHeight / 2, photoHeight * 0.3,
                width / 2, marginTop + photoHeight / 2, photoHeight * 0.8
            );
            gradient.addColorStop(0, "rgba(0,0,0,0)");
            gradient.addColorStop(1, "rgba(0,0,0,0.45)");
            
            ctx.fillStyle = gradient;
            ctx.fillRect(marginSide, marginTop, photoWidth, photoHeight);
        }

        if (filter.border) {
            ctx.strokeStyle = filter.border.includes('red') ? 'rgba(220, 40, 40, 0.4)' : 'rgba(0,0,0,0.8)';
            ctx.lineWidth = 30;
            ctx.strokeRect(marginSide, marginTop, photoWidth, photoHeight);
        }
        
        // Inner shadow
        ctx.shadowColor = "rgba(0,0,0,0.2)";
        ctx.shadowBlur = 20;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.lineWidth = 4;
        ctx.strokeStyle = "rgba(0,0,0,0.1)";
        ctx.strokeRect(marginSide, marginTop, photoWidth, photoHeight);
        ctx.shadowColor = "transparent";

        // 6. Date Stamp
        ctx.font = 'bold 36px "Courier Prime", monospace';
        ctx.fillStyle = 'rgba(245, 245, 245, 0.85)';
        if (filter.id === 'kodak' || filter.id === 'lomo') {
             ctx.fillStyle = 'rgba(255, 140, 0, 0.9)';
        }
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 2;
        ctx.textAlign = 'right';
        ctx.fillText(dateString, marginSide + photoWidth - 30, marginTop + photoHeight - 30);
        ctx.shadowBlur = 0;

        // 7. Caption Text
        ctx.save();
        ctx.font = `${52 * textConfig.scale}px "Ma Shan Zheng", cursive`;
        ctx.fillStyle = '#1a1a1a';
        ctx.textBaseline = 'top';
        ctx.textAlign = 'center';
        
        const textAreaTop = marginTop + photoHeight + 80;
        const textAreaHeight = height - textAreaTop - 40;
        
        let textX = width / 2;
        let textY = textAreaTop + (textAreaHeight / 2) - 20;

        if (textConfig.yPercent !== 0.85) {
             textX = textConfig.xPercent * width;
             textY = textConfig.yPercent * height;
        }

        ctx.fillText(textConfig.text, textX, textY);
        ctx.restore();

        resolve(canvas.toDataURL('image/jpeg', 0.95));
    };
    
    img.onerror = (e) => reject(e);
    img.src = sourceImage;
  });
};