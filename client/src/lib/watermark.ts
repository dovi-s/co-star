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

function drawSparkle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, opacity: number) {
  ctx.globalAlpha = opacity;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.quadraticCurveTo(cx + r * 0.28, cy - r * 0.28, cx + r, cy);
  ctx.quadraticCurveTo(cx + r * 0.28, cy + r * 0.28, cx, cy + r);
  ctx.quadraticCurveTo(cx - r * 0.28, cy + r * 0.28, cx - r, cy);
  ctx.quadraticCurveTo(cx - r * 0.28, cy - r * 0.28, cx, cy - r);
  ctx.closePath();
  ctx.fill();
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
  
  const iconCenterX = iconX + iconSize * 0.44;
  const iconCenterY = iconY + iconSize * 0.44;
  const cornerRadius = Math.round(iconSize * 0.22);
  
  const grad = ctx.createLinearGradient(iconX, iconY, iconX + iconSize, iconY + iconSize);
  grad.addColorStop(0, '#FBBF24');
  grad.addColorStop(1, '#F59E0B');
  ctx.beginPath();
  safeRoundRect(ctx, iconX, iconY, iconSize, iconSize, cornerRadius);
  ctx.fillStyle = grad;
  ctx.fill();
  
  ctx.fillStyle = '#FFFFFF';
  const mainR = iconSize * 0.29;
  drawSparkle(ctx, iconCenterX, iconCenterY, mainR, 0.95);
  
  const compX = iconX + iconSize * 0.73;
  const compY = iconY + iconSize * 0.73;
  const compR = iconSize * 0.115;
  drawSparkle(ctx, compX, compY, compR, 0.7);
  
  ctx.globalAlpha = 1.0;
  
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
}
