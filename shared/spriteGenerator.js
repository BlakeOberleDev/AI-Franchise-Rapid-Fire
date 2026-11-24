export function makeSprite(kind, colors = ['#61d8ff', '#17233a'], size = 32, variant = '') {
  const canvas = document.createElement('canvas');
  canvas.width = size * 4; canvas.height = size * 4;
  const c = canvas.getContext('2d');
  c.imageSmoothingEnabled = false;
  const type=variant.toLowerCase();
  for (let row = 0; row < 4; row++) {
    for (let frame = 0; frame < 4; frame++) {
      const x = frame * size, y = row * size;
      c.save(); c.translate(x, y);
      c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(size/2, size-5, 10, 4, 0, 0, Math.PI*2); c.fill();
      if (kind === 'tower') {
        c.fillStyle = colors[1]; c.fillRect(8, 9, 16, 18);
        c.fillStyle = colors[0]; c.beginPath(); c.moveTo(16, 3); c.lineTo(27, 16); c.lineTo(5,16); c.fill();
        c.fillStyle = '#fff'; c.fillRect(14, 12, 4, 4);
        c.fillStyle='#d9e7ff';c.fillRect(13,23,6,7);
        if(type.includes('gate')||type.includes('warp')){c.strokeStyle='#e3cbff';c.lineWidth=2;c.beginPath();c.ellipse(16,18,8,11,0,0,Math.PI*2);c.stroke();}
      } else {
        const enemy=kind==='enemy',tank=type.includes('tank')||type.includes('guard')||type.includes('vanguard'),mage=type.includes('mage')||type.includes('healer')||type.includes('cleric'),ranged=type.includes('ranger')||type.includes('archer')||type.includes('scout');
        const walk = row === 1 ? (frame % 2 ? 2 : -2) : 0;
        c.fillStyle=colors[1];
        if(mage&&!enemy){c.beginPath();c.moveTo(8,27);c.lineTo(10,13);c.lineTo(22,13);c.lineTo(25,27);c.closePath();c.fill();}
        else c.fillRect(tank?7:9,13,tank?18:14,14);
        c.fillStyle=colors[0];
        if(enemy){c.beginPath();c.moveTo(7,15);c.lineTo(9,7);c.lineTo(13,11);c.lineTo(19,8);c.lineTo(24,14);c.lineTo(22,23);c.lineTo(9,23);c.closePath();c.fill();}
        else if(mage){c.beginPath();c.moveTo(9,14);c.lineTo(16,5);c.lineTo(23,14);c.fill();}
        else c.fillRect(tank?9:10,7,tank?14:12,8);
        c.fillStyle=enemy?'#d8b8a6':'#f2d2ad';c.fillRect(12,9,8,5);
        c.fillStyle=colors[1];c.fillRect(10+walk,26,4,5);c.fillRect(18-walk,26,4,5);
        if(tank&&!enemy){c.fillStyle='#c8d3e2';c.fillRect(4,15,5,11);c.strokeStyle='#fff9';c.strokeRect(4,15,5,11);}
        else if(ranged&&!enemy){c.strokeStyle='#f0d99c';c.lineWidth=1.5;c.beginPath();c.arc(25,19,6,-Math.PI/2,Math.PI/2);c.stroke();c.beginPath();c.moveTo(25,13);c.lineTo(25,25);c.stroke();}
        else{c.fillStyle=mage?'#ffe89a':'#d7e8ff';c.fillRect(24,12,2,16);c.fillStyle=mage?'#fff3ac':'#a7c7ff';c.fillRect(22,9,6,5);}
        if(enemy){c.fillStyle='#ffdc87';c.fillRect(13,11,2,2);c.fillRect(18,11,2,2);}
        if(row===2){c.globalAlpha=.7;c.fillStyle='#fff4';c.beginPath();c.arc(27+frame,16,5+frame,0,Math.PI*2);c.fill();c.globalAlpha=1;}
        if(row===3){c.globalAlpha=.42;c.fillStyle='#ffb7a5';c.fillRect(7,7,18,21);c.globalAlpha=1;}
      }
      c.restore();
    }
  }
  return canvas;
}
export function drawUnit(ctx, sprite, x, y, size = 32, frame = 0, row = 0) {
  ctx.drawImage(sprite, frame * 32, row * 32, 32, 32, x-size/2, y-size/2, size, size);
}
