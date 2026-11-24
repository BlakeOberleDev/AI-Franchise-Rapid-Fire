import { AudioEngine } from './audioEngine.js';
import { makeSprite, drawUnit } from './spriteGenerator.js';
import { loadSave, writeSave } from './saveManager.js';

export class TacticalEngine {
  constructor(canvas, data, overrides = {}) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.data = data; this.overrides = overrides;
    this.audio = new AudioEngine(); this.save = loadSave(); this.running = false; this.paused = false;
    this.selected = new Set(); this.units = []; this.enemies = []; this.towers = []; this.effects = [];
    this.stageIndex = 0; this.wave = 0; this.waveTimer = 2; this.waveGold = 300;
    this.elapsed = 0; this.cataclysmTimer = 35; this.drag = null; this.speed = 1;
    this.towerTypes = data.towers || []; this.heroes = data.heroes || [];
  }
  async boot() {
    this.audio.init(); this.audio.setVolumes(this.save.settings); this.audio.startMusic(this.data.id || 1);
    this.resize(); addEventListener('resize', () => this.resize());
    await this.showBriefing();
  }
  showBriefing() {
    return new Promise(resolve => {
      const stage = this.data.stages[this.stageIndex];
      const panel = document.createElement('div');
      panel.className = 'briefing';
      panel.innerHTML = `<h1>${this.data.title}</h1><h2>${stage.name}</h2><p>${stage.brief}</p>
        <h3>Choose 6 heroes</h3><div class="hero-picks"></div>
        <h3>Choose 3 support towers</h3><div class="tower-picks"></div>
        <button class="primary launch">Deploy Squad</button>`;
      const hp = panel.querySelector('.hero-picks'), tp = panel.querySelector('.tower-picks');
      this.heroes.forEach((h,i) => {
        const b=document.createElement('button'); b.textContent=h.name; b.dataset.index=i;
        if(i<6)b.classList.add('picked'); b.onclick=()=>{ if(b.classList.toggle('picked')&&hp.querySelectorAll('.picked').length>6) b.classList.remove('picked'); };
        hp.appendChild(b);
      });
      this.towerTypes.forEach((t,i) => {
        const b=document.createElement('button'); b.textContent=t.name; b.dataset.index=i;
        if(i<3)b.classList.add('picked'); b.onclick=()=>{ if(b.classList.toggle('picked')&&tp.querySelectorAll('.picked').length>3) b.classList.remove('picked'); };
        tp.appendChild(b);
      });
      document.body.appendChild(panel);
      panel.querySelector('.launch').onclick=()=> {
        const heroes=[...hp.querySelectorAll('.picked')].slice(0,6).map(b=>this.heroes[+b.dataset.index]);
        const towers=[...tp.querySelectorAll('.picked')].slice(0,3).map(b=>this.towerTypes[+b.dataset.index]);
        panel.remove(); this.loadStage(this.stageIndex, heroes, towers); resolve();
      };
    });
  }
  resize() {
    const r=this.canvas.getBoundingClientRect(); this.canvas.width=Math.max(800,r.width||innerWidth); this.canvas.height=480;
  }
  loadStage(index, heroes, towerTypes) {
    this.stageIndex=index; const stage=this.data.stages[index];
    this.units=[]; this.enemies=[]; this.towers=[]; this.effects=[]; this.wave=0; this.waveTimer=3;
    this.defeatTimer=0;
    heroes.forEach((h,i)=>this.units.push(this.makeUnit(h,'hero',90,100+i*55)));
    for(let i=0;i<3;i++)this.units.push(this.makeUnit({name:(this.data.troops&&this.data.troops[i])?.name||['Front Guard','Ranged Line','Shield Scout'][i],hp:70,color:'#85b6a2',dark:'#35514b'},'troop',55,135+i*70));
    stage.pads?.forEach((p,i)=>{
      if(i<towerTypes.length)this.towers.push({ ...towerTypes[i], x:p[0], y:p[1], tier:1, sprite:makeSprite('tower',[towerTypes[i].color||'#61d8ff','#263b75']) });
    });
    this.running=true; this.paused=false; this.bindInput(); requestAnimationFrame(t=>this.loop(t));
  }
  makeUnit(def,kind,x,y) {
    return { ...def, kind, x,y,vx:0,vy:0,hp:def.hp||100,maxHp:def.hp||100,mana:100,maxMana:100,
      respawn:0,radius:def.radius||13,speed:def.speed||55,cooldown:0,attackCd:0,
      sprite:makeSprite('hero',[def.color||'#66ddff',def.dark||'#25365e']),
      target:null,frame:0,anim:0 };
  }
  bindInput() {
    this.canvas.onpointerdown=e=>this.pointer(e,true);
    this.canvas.onpointermove=e=>{ if(this.drag){ this.drag.x=e.offsetX; this.drag.y=e.offsetY; } };
    this.canvas.onpointerup=e=>this.pointer(e,false);
    addEventListener('keydown',e=>{
      if(e.code==='Space'){ e.prevent; this.paused=!this.paused; }
      if(e.key==='1')this.speed=1; if(e.key==='2')this.speed=2;
      if(/^[1-6]$/.test(e.key)){ const u=this.units[+e.key-1]; if(u){this.selected.clear();this.selected.add(u);} }
      if(['KeyQ','KeyW','KeyE'].includes(e.code)){const s={KeyQ:0,KeyW:1,KeyE:2}[e.code];for(const u of this.selected)this.cast(u,s);}
    });
  }
  pointer(e,down) {
    const x=e.offsetX,y=e.offsetY;
    if(down){
      let hit=[...this.units,...this.towers].find(u=>Math.hypot(u.x-x,u.y-y)<22);
      if(hit?.tier){ if(this.waveGold>=50&&hit.tier<3){hit.tier++;this.waveGold-=50;this.audio.sfx('place');}return; }
      if(hit?.kind==='hero'||hit?.kind==='troop'){ if(e.shiftKey)this.selected.add(hit);else{this.selected.clear();this.selected.add(hit);} this.drag={x,y}; }
      else if(e.button===2||e.shiftKey){ for(const u of this.selected)u.target={x,y}; }
      else { this.selected.clear(); this.drag={x,y}; }
    } else if(this.drag){
      if(this.drag && ![...this.units].some(u=>Math.hypot(u.x-this.drag.x,u.y-this.drag.y)<22))
        for(const u of this.selected)u.target={x,y};
      this.drag=null;
    }
  }
  cast(unit,index) {
    if(unit.respawn>0||unit.cooldown>0)return;
    unit.cooldown=12;
    this.effects.push({kind:'ring',x:unit.x,y:unit.y,r:10,max:110,color:'#8cf',life:.7});
    this.enemies.forEach(e=>{if(Math.hypot(e.x-unit.x,e.y-unit.y)<110)e.hp-=38*(1+index*.15);});
    this.audio.sfx('spell');
  }
  spawnWave() {
    const stage=this.data.stages[this.stageIndex];
    const count=7+this.wave*2+(stage.difficulty||1);
    for(let i=0;i<count;i++){
      const enemy=(this.data.enemies||[{name:'Raider',hp:70,color:'#c44'}])[i%(this.data.enemies?.length||1)];
      this.enemies.push({...this.makeUnit({...enemy,kind:'enemy',speed:enemy.speed||35},'enemy',this.canvas.width-30,80+(i%7)*52),
        hp:enemy.hp||70,maxHp:enemy.hp||70,role:enemy.role||'shredder'});
    }
    this.wave++;
  }
  loop(t) {
    if(!this.running)return;
    const dt=Math.min(.033,((t-(this.last||t))/1000||0))*this.speed; this.last=t;
    if(!this.paused)this.update(dt);
    this.draw();
    requestAnimationFrame(n=>this.loop(n));
  }
  update(dt) {
    this.elapsed+=dt; this.cataclysmTimer-=dt;
    if(this.cataclysmTimer<=0){this.cataclysmTimer=35;this.effects.push({kind:'hazard',life:3,r:140,x:Math.random()*this.canvas.width,y:100+Math.random()*300});}
    if(this.waveTimer>0)this.waveTimer-=dt;else if(this.wave===0||this.enemies.length===0){if(this.wave<5)this.spawnWave();this.waveTimer=12;}
    for(const u of this.units){
      if(u.respawn>0){u.respawn-=dt;if(u.respawn<=0){u.hp=u.maxHp;u.x=90;u.y=200;}continue;}
      u.cooldown=Math.max(0,u.cooldown-dt); u.attackCd=Math.max(0,u.attackCd-dt);
      if(u.target){const d=Math.hypot(u.target.x-u.x,u.target.y-u.y);if(d>5){u.x+=(u.target.x-u.x)/d*u.speed*dt;u.y+=(u.target.y-u.y)/d*u.speed*dt;}else u.target=null;}
      let foe=u.kind==='hero'?this.enemies.reduce((a,e)=>!a||Math.hypot(e.x-u.x,e.y-u.y)<Math.hypot(a.x-u.x,a.y-u.y)?e:a,null):null;
      if(foe&&Math.hypot(foe.x-u.x,foe.y-u.y)<150&&u.attackCd<=0){foe.hp-=16+(u.damage||5);u.attackCd=1;this.effects.push({kind:'slash',x:(foe.x+u.x)/2,y:(foe.y+u.y)/2,life:.18});if(foe.hp<=0)this.waveGold+=12;}
    }
    for(const e of this.enemies){
      e.attackCd=Math.max(0,(e.attackCd||0)-dt);
      if(e.hp<=0)continue;
      let target=this.units.filter(u=>u.respawn<=0).sort((a,b)=>Math.hypot(a.x-e.x,a.y-e.y)-Math.hypot(b.x-e.x,b.y-e.y))[0];
      if(target){const d=Math.hypot(target.x-e.x,target.y-e.y);if(d>28){e.x+=(target.x-e.x)/d*e.speed*dt;e.y+=(target.y-e.y)/d*e.speed*dt;}else if(!e.attackCd||e.attackCd<=0){target.hp-=10;e.attackCd=.9;this.audio.sfx('hurt');}}
    }
    for(const u of this.units)if(u.hp<=0&&u.respawn<=0){u.respawn=18;u.hp=0;}
    const heroesAlive=this.units.some(u=>u.kind==='hero'&&(u.hp>0||u.respawn>0));
    if(!heroesAlive){this.defeatTimer+=dt;if(this.defeatTimer>6)this.finish(false);}else this.defeatTimer=0;
    this.enemies=this.enemies.filter(e=>e.hp>0);
    this.effects.forEach(f=>f.life-=dt);this.effects=this.effects.filter(f=>f.life>0);
    if(this.wave>=5&&this.enemies.length===0)this.finish(true);
  }
  finish(win) {
    if(!this.running)return; this.running=false; this.audio.sfx(win?'victory':'boss');
    const game=this.save.games[this.data.id];
    if(win){game.completedStages=[...new Set([...game.completedStages,this.stageIndex+1])];game.unlockedStages=[...new Set([...(game.unlockedStages||[]),this.stageIndex+2])];writeSave(this.save);}
    if(win && this.data.id===13){
      const endingNames=['A — Restoration','B — Eternal Cycle','C — Mentor’s Return','D — Unified Orb'];
      const choice=prompt('Choose the final Orb/Wellspring resolution:\n1 = Restoration\n2 = Eternal Cycle\n3 = Mentor’s Return\n4 = Unified Orb','1');
      const ending=endingNames[Math.max(0,Math.min(3,(Number(choice)||1)-1))];
      game.endings=[...new Set([...(game.endings||[]),ending])];writeSave(this.save);
    }
    const panel=document.createElement('div');panel.className='victory';
    panel.innerHTML=`<div><h1>${win?'VICTORY':'DEFEAT'}</h1><p>${win?'The stage has been secured.':'The frontline has fallen.'}</p><button class="primary again">${win&&this.stageIndex<this.data.stages.length-1?'Next Stage':'Replay Stage'}</button><a href="../../index.html">Return to Launcher</a></div>`;
    document.body.appendChild(panel);
    panel.querySelector('.again').onclick=()=>{panel.remove();if(win&&this.stageIndex<this.data.stages.length-1)this.stageIndex++;this.showBriefing();};
  }
  draw() {
    const c=this.ctx,w=this.canvas.width,h=this.canvas.height; c.clearRect(0,0,w,h);
    const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,'#10172c');g.addColorStop(1,this.data.theme||'#182a38');c.fillStyle=g;c.fillRect(0,0,w,h);
    c.strokeStyle='#7edcff22';c.lineWidth=2;c.beginPath();c.moveTo(40,h*.5);c.lineTo(w-40,h*.5);c.stroke();
    c.fillStyle='#ffd47a';c.font='14px sans-serif';c.fillText(`WAVE ${Math.min(this.wave+1,5)}  •  GOLD ${this.waveGold}`,16,24);
    for(const t of this.towers){c.globalAlpha=.65;c.fillStyle=t.color||'#67dfff';c.beginPath();c.arc(t.x,t.y,44,0,Math.PI*2);c.fill();c.globalAlpha=1;drawUnit(c,t.sprite,t.x,t.y,34,0,0);}
    for(const u of this.units){
      if(u.respawn>0){c.fillStyle='#fff';c.font='12px sans-serif';c.fillText(`${u.name} ${Math.ceil(u.respawn)}s`,u.x-25,210);continue;}
      drawUnit(c,u.sprite,u.x,u.y,30,this.frame||0,u.kind==='enemy'?2:0);
      c.fillStyle='#180c1d';c.fillRect(u.x-16,u.y-22,32,4);c.fillStyle='#66e0a3';c.fillRect(u.x-16,u.y-22,32*(u.hp/u.maxHp),4);
      if(this.selected.has(u)){c.strokeStyle='#ffe480';c.beginPath();c.arc(u.x,u.y,20,0,Math.PI*2);c.stroke();}
    }
    for(const e of this.enemies){drawUnit(c,e.sprite,e.x,e.y,32,1,2);c.fillStyle='#26101d';c.fillRect(e.x-16,e.y-22,32,4);c.fillStyle='#f16d69';c.fillRect(e.x-16,e.y-22,32*(e.hp/e.maxHp),4);}
    for(const f of this.effects){
      c.save();c.globalAlpha=Math.min(1,f.life*2);
      if(f.kind==='ring'){c.strokeStyle=f.color;c.lineWidth=4;c.beginPath();c.arc(f.x,f.y,f.r+(1-f.life)*50,0,Math.PI*2);c.stroke();}
      if(f.kind==='hazard'){c.fillStyle='#ff493b77';c.beginPath();c.arc(f.x,f.y,35+Math.sin(this.elapsed*8)*8,0,Math.PI*2);c.fill();}
      if(f.kind==='slash'){c.strokeStyle='#fff';c.lineWidth=3;c.beginPath();c.moveTo(f.x-12,f.y-12);c.lineTo(f.x+12,f.y+12);c.stroke();}
      c.restore();
    }
  }
}
