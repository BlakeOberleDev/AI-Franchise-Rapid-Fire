import { AudioEngine } from './audioEngine.js';
import { makeSprite, drawUnit } from './spriteGenerator.js';
import { loadSave, writeSave } from './saveManager.js';

const TROOP_ROSTERS = {
  1:['Flint-Spearmen','Torch-Bearers','Tunnel-Scouts'],2:['Liberated Miners','Arcane Initiates','Crystal-Slingers'],
  3:['Mystic Acolytes','Runic Phalanx','Spell-Archers'],4:['Temple Guardians','Orb-Mages','Relic-Bearers'],
  5:['Alliston Pikemen','Lorentil Crossbowmen','Elven Swordsmen','Dwarven Deep-Wardens'],
  6:['Alliston Lancers','Lorentil Halberdiers','Battle-Mages'],7:['Alliston Pikemen','Royal Archers','Lorentil Knights','Elven Scouts'],
  8:['Lorentil Footmen','Dwarven Deep-Wardens','Tunnel-Crossbowmen','Elven Trackers'],
  9:['Port-Marines','Deck-Archers','Elven Wave-Blades','Ancient Acolytes'],
  10:['Sky-Marines','Grapple-Archers','Dwarven Iron-Anchors','Wind-Mages'],
  11:['Alliance Vanguard','Elven Spell-Blades','Dwarven Bastion-Guard','Atlantean Tide-Guard'],
  13:['Awakened Ancients','Alliance Paladins','Crystal-Weavers','Elven-Dwarven Vanguard']
};
const SIGNATURE_MECHANICS={
  1:'Elemental Cataclysm Cycles · Every 35 seconds, the hazard shifts safe ground.',
  2:'Crystal Siphon Nodes · Hold the marked veins to accelerate the allied tempo.',
  3:'Ritual Crystal Anchors · Keep the Titan away from the charging pylons.',
  4:'Light / Void Polarity · Radiance and corruption alternate across the field.',
  5:'Frost–Flame Synergy · Chill the caldera lanes to weaken fiery enemies.',
  6:'Reality Tears · Contain fire anomalies before they erupt across the line.',
  7:'Blizzard & Thaw · Isolated units slow in the retreat; stay near hearths.',
  8:'Stampede Lanes · Watch the warning line and move sideways before impact.',
  9:'Rising Tide · The low ground floods in timed pulses.',
  10:'Wind Currents · Gale fronts push exposed units across the sky lanes.',
  11:'Elemental Phase Rotation · The field changes its dominant element every 30 seconds.',
  13:'Orb Overcharge · Build the final charge, then decide the Emergence’s fate.'
};
const FINAL_BOSSES={
  1:'The Unbound Convergence',2:'Ascended Gildelal',3:'Four Colossal Primordials',4:'Lord Erebus',
  5:'The Fire Entity',6:'Gimelal the Undying',7:'The Ice Entity',8:'The Ancient Dino King',
  9:'The Primordial Water Entity',10:'The Earth & Air Entities',11:'The Maelstrom Amalgam',
  13:'The Combined Arcane-Elemental Entity'
};
const STAGE_BOSSES={
  1:['Magma Matriarch','Flood-Gorge Leviathan','Gale-Crowned Roc','Tomb-Stone Guardian','The Unbound Convergence'],
  2:['Pit Overseer','Iron-Forge Goliath','Blood-Spire Warlock','Citadel Reaver','Ascended Gildelal'],
  3:['Basalt Titan','Sky-Spire Tempest','Abyssal Tide Titan','Caldera Fire Titan',['Earth Titan','Air Titan','Water Titan','Fire Titan']],
  4:['Rift-Weaver Lord','Harethel’s Shadow','Temple Ash-Colossus','Rejuvenated Fire Entity','Lord Erebus'],
  5:['Cinder-Hound Alpha','Gatebreaker Brute','Mountain Pyre-Maw','Frost-Peak Warden','The Fire Entity'],
  6:['Eastern War Chief','Anomaly Warden','Lorentil Wallbreaker','Steppe Devourer','Gimelal the Undying'],
  7:['Alliston Ice-Lancer','River Frost-Giant','Pine-Pass Stalker','Lorentil Siege-Yeti','Glacier-Rider King','The Ice Entity'],
  8:['Ruin Broodmother','Mountain Tricera','Tunnel Burrower','Brood-Mother Queen','Dino-Camp Warlord','The Ancient Dino King'],
  9:['Harbor Kraken','Coral Admiral','Reef Stalker','Tide Citadel Warden','The Primordial Water Entity'],
  10:['Granite Devourer','Bridge Tempest','Twin Monolith Sentinel','Skyreach Colossus','Earth-Air Harbinger',['The Earth Entity','The Air Entity']],
  11:['Rift Sentinel','Frost-Fire Chimera','Horizon Warden','Fourfold Horror','The Maelstrom Amalgam'],
  13:['Void Knight Captain','Erebus’s Executioner','Four-Crystal Devourer','Orb Seeker','Void Siege Herald','The Combined Arcane-Elemental Entity']
};

