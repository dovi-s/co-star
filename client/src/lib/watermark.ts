import logoImage from "@assets/castmate_icon_transparent_512_1769295148528.png";

let cachedLogo: HTMLImageElement | null = null;
let logoLoadPromise: Promise<HTMLImageElement> | null = null;

function loadLogo(): Promise<HTMLImageElement> {
  if (cachedLogo) return Promise.resolve(cachedLogo);
  if (logoLoadPromise) return logoLoadPromise;
  
  logoLoadPromise = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      cachedLogo = img;
      resolve(img);
    };
    img.onerror = () => {
      resolve(img);
    };
    img.src = logoImage;
  });
  
  return logoLoadPromise;
}

loadLogo();

function safeRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
}

export function drawWatermark(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  options?: { position?: 'bottom-right' | 'bottom-left'; scale?: number }
) {
  const pos = options?.position || 'bottom-right';
  const baseScale = options?.scale || 1;
  
  if (canvasWidth < 100 || canvasHeight < 60 || !isFinite(canvasWidth) || !isFinite(canvasHeight)) {
    return;
  }
  
  const refDim = Math.min(canvasWidth, canvasHeight);
  const scaleFactor = (refDim / 720) * baseScale;
  
  const iconSize = Math.round(28 * scaleFactor);
  const fontSize = Math.round(14 * scaleFactor);
  const studioFontSize = Math.round(7 * scaleFactor);
  const padding = Math.round(16 * scaleFactor);
  const gap = Math.round(8 * scaleFactor);
  const pillPaddingH = Math.round(12 * scaleFactor);
  const pillPaddingV = Math.round(8 * scaleFactor);
  
  ctx.save();
  
  ctx.font = `700 ${fontSize}px Inter, -apple-system, sans-serif`;
  const textWidth = ctx.measureText('co-star').width;
  
  const contentWidth = iconSize + gap + textWidth;
  const contentHeight = iconSize;
  const pillWidth = contentWidth + pillPaddingH * 2;
  const pillHeight = contentHeight + pillPaddingV * 2;
  const pillRadius = Math.round(8 * scaleFactor);
  
  let x: number;
  const y = canvasHeight - padding - pillHeight;
  
  if (pos === 'bottom-right') {
    x = canvasWidth - padding - pillWidth;
  } else {
    x = padding;
  }
  
  ctx.beginPath();
  safeRoundRect(ctx, x, y, pillWidth, pillHeight, pillRadius);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fill();
  
  ctx.beginPath();
  safeRoundRect(ctx, x, y, pillWidth, pillHeight, pillRadius);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = Math.max(1, scaleFactor * 0.5);
  ctx.stroke();
  
  const iconX = x + pillPaddingH;
  const iconY = y + pillPaddingV;
  
  if (cachedLogo && cachedLogo.complete && cachedLogo.naturalWidth > 0) {
    ctx.globalAlpha = 0.9;
    ctx.drawImage(cachedLogo, iconX, iconY, iconSize, iconSize);
    ctx.globalAlpha = 1.0;
  } else {
    const iconCenterX = iconX + iconSize / 2;
    const iconCenterY = iconY + iconSize / 2;
    const iconRadius = iconSize / 2;
    
    const grad = ctx.createLinearGradient(iconX, iconY, iconX + iconSize, iconY + iconSize);
    grad.addColorStop(0, '#FBBF24');
    grad.addColorStop(1, '#F59E0B');
    ctx.beginPath();
    safeRoundRect(ctx, iconX, iconY, iconSize, iconSize, Math.round(iconSize * 0.22));
    ctx.fillStyle = grad;
    ctx.fill();
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.ellipse(iconCenterX, iconCenterY - iconRadius * 0.05, iconRadius * 0.6, iconRadius * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();
    
    const eyeR = iconRadius * 0.11;
    ctx.fillStyle = '#1F2937';
    ctx.beginPath();
    ctx.ellipse(iconCenterX - iconRadius * 0.22, iconCenterY, eyeR, eyeR * 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(iconCenterX + iconRadius * 0.22, iconCenterY, eyeR, eyeR * 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  
  const textX = iconX + iconSize + gap;
  const textY = y + pillPaddingV + iconSize * 0.55;
  
  ctx.globalAlpha = 0.95;
  ctx.font = `700 ${fontSize}px Inter, -apple-system, sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  ctx.textBaseline = 'middle';
  ctx.fillText('co-star', textX, textY);
  
  ctx.restore();
}

export function preloadWatermarkAssets() {
  loadLogo();
}
