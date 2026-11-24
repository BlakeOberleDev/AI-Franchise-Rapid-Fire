import { AudioEngine } from './audioEngine.js';
import { loadSave, writeSave } from './saveManager.js';

const REGION_COLORS=['#183e59','#54302b','#174b55','#3c4b35','#302440'];
const REGION_NAMES=['The Floating Crossroads','Cinder-Spire Ruins','Sunken Sky-Falls','Crag-Heart & Gale-Sanctum','The Fractured Depths'];

export class AdventureEngine {
  constructor(canvas,data) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.data=data;this.audio=new AudioEngine();
    this.signature=Object.values(data.mechanics||{}).find(value=>typeof value==='string')||'Explore the floating islands, solve the crystal puzzles, and recover the lost Orbs.';
    this.save=loadSave();this.party=data.party||[];
    const checkpoint=this.save.games[12].gameSpecificFlags?.rebirthCheckpoint;
    this.partyState=this.party.map((_,i)=>({hp:checkpoint?.partyHp?.[i]??100,maxHp:100,attackCd:0,down:0}));
    this.leader=0;this.keys={};this.x=130;this.y=270;this.destination=null;this.facing=1;this.region=0;
    this.crystals=[];this.orbs=false;this.enemies=[];this.scrolls=[];this.effects=[];this.elapsed=0;this.message='Follow the ancient scrolls. Find the first gate.';
    this.puzzle=null;
    this.interactTarget=null;this.attackCd=0;this.dashCd=0;this.skillCd=0;this.guardTimer=0;this.burns=[];this.paused=false;this.finished=false;
  }
  boot() {
    this.audio.init();this.audio.setVolumes(this.save.settings);this.audio.startMusic(7);this.resize();
    addEventListener('resize',()=>this.resize());
    this.keyDown=e=>{
      this.keys[e.key.toLowerCase()]=true;
      if(/^[1-4]$/.test(e.key)){this.leader=+e.key-1;this.message=`${this.party[this.leader].name} leads the party.`;}
      if(e.code==='KeyX'||e.code==='Enter')this.attack();
      if(e.code==='KeyZ')this.interact();
      if(e.code==='KeyC')this.useSkill();
      if(e.code==='Space'){e.preventDefault();this.dash();}
      if(e.code==='Escape')this.togglePause();
    };
    addEventListener('keydown',this.keyDown);
    addEventListener('keyup',e=>this.keys[e.key.toLowerCase()]=false);
    this.canvas.onpointerdown=e=>this.pointer(e);
    this.canvas.oncontextmenu=e=>e.preventDefault();
    this.makeHud();this.loadRegion(this.save.games[12].gameSpecificFlags?.rebirthCheckpoint?.region||0);requestAnimationFrame(t=>this.loop(t));
  }
  resize(){this.canvas.width=960;this.canvas.height=540;}
  makeHud(){
    this.hud=document.createElement('div');this.hud.className='adventure-hud';
    this.hud.innerHTML=`<div class="adventure-controls"><span class="adventure-objective"></span><span class="adventure-hint">${this.signature} · WASD move · X attack · C skill · Z interact · Space dash · 1–4 switch</span></div><div class="adventure-buttons"><button data-act="attack">⚔ Attack <kbd>X</kbd></button><button data-act="skill">Skill <kbd>C</kbd></button><button data-act="interact">◈ Interact <kbd>Z</kbd></button><button data-act="dash">Dash <kbd>Space</kbd></button><button data-act="pause">Ⅱ</button></div>`;
    document.body.appendChild(this.hud);
    this.hud.onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.act==='attack')this.attack();if(b.dataset.act==='skill')this.useSkill();if(b.dataset.act==='interact')this.interact();if(b.dataset.act==='dash')this.dash();if(b.dataset.act==='pause')this.togglePause();};
  }
  pointer(e){
    const r=this.canvas.getBoundingClientRect(),x=(e.clientX-r.left)*960/r.width,y=(e.clientY-r.top)*540/r.height;
    if(e.button===2){this.attack();return;}
    const foe=this.enemies.find(enemy=>Math.hypot(enemy.x-x,enemy.y-y)<28);
    if(foe){this.destination={x:foe.x,y:foe.y};this.targetEnemy=foe;}else this.destination={x,y};
  }
  loadRegion(i){
    this.region=i;this.x=105;this.y=270;this.destination=null;this.targetEnemy=null;this.skillCd=0;this.guardTimer=0;
    const source=this.data.regions[i],checkpoint=this.save.games[12].gameSpecificFlags?.rebirthCheckpoint;
    const saved=checkpoint?.region===i?checkpoint:null;this.enemies=[];
    if(!saved?.enemiesCleared){
      const total=i===0?3:5+i;
      for(let n=0;n<total;n++){
        const boss=n===total-1&&i>0;
        const hp=boss?480+i*130:58+i*12;
        this.enemies.push({x:430+(n*113)%450,y:105+(n*83)%330,hp,maxHp:hp,name:boss?['','Cinder Warden','Tide-Heart Guardian','Crag & Gale Sentinel','Void-Echo Sentinel'][i]:source.enemy,speed:boss?23:33+i*2,boss,bossType:i,attackCd:1.2+Math.random(),windup:0,aimX:0,aimY:0});
      }
    }
    this.crystals=(source.crystals||[]).map((crystal,n)=>({...crystal,active:Boolean(saved?.crystals?.[n]),index:n}));
    this.scrolls=(source.scrolls||[]).map((s,n)=>({...s,read:Boolean(saved?.scrolls?.[n])}));
    this.orbs=Boolean(saved?.orbs);
    this.puzzle=source.puzzle?this.createPuzzleState(source.puzzle,saved?.puzzle):null;
    this.message=i===0?(saved?.scrolls?.some(Boolean)?'Your scroll is recorded. Travel east through the open gate.':'Find a scroll and clear the Shades to open the eastern gate.'):`Defeat the ${source.enemy}, solve the region puzzle, and reach the gate.`;
    this.updateHud();
  }
  createPuzzleState(config,saved){
    const active=Array.isArray(saved?.active)?saved.active:config.points.map(()=>false);
    const orientations=Array.isArray(saved?.orientations)?saved.orientations:config.points.map(()=>0);
    return {config,active:config.type==='mirrors'?[]:active,orientations,sequenceProgress:Number.isInteger(saved?.sequenceProgress)?saved.sequenceProgress:0};
  }
  puzzleComplete(){
    if(!this.puzzle)return true;
    const {config,active,orientations,sequenceProgress}=this.puzzle;
    if(config.type==='mirrors')return orientations.every((value,index)=>value===config.target[index]);
    if(config.type==='sequence')return sequenceProgress===config.sequence.length;
    return active.length===config.points.length&&active.every(Boolean);
  }
  puzzleProgress(){
    if(!this.puzzle)return '';
    const {config,active,orientations,sequenceProgress}=this.puzzle;
    if(config.type==='mirrors')return `${orientations.filter((value,index)=>value===config.target[index]).length}/${config.target.length} mirrors aligned`;
    if(config.type==='sequence')return `${sequenceProgress}/${config.sequence.length} valves in sequence`;
    return `${active.filter(Boolean).length}/${active.length} marks activated`;
  }
  writeCheckpoint(){
    const game=this.save.games[12];
    game.gameSpecificFlags={...(game.gameSpecificFlags||{}),rebirthCheckpoint:{
      region:this.region,partyHp:this.partyState.map(s=>s.hp),crystals:this.crystals.map(c=>c.active),
      scrolls:this.scrolls.map(s=>s.read),puzzle:this.puzzle?{
        active:this.puzzle.active,orientations:this.puzzle.orientations,sequenceProgress:this.puzzle.sequenceProgress
      }:null,orbs:this.orbs,enemiesCleared:this.enemies.length===0
    }};
    writeSave(this.save);
  }
  updateHud(){
    if(!this.hud)return;
    const objective=this.hud.querySelector('.adventure-objective');
    const needed=(this.region===0?this.scrolls.some(s=>s.read):this.crystals.every(c=>c.active))&&this.puzzleComplete();
    const state=this.enemies.length?`${this.enemies.length} foes remain`:!this.puzzleComplete()?`${this.puzzle.config.title} · ${this.puzzleProgress()}`:this.region===4&&needed&&!this.orbs?'Search the glowing altar for both Orbs':needed?'Gate is open · move to the eastern arch':'Activate the glowing puzzle marks';
    objective.textContent=`${REGION_NAMES[this.region]}  ·  ${state}`;
    const skill=this.hud.querySelector('[data-act="skill"]');
    if(skill)skill.textContent=this.skillCd>0?`Skill ${Math.ceil(this.skillCd)}s`:`${['Blade Arc','Crystal Bolt','Shield Slam','Rapid Shot'][this.leader]} <kbd>C</kbd>`;
    this.canvas.classList.toggle('high-contrast',Boolean(this.save.settings.highContrast));
  }
  loop(t){
    const dt=Math.min(.033,((t-(this.last||t))/1000||0));this.last=t;this.elapsed+=dt;
    if(!this.paused&&!this.finished)this.update(dt);
    this.updateHud();this.draw();requestAnimationFrame(n=>this.loop(n));
  }
  update(dt){
    const p=this.partyState[this.leader];this.attackCd=Math.max(0,this.attackCd-dt);this.dashCd=Math.max(0,this.dashCd-dt);this.skillCd=Math.max(0,this.skillCd-dt);this.guardTimer=Math.max(0,this.guardTimer-dt);
    let dx=(this.keys.d||this.keys.arrowright?1:0)-(this.keys.a||this.keys.arrowleft?1:0);
    let dy=(this.keys.s||this.keys.arrowdown?1:0)-(this.keys.w||this.keys.arrowup?1:0);
    if(dx||dy)this.destination=null;
    if(!dx&&!dy&&this.destination&&Math.hypot(this.destination.x-this.x,this.destination.y-this.y)>8){dx=this.destination.x-this.x;dy=this.destination.y-this.y;}else if(this.destination)this.destination=null;
    const mag=Math.hypot(dx,dy)||1;
    if(dx||dy){this.x+=(dx/mag)*174*dt;this.y+=(dy/mag)*174*dt;this.facing=dx<0?-1:dx>0?1:this.facing;}
    this.x=Math.max(28,Math.min(932,this.x));this.y=Math.max(70,Math.min(500,this.y));
    for(let i=0;i<this.party.length;i++){
      const state=this.partyState[i];state.attackCd=Math.max(0,state.attackCd-dt);
      if(state.down>0){state.down-=dt;if(state.down<=0){state.hp=Math.ceil(state.maxHp*.55);this.message=`${this.party[i].name} rejoins the party.`;}continue;}
      if(i===this.leader)continue;
      const angle=(i/this.party.length)*Math.PI*2,tx=this.x-Math.cos(angle)*42,ty=this.y-Math.sin(angle)*34;
      if(!Number.isFinite(this.party[i].fx)){this.party[i].fx=tx;this.party[i].fy=ty;}
      this.party[i].fx+=(tx-this.party[i].fx)*Math.min(1,dt*4);this.party[i].fy+=(ty-this.party[i].fy)*Math.min(1,dt*4);
      const foe=this.nearestEnemy(this.party[i].fx,this.party[i].fy);
      if(foe&&Math.hypot(foe.x-this.party[i].fx,foe.y-this.party[i].fy)<(this.party[i].range?150:52)&&state.attackCd<=0){foe.hp-=this.party[i].range?13:18;state.attackCd=1.15;}
    }
    for(const enemy of this.enemies){
      enemy.attackCd=Math.max(0,enemy.attackCd-dt);
      const target=this.partyPosition(this.leader);
      const distance=Math.hypot(target.x-enemy.x,target.y-enemy.y);
      if(enemy.windup>0){enemy.windup-=dt;if(enemy.windup<=0){
        this.resolveEnemyStrike(enemy);
      }}else if(distance>34){enemy.x+=(target.x-enemy.x)/distance*enemy.speed*dt;enemy.y+=(target.y-enemy.y)/distance*enemy.speed*dt;}
      else if(enemy.attackCd<=0){
        if(enemy.boss&&enemy.bossType===4){
          enemy.x=Math.max(100,Math.min(850,target.x+(Math.random()>.5?150:-150)));
          enemy.y=Math.max(95,Math.min(450,target.y+(Math.random()>.5?100:-100)));
        }
        enemy.aimX=target.x;enemy.aimY=target.y;
        enemy.attackPattern=enemy.boss?['slam','surge','sweep','rift'][enemy.bossType-1]:'slam';
        enemy.hitRadius=enemy.boss?([92,122,50,82][enemy.bossType-1]):40;
        enemy.windup=enemy.boss?1.35:0.9;
      }
    }
    this.burns.forEach(b=>{b.life-=dt;b.tick-=dt;if(b.tick<=0){b.tick=.5;this.partyState.forEach((s,i)=>{const p=this.partyPosition(i);if(s.down<=0&&Math.hypot(p.x-b.x,p.y-b.y)<26)s.hp-=7;});}});
    this.burns=this.burns.filter(b=>b.life>0);
    const hadEnemies=this.enemies.length>0;
    this.enemies=this.enemies.filter(e=>e.hp>0);
    if(hadEnemies&&this.enemies.length===0)this.writeCheckpoint();
    this.partyState.forEach((s,i)=>{if(s.hp<=0&&s.down<=0){s.hp=0;s.down=10;this.message=`${this.party[i].name} is down. They will recover shortly.`;}});
    this.effects.forEach(f=>f.life-=dt);this.effects=this.effects.filter(f=>f.life>0);
    this.scrolls.forEach(s=>{if(Math.hypot(s.x-this.x,s.y-this.y)<24&&!s.read)this.message='Press Z to study the ancient scroll.';});
    if(this.puzzle&&!this.puzzleComplete()){
      const point=this.puzzle.config.points.find(p=>Math.hypot(p.x-this.x,p.y-this.y)<34);
      if(point)this.message=`Press Z: ${point.name} · ${this.puzzleProgress()}`;
    }
    this.crystals.forEach(c=>{if(Math.hypot(c.x-this.x,c.y-this.y)<30&&!c.active)this.message=`Press Z to attune the ${['Fire','Water','Earth','Air'][this.region-1]||'crystal'} crystal.`;});
    if(this.region===4&&this.crystals.every(c=>c.active)&&!this.orbs)this.message='The crystals answer. Search the glowing altar for the Light and Dark Orbs.';
    else if(this.canLeave()&&this.x>875&&Math.abs(this.y-270)<105)this.message='Press Z to travel through the gate.';
    this.updateHud();
  }
  partyPosition(i){
    if(i===this.leader)return{x:this.x,y:this.y};
    return{x:this.party[i].fx||this.x,y:this.party[i].fy||this.y};
  }
  nearestEnemy(x,y){return this.enemies.reduce((a,e)=>!a||Math.hypot(e.x-x,e.y-y)<Math.hypot(a.x-x,a.y-y)?e:a,null);}
  resolveEnemyStrike(enemy){
    const pattern=enemy.attackPattern||'slam';
    const radius=enemy.hitRadius;
    this.partyState.forEach((state,i)=>{
      if(state.down>0)return;
      const position=this.partyPosition(i);
      let hit=false;
      if(pattern==='sweep')hit=Math.abs(position.y-enemy.aimY)<36;
      else if(pattern==='surge')hit=Math.abs(position.x-enemy.aimX)<48;
      else hit=Math.hypot(position.x-enemy.aimX,position.y-enemy.aimY)<radius;
      if(!hit)return;
      const guarding=i===this.leader&&this.guardTimer>0;
      state.hp-=(enemy.boss?34:18)*(guarding ? .35 : 1);
      if(pattern==='surge'||pattern==='sweep'){
        const dx=position.x-enemy.aimX,dy=position.y-enemy.aimY,length=Math.hypot(dx,dy)||1;
        if(i===this.leader){this.x=Math.max(28,Math.min(932,this.x+dx/length*52));this.y=Math.max(70,Math.min(500,this.y+dy/length*52));}
        else{this.party[i].fx+=dx/length*52;this.party[i].fy+=dy/length*52;}
      }
    });
    this.effects.push({x:enemy.aimX,y:enemy.aimY,r:radius,life:.45,color:pattern==='surge'?'#65dce8':pattern==='rift'?'#bd79ff':'#ff736b',pattern});
    if(pattern==='slam'&&enemy.bossType===1)this.burns.push({x:enemy.aimX,y:enemy.aimY,life:3,tick:.5});
    enemy.attackCd=enemy.boss?2.2:1.5;
    enemy.windup=0;
  }
  useSkill(){
    if(this.finished||this.paused||this.skillCd>0)return;
    this.skillCd=8;
    const leader=this.leader,position=this.partyPosition(leader),near=this.enemies.filter(e=>Math.hypot(e.x-position.x,e.y-position.y)<115);
    if(leader===0){
      near.forEach(e=>e.hp-=92);
      this.effects.push({x:position.x,y:position.y,r:112,life:.55,color:'#ffb36b'});
      this.message=near.length?'Kael unleashes a sweeping blade arc.':'Kael cuts through empty air.';
      this.audio.sfx('sword');
    }else if(leader===1){
      const target=this.targetEnemy&&this.enemies.includes(this.targetEnemy)?this.targetEnemy:this.nearestEnemy(position.x+this.facing*45,position.y);
      if(target&&Math.hypot(target.x-position.x,target.y-position.y)<340){
        target.hp-=135;this.effects.push({x:target.x,y:target.y,r:36,life:.5,color:'#70d2ff',pattern:'projectile'});
        this.message='Lyra releases a crystal-charged bolt.';
      }else this.message='No enemy is within Lyra’s bolt range.';
      this.audio.sfx('spell');
    }else if(leader===2){
      near.forEach(e=>{e.hp-=75;const dx=e.x-position.x,dy=e.y-position.y,d=Math.hypot(dx,dy)||1;e.x+=dx/d*72;e.y+=dy/d*72;});
      this.guardTimer=2.5;
      this.effects.push({x:position.x,y:position.y,r:118,life:.65,color:'#d8bd8a'});
      this.message='Bram slams his shield down, guarding the party and pushing foes back.';
      this.audio.sfx('impact');
    }else{
      const targets=[...this.enemies].sort((a,b)=>Math.hypot(a.x-position.x,a.y-position.y)-Math.hypot(b.x-position.x,b.y-position.y)).slice(0,3);
      targets.forEach(e=>{e.hp-=78;this.effects.push({x:e.x,y:e.y,r:22,life:.42,color:'#9ee88c',pattern:'projectile'});});
      this.message='Wren looses three rapid shots at the nearest threats.';
      this.audio.sfx('bow');
    }
    this.updateHud();
  }
  attack(){
    if(this.finished||this.paused||this.attackCd>0)return;
    this.attackCd=this.party[this.leader].range ? .42 : .62;
    const p=this.partyPosition(this.leader),range=this.party[this.leader].range?190:70;
    let target=this.targetEnemy&&this.enemies.includes(this.targetEnemy)?this.targetEnemy:null;
    if(!target)target=this.nearestEnemy(p.x+this.facing*25,p.y);
    if(target&&Math.hypot(target.x-p.x,target.y-p.y)<range){
      target.hp-=this.party[this.leader].range?48:42;
      this.effects.push({x:target.x,y:target.y,r:15,life:.24,color:this.party[this.leader].color});
      this.audio.sfx(this.party[this.leader].range?'bow':'sword');
      if(target.hp<=0){this.message=target.boss?'Guardian defeated. The region puzzle is yours to solve.':'A Shattered Shade falls.';this.targetEnemy=null;}
    }else{
      this.audio.sfx('sword');this.effects.push({x:p.x+this.facing*44,y:p.y,r:34,life:.2,color:'#fff0c2'});
    }
  }
  dash(){
    if(this.dashCd>0||this.paused)return;
    this.dashCd=2.2;this.x=Math.max(28,Math.min(932,this.x+this.facing*105));this.audio.sfx('place');
    this.effects.push({x:this.x,y:this.y,r:46,life:.32,color:'#78e6ff'});
  }
  interact(){
    if(this.paused||this.finished)return;
    let handled=false;
    if(Math.hypot(92-this.x,270-this.y)<52){
      this.partyState.forEach(s=>{s.hp=s.maxHp;s.down=0;});handled=true;this.message='A campfire restores the whole party.';
      this.writeCheckpoint();this.audio.sfx('heal');
    }
    for(const s of this.scrolls)if(!s.read&&Math.hypot(s.x-this.x,s.y-this.y)<55){s.read=true;handled=true;this.message='Scroll recorded in the Codex. The old map points east.';this.save.codexUnlocked=[...new Set([...(this.save.codexUnlocked||[]),`rebirth-scroll-${this.region}-${this.scrolls.indexOf(s)}`])];this.writeCheckpoint();}
    if(this.puzzle&&!this.puzzleComplete()&&this.enemies.length===0){
      const index=this.puzzle.config.points.findIndex(point=>Math.hypot(point.x-this.x,point.y-this.y)<58);
      if(index>=0){handled=true;this.activatePuzzlePoint(index);}
    }
    for(const crystal of this.crystals)if(!crystal.active&&Math.hypot(crystal.x-this.x,crystal.y-this.y)<58&&this.enemies.length===0&&this.puzzleComplete()){
      crystal.active=true;handled=true;this.audio.sfx('spell');this.message='The Elemental Crystal awakens. Its light repairs the fractured sky.';
      this.effects.push({x:crystal.x,y:crystal.y,r:90,life:.8,color:'#9cf2ff'});
      this.writeCheckpoint();
    }
    if(this.region===4&&this.enemies.length===0&&this.crystals.every(c=>c.active)&&Math.hypot(700-this.x,270-this.y)<65&&!this.orbs){
      this.orbs=true;handled=true;this.message='The Light and Dark Orbs are found. Their power has entered the Codex.';
      this.audio.sfx('victory');this.effects.push({x:700,y:270,r:130,life:1,color:'#fff0a5'});
      this.save.games[12].gameSpecificFlags={...(this.save.games[12].gameSpecificFlags||{}),lightOrb:true,darkOrb:true};
      this.save.games[12].unlockedCodexIds=[...new Set([...(this.save.games[12].unlockedCodexIds||[]),'rebirth-orbs'])];
      this.save.codexUnlocked=[...new Set([...(this.save.codexUnlocked||[]),'rebirth-orbs'])];this.writeCheckpoint();
    }
    if(this.canLeave()&&this.x>850&&Math.abs(this.y-270)<110){
      handled=true;
      if(this.region<4){this.save.games[12].completedStages=[...new Set([...this.save.games[12].completedStages,this.region+1])];this.save.games[12].gameSpecificFlags={...(this.save.games[12].gameSpecificFlags||{}),crystals:[0,1,2,4,4][this.region]};writeSave(this.save);this.loadRegion(this.region+1);this.writeCheckpoint();}
      else if(this.orbs)this.finish();
    }
    if(!handled)this.message=this.enemies.length?'Defeat the region guardian before attempting the puzzle.':'Nothing else answers your call here.';
    this.updateHud();
  }
  activatePuzzlePoint(index){
    const puzzle=this.puzzle,config=puzzle.config,point=config.points[index];
    if(config.requiredLeader&&this.party[this.leader].name!==config.requiredLeader){
      this.message=`${config.requiredLeader} must activate the ${point.name}.`;
      return;
    }
    if(config.requiredLeaders?.[index]&&this.party[this.leader].name!==config.requiredLeaders[index]){
      this.message=`${config.requiredLeaders[index]} must attune the ${point.name}.`;
      return;
    }
    if(config.type==='mirrors'){
      puzzle.orientations[index]=(puzzle.orientations[index]+1)%4;
      this.message=`${point.name} turned to ${['north','east','south','west'][puzzle.orientations[index]]}.`;
    }else if(config.type==='sequence'){
      const expected=config.sequence[puzzle.sequenceProgress];
      if(index===expected){puzzle.sequenceProgress++;this.message=puzzle.sequenceProgress===config.sequence.length?'The water runs through every channel.':'The valve catches; another channel answers the flow.';}
      else{puzzle.sequenceProgress=0;this.message='The current surges backward. The valve sequence resets.';}
    }else{
      puzzle.active[index]=!puzzle.active[index];
      if(this.puzzleComplete())this.message=`${config.title} complete. The way ahead is restored.`;
      else this.message=`${point.name} ${puzzle.active[index]?'activated':'released'}.`;
    }
    this.effects.push({x:point.x,y:point.y,r:42,life:.45,color:'#a8eeff'});
    this.audio.sfx(this.puzzleComplete()?'victory':'spell');
    this.writeCheckpoint();this.updateHud();
  }
  canLeave(){
    if(this.enemies.length)return false;
    if(!this.puzzleComplete())return false;
    if(this.region===0)return this.scrolls.some(s=>s.read);
    if(this.region===4)return this.crystals.every(c=>c.active)&&this.orbs;
    return this.crystals.every(c=>c.active);
  }
  togglePause(){this.paused=!this.paused;}
  finish(){
    if(this.finished)return;this.finished=true;
    const state=this.save.games[12];state.completedStages=[...new Set([...state.completedStages,5])];
    state.gameSpecificFlags={crystals:4,lightOrb:true,darkOrb:true};state.unlockedCodexIds=[...new Set([...(state.unlockedCodexIds||[]),'rebirth-orbs'])];
    this.save.codexUnlocked=[...new Set([...(this.save.codexUnlocked||[]),'rebirth-orbs'])];writeSave(this.save);
    this.audio.sfx('victory');
    const panel=document.createElement('div');panel.className='victory';
    panel.innerHTML='<div><span class="result-kicker">AGE OF REBIRTH</span><h1>The Orbs Awaken</h1><p>The four adventurers uncovered the forgotten Light and Dark Orbs. The world has a chance to heal.</p><a href="../../index.html">Return to Launcher</a><button class="primary" onclick="location.reload()">Replay Rebirth</button></div>';
    document.body.appendChild(panel);
  }
  draw(){
    const c=this.ctx,w=960,h=540,region=this.region;c.clearRect(0,0,w,h);
    const bg=c.createLinearGradient(0,0,w,h);bg.addColorStop(0,REGION_COLORS[region]);bg.addColorStop(1,['#377796','#9a4c30','#226c77','#7c8354','#61417b'][region]);c.fillStyle=bg;c.fillRect(0,0,w,h);
    c.save();c.globalAlpha=.16;c.fillStyle='#b8efff';
    for(let i=0;i<8;i++){const x=((i*147+this.elapsed*(i%2?7:-4))%1120)-70,y=95+(i*87)%345;c.beginPath();c.ellipse(x,y,60+(i%3)*20,15+(i%3)*7,0,0,Math.PI*2);c.fill();}
    c.restore();
    c.fillStyle='#0a1a2b88';c.beginPath();c.roundRect(16,54,928,438,25);c.fill();
    c.strokeStyle='#c9e6ff24';c.lineWidth=2;c.stroke();
    c.save();c.shadowColor='#ffbd68';c.shadowBlur=18;c.fillStyle='#ffae55';c.beginPath();c.arc(92,270,9+Math.sin(this.elapsed*6)*2,0,Math.PI*2);c.fill();c.restore();
    c.fillStyle='#fff0c1';c.font='9px sans-serif';c.fillText('CAMPFIRE',69,300);
    c.strokeStyle='#c5efff32';c.setLineDash([8,12]);c.beginPath();c.moveTo(55,270);c.bezierCurveTo(280,235,450,330,680,255);c.lineTo(908,270);c.stroke();c.setLineDash([]);
    c.fillStyle='#fff';c.font='700 14px Segoe UI,sans-serif';c.fillText(REGION_NAMES[region].toUpperCase(),24,28);
    c.fillStyle='#c1d7ec';c.font='12px Segoe UI,sans-serif';c.fillText(this.message,24,46);
    this.scrolls.forEach(s=>{c.save();c.translate(s.x,s.y);c.rotate(-.16);c.fillStyle=s.read?'#82909b':'#f3d48f';c.fillRect(-8,-13,16,26);c.fillStyle='#795c37';c.fillRect(-5,-7,10,2);c.fillRect(-5,0,8,2);c.restore();});
    if(this.puzzle){
      c.save();c.globalAlpha=.35;c.strokeStyle='#c2edff';c.lineWidth=3;
      if(this.puzzle.config.type==='mirrors'){
        c.beginPath();c.moveTo(this.puzzle.config.points[0].x,this.puzzle.config.points[0].y);c.lineTo(this.puzzle.config.points[1].x,this.puzzle.config.points[1].y);c.stroke();
      }
      this.puzzle.config.points.forEach((point,index)=>{
        const orientation=this.puzzle.orientations[index]||0;
        const active=this.puzzle.config.type==='mirrors'?orientation===this.puzzle.config.target[index]:this.puzzle.config.type==='sequence'?this.puzzle.config.sequence.slice(0,this.puzzle.sequenceProgress).includes(index):this.puzzle.active[index];
        c.globalAlpha=active?1:.72;c.fillStyle=active?'#74e6bd':'#8095ba';c.strokeStyle=active?'#c4ffe7':'#d7e9ff';
        c.beginPath();
        if(this.puzzle.config.type==='plates')c.roundRect(point.x-22,point.y-14,44,28,5);
        else if(this.puzzle.config.type==='sequence'){c.arc(point.x,point.y,19,0,Math.PI*2);}
        else if(this.puzzle.config.type==='switches'||this.puzzle.config.type==='attunement'){c.roundRect(point.x-17,point.y-22,34,44,5);}
        else{c.moveTo(point.x,point.y-22);c.lineTo(point.x+19,point.y);c.lineTo(point.x,point.y+22);c.lineTo(point.x-19,point.y);c.closePath();}
        c.fill();c.stroke();
        if(this.puzzle.config.type==='mirrors'){
          const a=orientation*Math.PI/2;c.strokeStyle='#fff';c.lineWidth=4;c.beginPath();c.moveTo(point.x-Math.cos(a)*12,point.y-Math.sin(a)*12);c.lineTo(point.x+Math.cos(a)*12,point.y+Math.sin(a)*12);c.stroke();
        }
        c.fillStyle='#fff';c.font='10px sans-serif';c.textAlign='center';c.fillText(point.name,point.x,point.y+34);
      });
      c.restore();
    }
    this.crystals.forEach((crystal,i)=>{
      const color=['#ff9165','#62dfff','#b7d77c','#d2a8ff'][Math.max(0,region-1)%4];
      c.save();c.globalAlpha=crystal.active ? .55 : 1;c.shadowColor=color;c.shadowBlur=crystal.active?18:28;
      c.fillStyle=color;c.beginPath();c.moveTo(crystal.x,crystal.y-25);c.lineTo(crystal.x+16,crystal.y);c.lineTo(crystal.x,crystal.y+25);c.lineTo(crystal.x-16,crystal.y);c.closePath();c.fill();
      c.strokeStyle='#fff';c.lineWidth=2;c.stroke();c.restore();
      if(!crystal.active){c.fillStyle='#fff';c.font='10px sans-serif';c.textAlign='center';c.fillText('Z · ATTUNE',crystal.x,crystal.y+42);}
    });
    if(region===4){c.save();c.shadowColor='#fff0ad';c.shadowBlur=24;c.strokeStyle='#fff0ad';c.lineWidth=3;c.beginPath();c.arc(700,270,24+Math.sin(this.elapsed*3)*3,0,Math.PI*2);c.stroke();c.fillStyle='#ffe9a8';c.font='10px sans-serif';c.textAlign='center';c.fillText(this.orbs?'ORBS RESTORED':'Z · SEARCH THE DEPTHS',700,311);c.restore();}
    if(this.canLeave()){c.save();c.shadowColor='#a4f5ff';c.shadowBlur=24;c.strokeStyle='#9eefff';c.lineWidth=5;c.beginPath();c.ellipse(908,270,18,65,0,0,Math.PI*2);c.stroke();c.restore();c.fillStyle='#fff';c.font='10px sans-serif';c.fillText('GATE',888,351);}
    this.enemies.forEach(e=>{
      if(e.windup>0){c.strokeStyle='#ff625a';c.fillStyle='#fa443329';c.lineWidth=3;c.beginPath();
        if(e.attackPattern==='sweep')c.rect(30,e.aimY-36,900,72);
        else if(e.attackPattern==='surge')c.rect(e.aimX-48,60,96,430);
        else c.arc(e.aimX,e.aimY,e.hitRadius,0,Math.PI*2);
        c.fill();c.stroke();c.fillStyle='#fff';c.font='bold 10px sans-serif';c.fillText(`DODGE · ${e.windup.toFixed(1)}`,e.aimX-35,e.aimY-e.hitRadius-8);}
      c.fillStyle=e.boss?['#cf6c8c','#49b8cc','#a9a078','#b47bf0'][e.bossType-1]||'#cf6c8c':'#a34c5b';c.beginPath();c.arc(e.x,e.y,e.boss?28:17,0,Math.PI*2);c.fill();
      c.strokeStyle='#ffc9cd';c.lineWidth=2;c.stroke();
      c.fillStyle='#1b101c';c.fillRect(e.x-(e.boss?34:21),e.y-(e.boss?40:27),e.boss?68:42,5);
      c.fillStyle='#f16f7e';c.fillRect(e.x-(e.boss?34:21),e.y-(e.boss?40:27),(e.boss?68:42)*Math.max(0,e.hp/e.maxHp),5);
      c.fillStyle='#f7e6ea';c.font='10px sans-serif';c.textAlign='center';c.fillText(e.name,e.x,e.y-(e.boss?46:32));
    });
    this.burns.forEach(b=>{c.save();c.globalAlpha=.6+.2*Math.sin(this.elapsed*8);c.fillStyle='#ff713b';c.beginPath();c.arc(b.x,b.y,25,0,Math.PI*2);c.fill();c.restore();});
    for(const f of this.effects){c.save();c.globalAlpha=Math.min(1,f.life*2);c.strokeStyle=f.color;c.lineWidth=4;c.beginPath();c.arc(f.x,f.y,f.r*(1-f.life)+8,0,Math.PI*2);c.stroke();c.restore();}
    this.party.forEach((member,i)=>{
      const pos=this.partyPosition(i),state=this.partyState[i];if(state.down>0){c.fillStyle='#e2dbe4';c.font='10px sans-serif';c.fillText(`${member.name} recovering`,pos.x-30,pos.y-22);return;}
      c.save();c.fillStyle='rgba(0,0,0,.4)';c.beginPath();c.ellipse(pos.x,pos.y+13,17,7,0,0,Math.PI*2);c.fill();
      c.fillStyle=member.color;c.beginPath();c.arc(pos.x,pos.y,14,0,Math.PI*2);c.fill();c.strokeStyle=i===this.leader?'#fff1a8':'#ffffff88';c.lineWidth=i===this.leader?3:1;c.stroke();
      c.fillStyle='#fff';c.font='10px sans-serif';c.textAlign='center';c.fillText(member.name,pos.x,pos.y-22);
      c.fillStyle='#321b2a';c.fillRect(pos.x-17,pos.y+19,34,4);c.fillStyle='#76e3a8';c.fillRect(pos.x-17,pos.y+19,34*Math.max(0,state.hp/state.maxHp),4);c.restore();
    });
    c.textAlign='left';if(this.paused){c.fillStyle='#050916bb';c.fillRect(0,0,w,h);c.fillStyle='#fff';c.textAlign='center';c.font='800 32px sans-serif';c.fillText('JOURNEY PAUSED',w/2,h/2);c.textAlign='left';}
  }
}