export class TacticalEngine {
  constructor(canvas, data, overrides = {}) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.data = data; this.overrides = overrides;
    this.audio = new AudioEngine(); this.save = loadSave(); this.running = false; this.paused = false;
    this.selected = new Set(); this.units = []; this.enemies = []; this.towers = []; this.effects = [];
    this.stageIndex = 0; this.wave = 0; this.waveTimer = 2; this.waveGold = 300;
    this.elapsed = 0; this.cataclysmTimer = 35; this.drag = null; this.speed = 1;
    this.towerTypes = data.towers || []; this.heroes = data.heroes || [];
    this.troopCooldown = 0; this.lastTime = 0; this.modalOpen = false;
    this.signature = Object.values(data.mechanics||overrides).find(value=>typeof value==='string')||SIGNATURE_MECHANICS[data.id]||'Squad tactics · Position your team and adapt to the enemy formation.';
    this.warning=null;this.mechanicTimer=data.id===1?35:data.id===11?30:18;this.phaseTimer=30;this.phase=0;this.orbCharge=0;this.nodeTimer=0;
  }
  async boot() {
    this.audio.init(); this.audio.setVolumes(this.save.settings); this.audio.startMusic(this.data.id || 1);
    this.resize(); addEventListener('resize', () => this.resize());
    if (this.save.settings.autoPause) document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.paused = true;
    });
    await this.showBriefing();
  }
  showBriefing() {
    return new Promise(resolve => {
      const stage = this.data.stages[this.stageIndex];
      const overlay = document.createElement('div');
      overlay.className = 'briefing-overlay';
      const panel = document.createElement('div');
      panel.className = 'briefing-panel';
      panel.innerHTML = `<h1>${this.data.title}</h1><h2>${stage.name}</h2><p>${stage.brief}</p>
        <p class="stage-meta">STAGE ${this.stageIndex + 1} / ${this.data.stages.length} &nbsp;·&nbsp; ${stage.difficulty ? `THREAT ${stage.difficulty}/5` : 'Campaign mission'}</p>
        <div class="stage-strip"></div>
        <h3>Choose 6 heroes</h3><div class="hero-picks"></div>
        <h3>Choose 3 support towers</h3><div class="tower-picks"></div>
        <p class="mechanic-card"><span>FIELD DOCTRINE</span><strong>${this.signature}</strong></p>
        <p class="selection-hint">Pick a balanced squad and three non-damaging support structures. Towers buff allies or disrupt enemies; they never deal HP damage.</p>
        <button class="primary launch" disabled>Choose 6 heroes and 3 towers</button>`;
      const hp = panel.querySelector('.hero-picks'), tp = panel.querySelector('.tower-picks');
      const launch = panel.querySelector('.launch');
      const progress=this.save.games[this.data.id]||{unlockedStages:[1]};
      const strip=panel.querySelector('.stage-strip');
      this.data.stages.forEach((s,i)=>{
        const unlocked=(progress.unlockedStages||[1]).includes(i+1);
        const button=document.createElement('button');button.textContent=`${String(i+1).padStart(2,'0')} · ${s.name}${progress.completedStages?.includes(i+1)?' ✓':''}`;
        button.disabled=!unlocked;button.className=i===this.stageIndex?'current':'';
        button.onclick=()=>{this.stageIndex=i;overlay.remove();this.showBriefing().then(resolve);};
        strip.appendChild(button);
      });
      const updateLaunch = () => {
        const valid = hp.querySelectorAll('.picked').length === 6 && tp.querySelectorAll('.picked').length === 3;
        launch.disabled = !valid;
        launch.textContent = valid ? 'Deploy Squad' : `Choose ${6-hp.querySelectorAll('.picked').length} more heroes · ${3-tp.querySelectorAll('.picked').length} more towers`;
      };
      this.heroes.forEach((h,i) => {
        const b=document.createElement('button'); b.textContent=h.name; b.dataset.index=i;
        b.title=`${h.role||'Champion'} · ${h.hp||100} HP · Q strike · W rally heal · E bind`;
        if(i<6)b.classList.add('picked');
        b.onclick=()=>{ if(b.classList.toggle('picked')&&hp.querySelectorAll('.picked').length>6) b.classList.remove('picked'); updateLaunch(); };
        hp.appendChild(b);
      });
      this.towerTypes.forEach((t,i) => {
        const b=document.createElement('button'); b.textContent=t.name; b.dataset.index=i;
        b.title='Zero direct damage · boosts allies or disrupts nearby enemies · click during battle to upgrade for 50 gold';
        if(i<3)b.classList.add('picked');
        b.onclick=()=>{ if(b.classList.toggle('picked')&&tp.querySelectorAll('.picked').length>3) b.classList.remove('picked'); updateLaunch(); };
        tp.appendChild(b);
      });
      updateLaunch();
      overlay.appendChild(panel);overlay.appendChild(launch);document.body.appendChild(overlay);
      launch.onclick=()=> {
        const heroes=[...hp.querySelectorAll('.picked')].slice(0,6).map(b=>this.heroes[+b.dataset.index]);
        const towers=[...tp.querySelectorAll('.picked')].slice(0,3).map(b=>this.towerTypes[+b.dataset.index]);
        overlay.remove(); this.loadStage(this.stageIndex, heroes, towers); resolve();
      };
    });
  }
  resize() {
    this.canvas.width=960; this.canvas.height=540;
  }
  loadStage(index, heroes, towerTypes) {
    this.stageIndex=index; const stage=this.data.stages[index];
    this.units=[]; this.enemies=[]; this.towers=[]; this.effects=[]; this.wave=0; this.waveTimer=3;
    this.defeatTimer=0; this.elapsed=0; this.troopCooldown=0; this.lastTime=0;this.score=0;
    this.warning=null;this.mechanicTimer=this.data.id===1?35:this.data.id===11?30:18;this.phaseTimer=30;this.phase=0;
    this.nodes=this.data.id===2?[[330,185],[630,350]].map((p,i)=>({x:p[0],y:p[1],owner:0,id:i})): [];
    this.anchors=this.data.id===3?(stage.pads||[]).slice(0,index===4?4:3).map((p,i)=>({x:p[0],y:p[1],charge:0,id:i})): [];
    this.drainCharge=0;
    heroes.forEach((h,i)=>this.units.push(this.makeUnit(h,'hero',90,100+i*55)));
    const roster=this.data.troops||TROOP_ROSTERS[this.data.id]||['Front Guard','Ranged Line','Shield Scout'];
    for(let i=0;i<3;i++){const troop=roster[i%roster.length];this.units.push(this.makeUnit({name:typeof troop==='string'?troop:troop.name,hp:70,color:['#85b6a2','#dfbd77','#82a9d8'][i],dark:'#35514b',role:'troop'},'troop',55,135+i*70));}
    stage.pads?.forEach((p,i)=>{
      if(i<towerTypes.length)this.towers.push({ ...towerTypes[i], x:p[0], y:p[1], tier:1, sprite:makeSprite('tower',[towerTypes[i].color||'#61d8ff','#263b75'],32,towerTypes[i].name) });
    });
    this.running=true; this.paused=false; this.bindInput(); this.createHud(); requestAnimationFrame(t=>this.loop(t));
  }
  makeUnit(def,kind,x,y) {
    const role=(def.role||'').toLowerCase();
    const damage=def.damage||(role.includes('tank')||role.includes('guard')?13:role.includes('ranger')||role.includes('archer')?21:role.includes('assassin')||role.includes('striker')?25:role.includes('mage')||role.includes('weaver')?19:kind==='troop'?12:17);
    const range=role.includes('ranger')||role.includes('archer')||role.includes('scout')?190:role.includes('mage')||role.includes('healer')||role.includes('cleric')?155:kind==='troop'?118:86;
    return { ...def, kind, role:def.role||'', damage, range, armor:role.includes('tank')||role.includes('vanguard') ? .28 : 0, passiveTimer:2.4,
      x,y,vx:0,vy:0,hp:def.hp||100,maxHp:def.hp||100,mana:100,maxMana:100,
      respawn:0,radius:def.radius||13,speed:def.speed||55,cooldown:0,attackCd:0,
      sprite:makeSprite(kind==='enemy'?'enemy':'hero',[def.color||'#66ddff',def.dark||'#25365e'],32,def.role||def.name||''),
      target:null,frame:0,anim:0 };
  }
  bindInput() {
    this.canvas.onpointerdown=e=>this.pointer(e,true);
    this.canvas.oncontextmenu=e=>e.preventDefault();
    this.canvas.onpointermove=e=>{ if(this.drag){ const p=this.pointerPosition(e);this.drag.x=p.x; this.drag.y=p.y; } };
    this.canvas.onpointerup=e=>this.pointer(e,false);
    this.keyHandler=e=>{
      if(e.code==='Space'){e.preventDefault();this.togglePause();}
      if(e.code==='KeyG')this.speed=this.speed===1?2:1;
      if(/^[1-6]$/.test(e.key)){const u=this.units.filter(x=>x.kind==='hero')[+e.key-1];if(u){this.selected.clear();this.selected.add(u);this.updateHud();}}
      if(['KeyQ','KeyW','KeyE'].includes(e.code)){e.preventDefault();const s={KeyQ:0,KeyW:1,KeyE:2}[e.code];for(const u of this.selected)this.cast(u,s);}
      if(e.code==='KeyR')this.deployTroops();
      if(e.code==='Escape')this.togglePause();
    };
    addEventListener('keydown',this.keyHandler);
  }
  pointerPosition(e) {
    const r=this.canvas.getBoundingClientRect();
    return {x:(e.clientX-r.left)*this.canvas.width/r.width,y:(e.clientY-r.top)*this.canvas.height/r.height};
  }
  pointer(e,down) {
    const {x,y}=this.pointerPosition(e);
    if(down){
      let hit=[...this.units,...this.towers].find(u=>Math.hypot(u.x-x,u.y-y)<22);
      if(hit?.tier){if(this.waveGold>=50&&hit.tier<3){hit.tier++;this.waveGold-=50;this.audio.sfx('place');this.updateHud();}return;}
      if((hit?.kind==='hero'||hit?.kind==='troop')&&hit.respawn<=0) {
        if(e.shiftKey)this.selected.add(hit);else if(!this.selected.has(hit)){this.selected.clear();this.selected.add(hit);}
        this.drag={x,y,originX:x,originY:y,box:false};
      } else if(e.button===2) {
        e.preventDefault();this.moveSelected(x,y);
      } else if(this.selected.size&&!e.shiftKey) {
        this.moveSelected(x,y);
      } else {
        this.drag={x,y,originX:x,originY:y,box:true};
      }
      this.updateHud();
    } else if(this.drag){
      const d=this.drag;
      if(d.box&&Math.hypot(x-d.originX,y-d.originY)>12) {
        this.selected.clear();
        for(const u of this.units)if((u.kind==='hero'||u.kind==='troop')&&u.x>=Math.min(d.originX,x)&&u.x<=Math.max(d.originX,x)&&u.y>=Math.min(d.originY,y)&&u.y<=Math.max(d.originY,y))this.selected.add(u);
      } else if(!d.box&&Math.hypot(x-d.originX,y-d.originY)>12) this.moveSelected(x,y);
      this.drag=null;
      this.updateHud();
    }
  }
  moveSelected(x,y) {
    const units=[...this.selected].filter(u=>u.kind==='hero'||u.kind==='troop');
    units.forEach((u,i)=>u.target={x:x+(i%3-1)*24,y:y+(Math.floor(i/3)-.5)*24});
  }
  createHud() {
    this.hud=document.createElement('div');this.hud.className='combat-hud';
    this.hud.innerHTML='<div class="combat-hud-left"><button data-action="pause">Ⅱ Pause</button><button data-action="speed">1× Speed <kbd>G</kbd></button><button data-action="troops">Deploy Troops <kbd>R</kbd></button><span class="cooldown-text"></span><span class="objective-text"></span></div><div class="combat-hud-right"><button data-skill="0">Q · Arc</button><button data-skill="1">W · Mend</button><button data-skill="2">E · Bind</button><span class="combat-guide">Drag / click to move · Shift group · click tower to upgrade</span></div>';
    document.body.appendChild(this.hud);
    this.hud.onclick=e=>{
      const b=e.target.closest('button');if(!b)return;
      if(b.dataset.action==='pause')this.togglePause();
      if(b.dataset.action==='speed'){this.speed=this.speed===1?2:1;this.updateHud();}
      if(b.dataset.action==='troops')this.deployTroops();
      if(b.dataset.skill!==undefined)for(const u of this.selected)this.cast(u,+b.dataset.skill);
    };
    this.updateHud();
  }
  updateHud() {
    if(!this.hud)return;
    const pause=this.hud.querySelector('[data-action="pause"]');if(pause)pause.textContent=this.paused?'▶ Resume':'Ⅱ Pause';
    const speed=this.hud.querySelector('[data-action="speed"]');if(speed)speed.textContent=`${this.speed}× Speed`;
    const troops=this.hud.querySelector('[data-action="troops"]');if(troops)troops.disabled=this.troopCooldown>0;
    const cd=this.hud.querySelector('.cooldown-text');if(cd)cd.textContent=this.troopCooldown>0?`Reinforcements ${Math.ceil(this.troopCooldown)}s`:`Gold ${this.waveGold}${this.data.id===13&&this.stageIndex===5?` · Orb ${Math.floor(this.orbCharge)}%`:''}`;
    const objective=this.hud.querySelector('.objective-text');
    if(objective){
      if(this.data.id===3)objective.textContent=`Crystals ${this.anchors.filter(a=>a.charge>=100).length}/${this.anchors.length}`;
      else if(this.data.id===6&&this.stageIndex===4)objective.textContent=`Divinity drain ${Math.floor(this.drainCharge)}%`;
      else objective.textContent='';
    }
    this.hud.querySelectorAll('[data-skill]').forEach((b,i)=>b.disabled=this.selected.size===0||[...this.selected].every(u=>u.cooldown>0));
    this.canvas.classList.toggle('high-contrast',Boolean(this.save.settings.highContrast));
  }
  togglePause() {
    this.paused=!this.paused;this.updateHud();
  }
  deployTroops() {
    if(this.troopCooldown>0||this.waveGold<45)return;
    this.waveGold-=45;this.troopCooldown=18;
    const troops=this.data.troops||TROOP_ROSTERS[this.data.id]||['Vanguard Troop','Field Archer','Shield Guard'];
    for(let i=0;i<3;i++){
      const def=troops[i%troops.length];
      this.units.push(this.makeUnit({...(typeof def==='string'?{name:def}:def),hp:def.hp||68,color:def.color||['#85b6a2','#dfbd77','#82a9d8'][i],dark:'#35514b',role:'troop'},'troop',78,130+i*48));
    }
    this.audio.sfx('place');this.updateHud();
  }
  cast(unit,index) {
    if(unit.respawn>0||unit.cooldown>0)return;
    unit.cooldown= index===1?18:12;
    const radius= index===2?130:100;
    this.effects.push({kind:'ring',x:unit.x,y:unit.y,r:radius,max:radius,color:index===1?'#8cffb2':index===2?'#b197ff':'#8cf',life:.8});
    if(index===1) {
      this.units.filter(u=>u.kind!=='enemy'&&u.respawn<=0&&Math.hypot(u.x-unit.x,u.y-unit.y)<radius).forEach(u=>u.hp=Math.min(u.maxHp,u.hp+35));
      this.audio.sfx('heal');
    } else {
      this.enemies.forEach(e=>{if(Math.hypot(e.x-unit.x,e.y-unit.y)<radius){if(index===0){if(!(this.data.id===6&&this.stageIndex===4&&e.boss&&this.drainCharge<100))e.hp-=34+(unit.damage||0);}else e.bound=2.2;}});
      this.audio.sfx(index===0?'spell':'place');
    }
    this.updateHud();
  }
  spawnWave() {
    const stage=this.data.stages[this.stageIndex];
    const count=5+this.wave*2+(stage.difficulty||1);
    for(let i=0;i<count;i++){
      const enemy=(this.data.enemies||[{name:'Raider',hp:70,color:'#c44'}])[i%(this.data.enemies?.length||1)];
      this.enemies.push({...this.makeUnit({...enemy,kind:'enemy',speed:enemy.speed||35},'enemy',this.canvas.width-30,80+(i%7)*52),
        hp:(enemy.hp||70)*(1+this.wave*.08),maxHp:(enemy.hp||70)*(1+this.wave*.08),role:enemy.role||'shredder',
        attackCd:1.2+Math.random(),windup:0,telegraph:null,slow:0,bound:0,attackCount:0});
    }
    if(this.wave===4){
      const stageBoss=this.data.stages[this.stageIndex].boss;
      const names=stageBoss?[stageBoss]:STAGE_BOSSES[this.data.id]?.[this.stageIndex]||[FINAL_BOSSES[this.data.id]||`${this.data.title} Warlord`];
      names.forEach((name,i)=>{
        const hp=this.data.id===13&&this.stageIndex===5?1400:names.length>1?520:580+(stage.difficulty||1)*95;
        const boss={name,hp,color:'#e2a36f'};
        this.enemies.push({...this.makeUnit({...boss,speed:names.length>1?20:22},'enemy',this.canvas.width-55,this.canvas.height/(names.length+1)*(i+1)),
          hp,maxHp:hp,role:'cleaver',boss:true,bossPhase:1,attackCd:2+i*.35,windup:0,telegraph:null,slow:0,bound:0,attackCount:0});
      });
      this.audio.sfx('boss');
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
    this.elapsed+=dt;
    this.troopCooldown=Math.max(0,this.troopCooldown-dt);
    if(this.wave===0||this.enemies.length===0){
      this.waveTimer-=dt;
      if(this.waveTimer<=0&&this.wave<5){this.spawnWave();this.waveTimer=2.2;}
    }
    for(const u of this.units){
      if(u.respawn>0){u.respawn-=dt;if(u.respawn<=0){u.hp=u.maxHp;u.x=90;u.y=200;}continue;}
      u.slow=Math.max(0,(u.slow||0)-dt);
      u.cooldown=Math.max(0,u.cooldown-dt); u.attackCd=Math.max(0,u.attackCd-dt);
      u.passiveTimer=Math.max(0,(u.passiveTimer||0)-dt);u.attackAnim=Math.max(0,(u.attackAnim||0)-dt);
      if(u.kind==='hero'&&/healer|cleric|lifebinder/i.test(u.role)&&u.passiveTimer<=0){
        this.units.filter(ally=>ally.kind!=='enemy'&&ally.respawn<=0&&Math.hypot(ally.x-u.x,ally.y-u.y)<88).forEach(ally=>ally.hp=Math.min(ally.maxHp,ally.hp+5));
        u.passiveTimer=2.4;
      }
      if(u.target){const d=Math.hypot(u.target.x-u.x,u.target.y-u.y);if(d>5){const speed=u.speed*(u.slow>0 ? .55 : 1)*(this.data.id===11&&this.phase===3?1.25:1);u.x+=(u.target.x-u.x)/d*speed*dt;u.y+=(u.target.y-u.y)/d*speed*dt;}else u.target=null;}
      const foe=this.enemies.reduce((a,e)=>!a||Math.hypot(e.x-u.x,e.y-u.y)<Math.hypot(a.x-u.x,a.y-u.y)?e:a,null);
      if(foe&&Math.hypot(foe.x-u.x,foe.y-u.y)<u.range&&u.attackCd<=0){
        const drainLocked=this.data.id===6&&this.stageIndex===4&&foe.boss&&this.drainCharge<100;
        const phaseBonus=this.data.id===11&&this.phase===0?1.25:1;
        const frostBonus=this.data.id===5&&foe.slow>0?1.3:1;
        const damage=drainLocked?0:u.damage*phaseBonus*frostBonus,alive=foe.hp>0;foe.hp-=damage;u.attackCd=u.kind==='hero' ? .9 : 1.35;u.attackAnim=.22;
        this.effects.push({kind:u.range>130?'projectile':'slash',x:(foe.x+u.x)/2,y:(foe.y+u.y)/2,fromX:u.x,fromY:u.y,life:.2,color:u.color||'#fff'});
        if(alive&&foe.hp<=0){this.waveGold+=foe.boss?150:12;this.score=(this.score||0)+(foe.boss?1000:100);if(this.data.id===13)this.orbCharge=Math.min(100,this.orbCharge+15);}
      }
    }
    for(const e of this.enemies){
      e.attackCd=Math.max(0,(e.attackCd||0)-dt);
      e.slow=Math.max(0,(e.slow||0)-dt);e.bound=Math.max(0,(e.bound||0)-dt);
      if(e.hp<=0)continue;
      if(e.boss){
        const phase=e.hp/e.maxHp>.66?1:e.hp/e.maxHp>.33?2:3;
        if(phase!==e.bossPhase){e.bossPhase=phase;this.effects.push({kind:'ring',x:e.x,y:e.y,r:80,max:100,color:'#f2c56f',life:.8});}
      }
      const living=this.units.filter(u=>u.respawn<=0);
      let target=e.role==='diver'?living.filter(u=>u.role==='Healer'||u.role==='Mage'||u.role==='Ranger'||u.role==='Archer').sort((a,b)=>Math.hypot(a.x-e.x,a.y-e.y)-Math.hypot(b.x-e.x,b.y-e.y))[0]:null;
      if(!target)target=living.sort((a,b)=>Math.hypot(a.x-e.x,a.y-e.y)-Math.hypot(b.x-e.x,b.y-e.y))[0];
      if(target){
        const d=Math.hypot(target.x-e.x,target.y-e.y);
        const speed=e.bound>0?0:e.speed*(e.slow>0 ? .55 : 1);
        if(e.windup>0) {
          e.windup-=dt;
          if(e.windup<=0){
            const hitRadius=e.role==='cleaver'?82:48;
            this.units.filter(u=>u.respawn<=0&&Math.hypot(u.x-e.aimX,u.y-e.aimY)<hitRadius).forEach(u=>{const armor=Math.min(.75,(u.armor||0)+(this.data.id===11&&this.phase===2 ? .2 : 0));u.hp-=(e.boss?42+(e.bossPhase||1)*8:28)*(1-armor);u.target=null;});
            this.effects.push({kind:'impact',x:e.aimX,y:e.aimY,r:hitRadius,life:.35});
            e.telegraph=null;e.attackCd=e.boss?Math.max(1.25,2.5-(e.bossPhase||1)*.35):1.7;
          }
        } else if(d>32) {
          if(e.bound<=0){e.x+=(target.x-e.x)/d*speed*dt;e.y+=(target.y-e.y)/d*speed*dt;}
        } else if(e.attackCd<=0) {
          if(e.role==='cleaver'||e.role==='caster'||e.boss){
            e.aimX=target.x;e.aimY=target.y;e.windup=e.boss?1.5:1.25;e.telegraph=e.role==='cleaver'||e.boss?'circle':'line';
          } else {
            const armor=Math.min(.75,(target.armor||0)+(this.data.id===11&&this.phase===2 ? .2 : 0));
            const damage=e.role==='shredder'?17:11;target.hp-=damage*(1-armor);e.attackCd=e.role==='shredder' ? .6 : 1.05;this.audio.sfx('hurt');
          }
        }
      }
    }
    this.applyTowerAuras(dt);
    this.applyMechanics(dt);
    for(const u of this.units)if(u.hp<=0&&u.respawn<=0){if(u.kind==='hero')u.respawn=18;u.hp=0;}
    const lostTroops=this.units.filter(u=>u.kind==='troop'&&u.hp<=0);
    lostTroops.forEach(u=>this.selected.delete(u));
    this.units=this.units.filter(u=>u.kind!=='troop'||u.hp>0);
    const heroSquad=this.units.filter(u=>u.kind==='hero');
    if(heroSquad.length&&heroSquad.every(u=>u.hp<=0)){this.finish(false);return;}
    this.enemies=this.enemies.filter(e=>e.hp>0);
    this.effects.forEach(f=>f.life-=dt);this.effects=this.effects.filter(f=>f.life>0);
    this.updateHud();
    if(this.wave>=5&&this.enemies.length===0&&this.objectivesComplete())this.finish(true);
  }
  applyTowerAuras(dt) {
    for(const tower of this.towers){
      tower.auraTimer=(tower.auraTimer||0)-dt;if(tower.auraTimer>0)continue;
      tower.auraTimer=1;
      const radius=54+tower.tier*13;
      for(const unit of this.units){
        if(unit.kind==='enemy'||unit.respawn>0||Math.hypot(unit.x-tower.x,unit.y-tower.y)>radius)continue;
        if(/healing|apothecary|surgeon|sanctuary|beacon of dawn/i.test(tower.name))unit.hp=Math.min(unit.maxHp,unit.hp+4*tower.tier);
        if(/banner|beacon|conduit|pavilion|war-horn/i.test(tower.name))unit.attackCd=Math.max(0,unit.attackCd-.12*tower.tier);
      }
      for(const enemy of this.enemies){
        if(Math.hypot(enemy.x-tower.x,enemy.y-tower.y)>radius)continue;
        if(/snare|frost|net|stasis|gravity|binding|dampener|anchor|ward|hex|void-chalk/i.test(tower.name))enemy.slow=Math.max(enemy.slow||0,1.15+tower.tier*.25);
        if(/pit-trap|barricade|sonic|silence|bell/i.test(tower.name))enemy.bound=Math.max(enemy.bound||0,.25*tower.tier);
      }
    }
  }
  startWarning(kind,x,y,radius=105) {
    this.warning={kind,x,y,radius,delay:1.35,life:2.5,fired:false};
  }
  applyMechanics(dt) {
    if(this.warning){
      this.warning.life-=dt;
      if(!this.warning.fired){this.warning.delay-=dt;if(this.warning.delay<=0){this.resolveWarning(this.warning);this.warning.fired=true;}}
      if(this.warning.life<=0)this.warning=null;
    }
    if(this.data.id===2){
      this.nodeTimer-=dt;
      for(const node of this.nodes){
        const allies=this.units.filter(u=>u.kind!=='enemy'&&u.respawn<=0&&Math.hypot(u.x-node.x,u.y-node.y)<60).length;
        const foes=this.enemies.filter(e=>Math.hypot(e.x-node.x,e.y-node.y)<60).length;
        if(allies>foes)node.owner=Math.min(1,node.owner+dt*.22);
        else if(foes>allies)node.owner=Math.max(0,node.owner-dt*.24);
      }
      if(this.nodeTimer<=0){this.nodeTimer=1;for(const node of this.nodes)if(node.owner>.8)this.waveGold+=2;}
    }
    if(this.data.id===3){
      for(const anchor of this.anchors){
        const allies=this.units.filter(u=>u.kind!=='enemy'&&u.respawn<=0&&Math.hypot(u.x-anchor.x,u.y-anchor.y)<58).length;
        const foes=this.enemies.filter(e=>Math.hypot(e.x-anchor.x,e.y-anchor.y)<62).length;
        if(allies>0&&foes===0)anchor.charge=Math.min(100,anchor.charge+dt*(6+allies*2));
        else if(foes>0)anchor.charge=Math.max(0,anchor.charge-dt*3);
      }
    }
    if(this.data.id===6&&this.stageIndex===4&&this.drainCharge<100){
      const boss=this.enemies.find(e=>e.boss);
      if(boss){
        const mage=this.units.some(u=>u.kind==='hero'&&/mage/i.test(u.role)&&Math.hypot(u.x-boss.x,u.y-boss.y)<220);
        const linkedTower=this.towers.some(t=>Math.hypot(t.x-boss.x,t.y-boss.y)<280);
        if(mage&&linkedTower)this.drainCharge=Math.min(100,this.drainCharge+dt*10);
      }
    }
    if(this.data.id===4){
      this.phaseTimer-=dt;
      if(this.phaseTimer<=0){this.phaseTimer=18;this.phase=1-this.phase;this.startWarning('polarity',this.phase?740:220,270,120);}
      const zoneX=this.phase?740:220;
      for(const u of this.units)if(u.kind!=='enemy'&&u.respawn<=0&&Math.hypot(u.x-zoneX,u.y-270)<125){
        if(this.phase===0)u.hp=Math.min(u.maxHp,u.hp+dt*2);
        else u.hp=Math.max(1,u.hp-dt*1.5);
      }
    }
      if(this.data.id===11){
      this.phaseTimer-=dt;
        for(const unit of this.units)if(unit.kind!=='enemy'&&unit.respawn<=0&&this.phase===1)unit.hp=Math.min(unit.maxHp,unit.hp+dt*.45);
        if(this.phaseTimer<=0){this.phaseTimer=30;this.phase=(this.phase+1)%4;this.effects.push({kind:'ring',x:480,y:270,r:100,max:130,color:['#ff946f','#8feeff','#d7c6a2','#c6a0ff'][this.phase],life:.9});this.audio.sfx('spell');}
    }
    const kinds={1:'cataclysm',5:'frost',6:'anomaly',7:'blizzard',8:'stampede',9:'tide',10:'gust'};
    if(kinds[this.data.id]){
      this.mechanicTimer-=dt;
      if(this.mechanicTimer<=0){
        this.startWarning(kinds[this.data.id],180+Math.random()*600,115+Math.random()*310,this.data.id===8?80:105);
        this.mechanicTimer=this.data.id===1?35:this.data.id===7?24:this.data.id===8?18:this.data.id===9?20:16;
      }
    }
  }
  objectivesComplete() {
    if(this.data.id===3)return this.anchors.length>0&&this.anchors.every(anchor=>anchor.charge>=100);
    if(this.data.id===6&&this.stageIndex===4)return this.drainCharge>=100;
    return true;
  }
  resolveWarning(warning) {
    const near=unit=>Math.hypot(unit.x-warning.x,unit.y-warning.y)<warning.radius;
    if(warning.kind==='cataclysm'||warning.kind==='anomaly'){
      this.units.filter(near).forEach(u=>u.hp-=warning.kind==='anomaly'?24:30);
      if(warning.kind==='anomaly')this.enemies.filter(near).forEach(e=>e.hp-=25);
    }else if(warning.kind==='stampede'){
      this.units.filter(u=>Math.abs(u.y-warning.y)<38).forEach(u=>{u.hp-=34;u.target=null;u.x=Math.max(30,u.x-55);});
    }else if(warning.kind==='frost'||warning.kind==='blizzard'){
      this.enemies.filter(near).forEach(e=>e.slow=Math.max(e.slow||0,4));
      this.units.filter(u=>near(u)&&!this.towers.some(t=>/hearth|frost|bonfire/i.test(t.name)&&Math.hypot(u.x-t.x,u.y-t.y)<70)).forEach(u=>u.slow=3);
    }else if(warning.kind==='tide'){
      this.units.filter(u=>u.kind!=='enemy'&&near(u)&&!this.towers.some(t=>/bilge|pump|stability/i.test(t.name)&&Math.hypot(u.x-t.x,u.y-t.y)<70)).forEach(u=>u.slow=3);
    }else if(warning.kind==='gust'){
      this.units.filter(u=>u.kind!=='enemy'&&near(u)&&!this.towers.some(t=>/wind-break|anchor/i.test(t.name)&&Math.hypot(u.x-t.x,u.y-t.y)<70)).forEach(u=>{u.x=Math.max(30,u.x-70);u.target=null;});
    }else if(warning.kind==='polarity'){
      this.units.filter(u=>u.kind!=='enemy'&&near(u)).forEach(u=>u.hp=Math.min(u.maxHp,u.hp+30));
      this.enemies.filter(near).forEach(e=>e.slow=3);
    }
    this.effects.push({kind:'impact',x:warning.x,y:warning.y,r:warning.radius,life:.45});
  }
  async finish(win) {
    if(!this.running)return; this.running=false; this.audio.sfx(win?'victory':'boss');
    this.hud?.remove();this.hud=null;removeEventListener('keydown',this.keyHandler);
    const game=this.save.games[this.data.id];
    if(win){
      game.completedStages=[...new Set([...game.completedStages,this.stageIndex+1])];
      if(this.stageIndex+1<this.data.stages.length)game.unlockedStages=[...new Set([...(game.unlockedStages||[]),this.stageIndex+2])];
      game.bestScores[this.stageIndex+1]=Math.max(game.bestScores[this.stageIndex+1]||0,this.score||0);
      if(this.data.id===13){
        const flags=game.gameSpecificFlags||{};
        if(this.stageIndex===2)flags.fourCrystalsCharged=true;
        if(this.stageIndex===3)flags.orbsUnleashed=true;
        if(this.stageIndex===4)flags.harethelFreed=true;
        game.gameSpecificFlags=flags;
      }
      if(this.data.id===13&&this.stageIndex===this.data.stages.length-1){
        const ending=await this.chooseEnding();
        if(ending){
          game.endings=[...new Set([...(game.endings||[]),ending])];
          game.gameSpecificFlags={...(game.gameSpecificFlags||{}),apocalypseEndings:game.endings,orbCharge:this.orbCharge};
        }
      }
      game.unlockedCodexIds=[...new Set([...(game.unlockedCodexIds||[]),`game-${this.data.id}-stage-${this.stageIndex+1}`])];
      this.save.codexUnlocked=[...new Set([...(this.save.codexUnlocked||[]),'birth',`game-${this.data.id}-stage-${this.stageIndex+1}`])];
      writeSave(this.save);
    }
    const panel=document.createElement('div');panel.className='victory';
    panel.innerHTML=`<div><span class="result-kicker">${win?'MISSION REPORT':'SQUAD DEFEATED'}</span><h1>${win?'VICTORY':'DEFEAT'}</h1><p>${win?`${this.data.stages[this.stageIndex].name} has been secured.`:'The entire hero squad was lost. Rally and try a new formation.'}</p>${win?`<p class="scoreline">Squad score <strong>${this.score||0}</strong> · Salvaged gold <strong>${this.waveGold}</strong></p>`:''}${win&&this.data.id===13&&this.stageIndex===this.data.stages.length-1?`<p class="ending-summary">${this.endingText||'The Emergence awaits its next future.'}</p>`:''}<button class="primary again">${win&&this.stageIndex<this.data.stages.length-1?'Next Stage':'Replay Stage'}</button><a href="../../index.html">Return to Launcher</a></div>`;
    document.body.appendChild(panel);
    panel.querySelector('.again').onclick=()=>{panel.remove();if(win&&this.stageIndex<this.data.stages.length-1)this.stageIndex++;this.showBriefing();};
  }
  chooseEnding() {
    const endings=[
      {id:'A — Restoration',title:'Restoration',text:'Balance the four Crystals. The Wellspring returns and banishes the Harbinger.'},
      {id:'B — The Eternal Cycle',title:'The Eternal Cycle',text:'Overload both Orbs. The Emergence is consumed as Bloom and Void begin again.'},
      {id:'C — The Mentor’s Return',title:'The Mentor’s Return',text:'Channel pure Light through Harethel; her mentor, the living Wellspring, returns.'},
      {id:'D — The Unified Orb',title:'The Unified Orb',text:'Fuse Light and Dark. Harethel and the Twelve remain as guardians of the joined realms.'}
    ];
    return new Promise(resolve=>{
      const panel=document.createElement('div');panel.className='ending-chooser';
      panel.innerHTML='<div class="ending-panel"><span class="result-kicker">THE FINAL CHOICE</span><h1>What future will you leave?</h1><p>The One Entity has been split. Choose the fate of the Emergence.</p><div class="ending-options"></div></div>';
      const options=panel.querySelector('.ending-options');
      endings.forEach(ending=>{
        const button=document.createElement('button');button.className='ending-option';
        button.innerHTML=`<strong>${ending.id}</strong><span>${ending.text}</span>`;
        button.onclick=()=>{this.endingText=ending.text;panel.remove();resolve(ending.id);};
        options.appendChild(button);
      });
      document.body.appendChild(panel);
    });
  }
  draw() {
    const c=this.ctx,w=this.canvas.width,h=this.canvas.height; c.clearRect(0,0,w,h);
    const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,'#10172c');g.addColorStop(1,this.data.theme||'#182a38');c.fillStyle=g;c.fillRect(0,0,w,h);
    if(this.data.id===11){c.fillStyle=['#e34c2833','#36c3db33','#b4936433','#8c69e133'][this.phase];c.fillRect(0,0,w,h);}
    if(this.data.id===9){c.fillStyle='#248dc522';c.fillRect(0,this.phase?250:390,w,h);}
    c.save();
    c.strokeStyle='#d2eaff10';c.lineWidth=1;
    for(let x=0;x<w;x+=48){c.beginPath();c.moveTo(x,40);c.lineTo(x,h-25);c.stroke();}
    for(let y=40;y<h;y+=48){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
    const pads=this.data.stages[this.stageIndex].pads||[];
    pads.forEach((p,i)=>{
      c.fillStyle=this.towers[i]?'#f3d16f22':'#b9d8fa10';c.strokeStyle=this.towers[i]?'#f3d16f55':'#b9d8fa35';
      c.beginPath();c.roundRect(p[0]-24,p[1]-24,48,48,8);c.fill();c.stroke();
    });
    c.strokeStyle='#7edcff38';c.lineWidth=5;c.beginPath();c.moveTo(20,h*.5);c.bezierCurveTo(w*.25,h*.5,w*.35,h*.32,w*.52,h*.5);c.bezierCurveTo(w*.68,h*.7,w*.8,h*.5,w-20,h*.5);c.stroke();
    c.restore();
    c.fillStyle='#e7efff';c.font='700 13px Segoe UI,sans-serif';c.fillText(`${this.data.title.toUpperCase()}  ·  ${this.data.stages[this.stageIndex].name}`,18,23);
    c.fillStyle='#ffd47a';c.font='12px Segoe UI,sans-serif';c.fillText(`WAVE ${Math.min(this.wave+1,5)} / 5`,18,43);
    c.textAlign='right';c.fillText(`GOLD ${this.waveGold}   ·   ${this.speed}×`,w-18,23);c.textAlign='left';
    c.fillStyle='#b9c9e2';c.font='10px Segoe UI,sans-serif';c.fillText(this.signature,18,h-14);
    if(this.data.id===11){c.textAlign='center';c.fillStyle=['#ff946f','#8feeff','#d7c6a2','#c6a0ff'][this.phase];c.font='700 11px sans-serif';c.fillText(['FIRE FRONT','WATER FRONT','EARTH FRONT','AIR FRONT'][this.phase],w/2,24);c.textAlign='left';}
    if(this.data.id===13&&this.stageIndex===5){c.fillStyle='#211325';c.fillRect(w*.35,51,w*.3,5);c.fillStyle='#f1d785';c.fillRect(w*.35,51,w*.3*this.orbCharge/100,5);}
    for(const node of this.nodes||[]){c.save();c.fillStyle=node.owner>.8?'#f0d77b':'#8c72dd';c.globalAlpha=.5;c.beginPath();c.arc(node.x,node.y,29,0,Math.PI*2);c.fill();c.globalAlpha=1;c.strokeStyle='#fff9';c.stroke();c.fillStyle='#fff';c.font='9px sans-serif';c.textAlign='center';c.fillText(node.owner>.8?'VEIN HELD':'SIPHON NODE',node.x,node.y+40);c.restore();}
    for(const anchor of this.anchors||[]){
      c.save();c.globalAlpha=.5;c.fillStyle='#8c72dd';c.beginPath();c.arc(anchor.x,anchor.y,31,0,Math.PI*2);c.fill();c.globalAlpha=1;
      c.strokeStyle='#e8d8ff';c.lineWidth=3;c.beginPath();c.arc(anchor.x,anchor.y,25,-Math.PI/2,-Math.PI/2+Math.PI*2*anchor.charge/100);c.stroke();
      c.fillStyle='#fff';c.font='9px sans-serif';c.textAlign='center';c.fillText(`CRYSTAL ${anchor.id+1}`,anchor.x,anchor.y+42);c.restore();
    }
    if(this.data.id===6&&this.stageIndex===4){
      c.fillStyle='#211325';c.fillRect(w*.35,51,w*.3,5);c.fillStyle='#b784e8';c.fillRect(w*.35,51,w*.3*this.drainCharge/100,5);
      if(this.drainCharge<100){c.fillStyle='#f0e2ff';c.font='9px sans-serif';c.textAlign='center';c.fillText('LINK A DRAIN MAGE AND A TOWER TO GIMELAL',w*.5,68);c.textAlign='left';}
    }
    const boss=this.enemies.find(e=>e.boss);
    if(boss){c.fillStyle='#211325';c.fillRect(w*.27,34,w*.46,9);c.fillStyle='#db6b84';c.fillRect(w*.27,34,w*.46*(boss.hp/boss.maxHp),9);c.fillStyle='#fff';c.textAlign='center';c.fillText(boss.name,w*.5,29);c.textAlign='left';}
    for(const t of this.towers){
      c.globalAlpha=.18;c.fillStyle=t.color||'#67dfff';c.beginPath();c.arc(t.x,t.y,54+t.tier*13,0,Math.PI*2);c.fill();c.globalAlpha=1;
      drawUnit(c,t.sprite,t.x,t.y,34,0,0);
      c.fillStyle='#f9e3a0';c.font='10px sans-serif';c.textAlign='center';c.fillText(`T${t.tier}`,t.x,t.y+27);c.textAlign='left';
    }
    for(const u of this.units){
      if(u.respawn>0){c.fillStyle='#d7e3ff';c.font='11px sans-serif';c.fillText(`${u.name} · ${Math.ceil(u.respawn)}s`,u.x-29,211);continue;}
      const animationRow=u.hp/u.maxHp<.25?3:u.attackAnim>0?2:u.target?1:0;
      drawUnit(c,u.sprite,u.x,u.y,30,Math.floor(this.elapsed*8)%4,animationRow);
      c.fillStyle='#180c1d';c.fillRect(u.x-16,u.y-22,32,4);c.fillStyle='#66e0a3';c.fillRect(u.x-16,u.y-22,32*(u.hp/u.maxHp),4);
      if(this.selected.has(u)){c.strokeStyle='#ffe480';c.beginPath();c.arc(u.x,u.y,20,0,Math.PI*2);c.stroke();}
    }
    for(const e of this.enemies){
      if(e.windup>0&&e.telegraph){
        const pulse=1+Math.sin(this.elapsed*11)*.08;c.save();c.strokeStyle=this.save.settings.highContrast?'#fff':'#ff584f';c.fillStyle=this.save.settings.highContrast?'#fff2':'#ff393626';c.lineWidth=3;c.setLineDash([7,5]);
        c.beginPath();if(e.telegraph==='circle'){c.arc(e.aimX,e.aimY,82*pulse,0,Math.PI*2);}else{c.moveTo(e.x,e.y);c.lineTo(e.aimX,e.aimY);}c.fill();c.stroke();c.setLineDash([]);c.restore();
        c.fillStyle='#fff';c.font='bold 11px sans-serif';c.fillText(`DODGE · ${e.windup.toFixed(1)}s`,e.aimX-36,e.aimY-90);
      }
      if(e.bound>0){c.strokeStyle='#a98aff';c.beginPath();c.arc(e.x,e.y,20,0,Math.PI*2);c.stroke();}
      drawUnit(c,e.sprite,e.x,e.y,e.boss?58:32,Math.floor(this.elapsed*7)%4,e.windup>0?2:1);
      c.fillStyle='#26101d';c.fillRect(e.x-(e.boss?30:16),e.y-(e.boss?36:22),e.boss?60:32,4);
      c.fillStyle='#f16d69';c.fillRect(e.x-(e.boss?30:16),e.y-(e.boss?36:22),(e.boss?60:32)*(e.hp/e.maxHp),4);
    }
    if(this.warning&&!this.warning.fired){
      c.save();c.globalAlpha=.55+.35*Math.sin(this.elapsed*12);c.strokeStyle=this.save.settings.highContrast?'#fff':'#ff514b';c.fillStyle=this.save.settings.highContrast?'#fff2':'#ff453622';c.lineWidth=3;c.setLineDash([8,5]);
      c.beginPath();if(this.warning.kind==='stampede'){c.rect(25,this.warning.y-38,w-50,76);}else c.arc(this.warning.x,this.warning.y,this.warning.radius,0,Math.PI*2);c.fill();c.stroke();c.setLineDash([]);
      c.fillStyle='#fff';c.font='bold 11px sans-serif';c.textAlign='center';c.fillText(`${this.warning.kind.toUpperCase()} · ${this.warning.delay.toFixed(1)}s`,this.warning.x,this.warning.y-this.warning.radius-9);c.restore();c.textAlign='left';
    }
    for(const f of this.effects){
      c.save();c.globalAlpha=Math.min(1,f.life*2);
      if(f.kind==='ring'){c.strokeStyle=f.color;c.lineWidth=4;c.beginPath();c.arc(f.x,f.y,f.r+(1-f.life)*50,0,Math.PI*2);c.stroke();}
      if(f.kind==='hazard'){c.fillStyle='#ff493b77';c.beginPath();c.arc(f.x,f.y,35+Math.sin(this.elapsed*8)*8,0,Math.PI*2);c.fill();}
      if(f.kind==='impact'){c.strokeStyle='#fff';c.lineWidth=5;c.beginPath();c.arc(f.x,f.y,f.r*(1-f.life),0,Math.PI*2);c.stroke();}
      if(f.kind==='slash'){c.strokeStyle=f.color||'#fff';c.lineWidth=3;c.beginPath();c.moveTo(f.x-12,f.y-12);c.lineTo(f.x+12,f.y+12);c.stroke();}
      if(f.kind==='projectile'){c.strokeStyle=f.color||'#fff';c.lineWidth=3;c.beginPath();c.moveTo(f.fromX,f.fromY);c.lineTo(f.x,f.y);c.stroke();}
      c.restore();
    }
    if(this.drag?.box){c.strokeStyle='#f3d16f';c.setLineDash([5,4]);c.strokeRect(this.drag.originX,this.drag.originY,this.drag.x-this.drag.originX,this.drag.y-this.drag.originY);c.setLineDash([]);}
    if(this.paused){c.fillStyle='#050916aa';c.fillRect(0,0,w,h);c.fillStyle='#fff';c.textAlign='center';c.font='800 32px Segoe UI,sans-serif';c.fillText('TACTICAL PAUSE',w/2,h/2);c.font='14px Segoe UI,sans-serif';c.fillText('Space / Escape to resume',w/2,h/2+28);c.textAlign='left';}
  }
}
