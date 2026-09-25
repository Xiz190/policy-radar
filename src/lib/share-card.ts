export type ShareCardData = {
  title: string;
  source: string;
  channel?: string;
  publishedAt?: string;
  categories?: string[];
  url: string;
};

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  const words = text.split("");
  let line = "";
  let currentY = y;
  // For CJK text, split character by character
  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i];
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      line = words[i];
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) {
    ctx.fillText(line, x, currentY);
    currentY += lineHeight;
  }
  return currentY;
}

export function generateShareCard(data: ShareCardData): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const W = 600;
    const H = 320;
    const canvas = document.createElement("canvas");
    canvas.width = W * 2;
    canvas.height = H * 2;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) { reject(new Error("no ctx")); return; }
    ctx.scale(2, 2); // retina

    // Background
    ctx.fillStyle = "#ffffff";
    ctx.roundRect(0, 0, W, H, 16);
    ctx.fill();

    // Top gradient bar
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, "#4f46e5");
    grad.addColorStop(1, "#7c3aed");
    ctx.fillStyle = grad;
    ctx.roundRect(0, 0, W, 6, [16, 16, 0, 0]);
    ctx.fill();

    // Brand label
    ctx.fillStyle = "#94a3b8";
    ctx.font = "500 11px system-ui, -apple-system, sans-serif";
    ctx.fillText("政策雷达", 28, 32);

    // Date on right
    if (data.publishedAt) {
      const dateStr = new Date(data.publishedAt).toLocaleDateString("zh-CN");
      ctx.textAlign = "right";
      ctx.fillText(dateStr, W - 28, 32);
      ctx.textAlign = "left";
    }

    // Divider
    ctx.strokeStyle = "#f1f5f9";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(28, 44);
    ctx.lineTo(W - 28, 44);
    ctx.stroke();

    // Title
    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 17px system-ui, -apple-system, sans-serif";
    const titleBottom = wrapText(ctx, data.title, 28, 72, W - 56, 26);

    // Source line
    const sourceLine = [data.source, data.channel].filter(Boolean).join(" · ");
    ctx.fillStyle = "#64748b";
    ctx.font = "12px system-ui, -apple-system, sans-serif";
    ctx.fillText(sourceLine, 28, Math.max(titleBottom + 12, 140));

    // Category chips (simplified text)
    if (data.categories?.length) {
      const chipY = Math.max(titleBottom + 36, 164);
      let chipX = 28;
      for (const cat of data.categories.slice(0, 3)) {
        const short = cat.slice(2); // remove "A·" prefix
        const tw = ctx.measureText(short).width;
        const pw = tw + 16;
        ctx.fillStyle = "#ede9fe";
        ctx.roundRect(chipX, chipY - 13, pw, 20, 10);
        ctx.fill();
        ctx.fillStyle = "#6d28d9";
        ctx.fillText(short, chipX + 8, chipY);
        chipX += pw + 8;
      }
    }

    // Bottom bar
    const barY = H - 48;
    ctx.fillStyle = "#f8fafc";
    ctx.roundRect(0, barY, W, H - barY, [0, 0, 16, 16]);
    ctx.fill();

    // URL
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px system-ui, -apple-system, sans-serif";
    const urlShort = data.url.length > 60 ? data.url.slice(0, 57) + "…" : data.url;
    ctx.fillText(urlShort, 28, H - 26);

    // Border
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.roundRect(0.5, 0.5, W - 1, H - 1, 16);
    ctx.stroke();

    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("toBlob failed"));
    }, "image/png");
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
