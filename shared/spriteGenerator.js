export function makeSprite(kind, colors = ['#61d8ff', '#17233a'], size = 32) {
  const canvas = document.createElement('canvas');
  canvas.width = size * 4; canvas.height = size * 4;
  const c = canvas.getContext('2d');
  c.imageSmoothingEnabled = false;
  for (let row = 0; row < 4; row++) {
    for (let frame = 0; frame < 4; frame++) {
      const x = frame * size, y = row * size;
      c.save(); c.translate(x, y);
      c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(size/2, size-5, 10, 4, 0, 0, Math.PI*2); c.fill();
      if (kind === 'tower') {
        c.fillStyle = colors[1]; c.fillRect(8, 9, 16, 18);
        c.fillStyle = colors[0]; c.beginPath(); c.moveTo(16, 3); c.lineTo(27, 16); c.lineTo(5,16); c.fill();
        c.fillStyle = '#fff'; c.fillRect(14, 12, 4, 4);
      } else {
        c.fillStyle = colors[1]; c.fillRect(9, 13, 14, 14);
        c.fillStyle = colors[0]; c.fillRect(10, 7, 12, 8);
        c.fillStyle = '#f2d2ad'; c.fillRect(12, 9, 8, 5);
        const walk = row === 1 ? (frame % 2 ? 2 : -2) : 0;
        c.fillStyle = colors[1]; c.fillRect(10+walk, 26, 4, 5); c.fillRect(18-walk, 26, 4, 5);
        c.fillStyle = '#d7e8ff'; c.fillRect(24, 15, 3, 12);
        if (row === 2) { c.fillStyle = '#fff4'; c.fillRect(24 + frame*2, 14, 7, 3); }
      }
      c.restore();
    }
  }
  return canvas;
}
export function drawUnit(ctx, sprite, x, y, size = 32, frame = 0, row = 0) {
  ctx.drawImage(sprite, frame * 32, row * 32, 32, 32, x-size/2, y-size/2, size, size);
}
