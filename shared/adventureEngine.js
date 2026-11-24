import { AudioEngine } from './audioEngine.js';
import { loadSave, writeSave } from './saveManager.js';

export class AdventureEngine {
  constructor(canvas, data) {
    this.canvas=canvas; this.ctx=canvas.getContext('2d'); this.data=data; this.audio=new AudioEngine();
    this.save=loadSave(); this.party=data.party||[]; this.leader=0; this.keys={}; this.x=400; this.y=250;
    this.region=0; this.crystals=[]; this.orbs=false; this.enemies=[]; this.scrolls=[];
  }
  boot() {
    this.audio.init();this.audio.setVolumes(this.save.settings);this.audio.startMusic(7);this.resize();
    addEventListener('resize',()=>this.resize());
    addEventListener('keydown',e=>{this.keys[e.key.toLowerCase()]=true;if(/^[1-4]$/.test(e.key))this.leader=+e.key-1;if(e.code==='KeyX')this.attack();if(e.code==='KeyZ')this.interact();});
    addEventListener('keyup',e=>this.keys[e.key.toLowerCase()]=false);
    this.loadRegion(0);requestAnimationFrame(t=>this.loop(t));
  }
  resize(){this.canvas.width=960;this.canvas.height=540;}
  loadRegion(i){
    this.region=i;this.enemies=[];const stage=this.data.regions[i];
    for(let n=0;n<(i===4?8:5+i);n++)this.enemies.push({x:300+n*85%850,y:140+(n*97)%330,hp:60+i*10,maxHp:60+i*10,name:stage.enemy});
    this.crystals=stage.crystals||[];this.scrolls=stage.scrolls||[];
  }
  loop(t){
    const dt=Math.min(.033,((t-(this.last||t))/1000||0));this.last=t;this.update(dt);this.draw();requestAnimationFrame(n=>this.loop(n));
  }
  update(dt){
    let dx=(this.keys.d||this.keys.arrowright?1:0)-(this.keys.a||this.keys.arrowleft?1:0);
    let dy=(this.keys.s||this.keys.arrowdown?1:0)-(this.keys.w||this.keys.arrowup?1:0);
    const m=Math.hypot(dx,dy)||1;if(dx||dy){this.x+=(dx/m)*180*dt;this.y+=(dy/m)*180*dt;}
    this.x=Math.max(20,Math.min(940,this.x));this.y=Math.max(20,Math.min(520,this.y));
    for(let i=1;i<this.party.length;i++){
      const angle=(i/this.party.length)*Math.PI*2,tx=this.x-Math.cos(angle)*40,ty=this.y-Math.sin(angle)*40;
      this.party[i].fx+=(tx-(this.party[i].fx||tx))*dt*3;this.party[i].fy+=(ty-(this.party[i].fy||ty))*dt*3;
    }
  }
  attack(){
    this.audio.sfx(this.party[this.leader].range?'bow':'sword');
    for(const e of this.enemies){if(Math.hypot(e.x-this.x,e.y-this.y)<75)e.hp-=35;}
    this.enemies=this.enemies.filter(e=>e.hp>0);
  }
  interact(){
    for(const c of this.crystals){if(Math.hypot(c.x-this.x,c.y-this.y)<55)c.active=true;}
    for(const s of this.scrolls){if(Math.hypot(s.x-this.x,s.y-this.y)<55)s.read=true;}
    if(this.crystals.every(c=>c.active)&&this.region<4)this.loadRegion(this.region+1);
    if(this.region===4&&Math.hypot(this.x-480,this.y-270)<70){this.orbs=true;this.finish(true);}
  }
  finish(win){
    const game=this.save.games[12];game.completedStages=[...new Set([...game.completedStages,win?5:this.region+1])];game.gameSpecificFlags={crystals:4,lightOrb:true,darkOrb:true};writeSave(this.save);
    const panel=document.createElement('div');panel.className='victory';
    panel.innerHTML=`<div><h1>${win?'REBIRTH COMPLETE':'The journey continues'}</h1><p>The Four Crystals burn bright and the lost Orbs awaken.</p><a href="../../index.html">Return to Launcher</a></div>`;document.body.appendChild(panel);
  }
  draw(){
    const c=this.ctx;c.fillStyle=['#1d4a67','#612c2b','#1e5261','#4f5b35','#30224d'][this.region];c.fillRect(0,0,960,540);
    c.fillStyle='#d8fff022';for(let i=0;i<25;i++){c.beginPath();c.arc((i*173+this.region*70)%960,(i*71)%540,18+(i%4)*8,0,Math.PI*2);c.fill();}
    c.fillStyle='#ffe5a8';c.font='16px sans-serif';c.fillText(this.data.regions[this.region].name,24,30);
    for(const s of this.scrolls){c.fillStyle=s.read?'#777':'#ffd98a';c.fillRect(s.x-8,s.y-12,16,24);}
    for(const crystal of this.crystals){c.fillStyle=crystal.active?'#82fff5':'#b58cff';c.beginPath();c.moveTo(crystal.x,crystal.y-18);c.lineTo(crystal.x+12,crystal.y);c.lineTo(crystal.x,crystal.y+18);c.lineTo(crystal.x-12,crystal.y);c.fill();}
    for(const e of this.enemies){c.fillStyle='#8d3046';c.beginPath();c.arc(e.x,e.y,18,0,Math.PI*2);c.fill();c.fillStyle='#1d111b';c.fillRect(e.x-18,e.y-25,36,4);c.fillStyle='#f27474';c.fillRect(e.x-18,e.y-25,36*(e.hp/e.maxHp),4);}
    this.party.forEach((p,i)=>{
      const x=i===0?this.x:(p.fx||this.x),y=i===0?this.y:(p.fy||this.y);
      c.fillStyle=i===this.leader?'#fff1a8':p.color||'#72a6ff';c.beginPath();c.arc(x,y,13,0,Math.PI*2);c.fill();
      c.fillStyle='#161829';c.font='11px sans-serif';c.fillText(p.name,x-16,y-19);
    });
  }
}
