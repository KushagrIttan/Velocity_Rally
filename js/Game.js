import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Vehicle } from './Vehicle.js';
import { Track } from './Track.js';
import { AudioEngine } from './AudioEngine.js';
import { Camera } from './Camera.js';
import { HUD } from './HUD.js';
import { InputHandler } from './InputHandler.js';
import { DustSystem } from './Effects.js';
import { GamepadManager } from './Gamepad.js';
import { RallySimulation, FixedClock } from './Simulation.js';
import { Progress } from './Progress.js';
import { Ghost, appendInput, unpackInput } from './Ghost.js';
import { STAGES, CARS, LIVERIES, RULES_VERSION, MEDAL_NAMES, getStage, utcDay } from './Stages.js';
const $=id=>document.getElementById(id);
const _DAY=new THREE.Color(0xfff1dd),_SET=new THREE.Color(0xff9a4d),_NIGHT=new THREE.Color(0x91a8ff),_FOGDAY=new THREE.Color(0xbfd4e2),_FOGSET=new THREE.Color(0xe0aa7e),_FOGNIGHT=new THREE.Color(0x0a1024);

export class Game {
    constructor() {
        this.progress=new Progress();this.settings=this.progress.data.settings;
        this.scene=new THREE.Scene();this.scene.fog=new THREE.FogExp2(0xbfd4e2,.0028);
        this.camera=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,.1,8000);
        this.renderer=new THREE.WebGLRenderer({canvas:$('game-canvas'),antialias:true});
        this.renderer.setSize(innerWidth,innerHeight);this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1;
        this._setupSkyAndLights();this.audio=new AudioEngine();this.audio.setVolume(this.settings.volume);
        this.vehicle=new Vehicle(this.scene);this.cameraController=new Camera(this.camera,this.vehicle);this.dust=new DustSystem(this.scene);
        this.hud=new HUD();this.input=new InputHandler();this.gamepad=new GamepadManager(m=>this.hud.setPadStatus(m));this.ghost=new Ghost(this.scene);this.rival=new Ghost(this.scene,0x81d6dd);
        this.fixed=new FixedClock();this.state='MENU';this.viewMode='CHASE';this.clock=0;this.maxDist=0;this.lastFrame=null;this.loadingStage=false;this.mode='campaign';this.stageId='fern';this.carId='scout';this.friend=null;this.boardRequest=0;this.pendingReset=false;
        const query=new URLSearchParams(location.search);const requested=query.get('stage');
        if(requested){try{getStage(requested);if(requested.startsWith('daily-')||this.progress.unlocked(requested)){this.stageId=requested;this.mode=requested.startsWith('daily-')?'daily':requested==='school'?'school':'campaign';}}catch{}}
        if(CARS.some(c=>c.id===query.get('car')))this.carId=query.get('car');
        if(this.stageId.startsWith('daily-'))this.carId='comet';
        this._setupComposer();this.applyQuality();this.initEvents();this.refreshMenu();this.loadStage(this.stageId);this.animate();
        if(query.get('ghost'))this.loadSharedGhost(query.get('ghost'));
    }
    initEvents() {
        window.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;if(['BUTTON','SUMMARY'].includes(e.target.tagName)&&['Enter','Space'].includes(e.code))return;this.input.onKeyDown(e);});
        window.addEventListener('keyup',e=>this.input.onKeyUp(e));
        document.addEventListener('focusin',e=>{
            const modal=this.state==='PAUSED'?$('pause-menu'):this.state==='FINISHED'?$('results-screen'):null;
            if(modal&&!modal.contains(e.target))(this.state==='PAUSED'?$('resume-button'):$('retry-result')).focus();
        });
        const away=()=>{this.input.clear();if(['RACING','COUNTDOWN'].includes(this.state))this.pause();};
        window.addEventListener('blur',away);document.addEventListener('visibilitychange',()=>{if(document.hidden)away();this.lastFrame=null;this.fixed.reset();});
        window.addEventListener('resize',()=>{this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);this.composer?.setSize(innerWidth,innerHeight);});
        const bind=(id,fn)=>$(id).addEventListener('click',fn);
        bind('race-button',()=>this.start());bind('campaign-tab',()=>this.setMode('campaign'));bind('daily-tab',()=>this.setMode('daily'));bind('school-tab',()=>this.setMode('school'));
        bind('pause-button',()=>this.pause());bind('resume-button',()=>this.resume());bind('recover-button',()=>{this.pendingReset=true;this.resume();});
        for(const id of ['retry-pause','retry-result'])bind(id,()=>this.restart());
        for(const id of ['menu-pause','menu-result'])bind(id,()=>this.menu());
        bind('next-result',()=>this.nextStage());bind('refresh-board',()=>this.refreshBoard());bind('submit-run',()=>this.submitRun());bind('share-button',()=>this.share());bind('clear-friend',()=>{this.friend=null;this.rival.load();$('friend-status').hidden=true;$('clear-friend').hidden=true;});
        $('stage-list').addEventListener('click',e=>{const b=e.target.closest('[data-stage]');if(b&&!b.disabled){this.stageId=b.dataset.stage;this.friend=null;this.rival.load();$('friend-status').hidden=true;$('clear-friend').hidden=true;this.loadStage(this.stageId);this.refreshMenu();}});
        $('car-list').addEventListener('click',e=>{const b=e.target.closest('[data-car]');if(b&&!b.disabled){this.carId=b.dataset.car;this.refreshMenu();this.sim=new RallySimulation(this.track.course,this.carId);this.vehicle.sync(this.sim);this.refreshBoard();}});
        $('livery-select').addEventListener('change',e=>{const l=LIVERIES.find(l=>l.id===e.target.value);if(l&&this.progress.points>=l.points){this.progress.data.livery=l.id;this.progress.save();this.applyLivery();}});
        $('volume').value=this.settings.volume*100;$('quality').value=this.settings.quality;$('ghost-toggle').checked=this.settings.ghost;$('voice-toggle').checked=this.settings.voice;
        $('volume').addEventListener('input',e=>{this.settings.volume=Number(e.target.value)/100;this.audio.setVolume(this.settings.volume);this.progress.save();});
        $('quality').addEventListener('change',e=>{this.settings.quality=e.target.value;this.applyQuality();this.progress.save();});
        $('ghost-toggle').addEventListener('change',e=>{this.settings.ghost=e.target.checked;this.progress.save();});
        $('voice-toggle').addEventListener('change',e=>{this.settings.voice=e.target.checked;this.progress.save();if(!e.target.checked)window.speechSynthesis?.cancel();});
        for(const b of document.querySelectorAll('[data-drive]')){
            b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);this.input.touch[b.dataset.drive]=true;b.classList.add('pressed');});
            for(const type of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,()=>{this.input.touch[b.dataset.drive]=false;b.classList.remove('pressed');});
        }
    }
    applyQuality() {
        const q=this.settings.quality;const pixel=q==='low'?1:q==='medium'?1.25:Math.min(devicePixelRatio,2);
        this.renderer.setPixelRatio(pixel);this.renderer.shadowMap.enabled=q!=='low';this.composer?.setPixelRatio(pixel);
        this.sun.shadow.mapSize.set(q==='high'?2048:1024,q==='high'?2048:1024);
        if(this.sun.shadow.map){this.sun.shadow.map.dispose();this.sun.shadow.map=null;}
    }
    applyLivery(){const l=LIVERIES.find(l=>l.id===this.progress.data.livery&&l.points<=this.progress.points)||LIVERIES[0];this.vehicle.setLivery(l.color);}
    setMode(mode) {
        this.mode=mode;this.friend=null;this.rival.load();$('friend-status').hidden=true;$('clear-friend').hidden=true;
        if(mode==='daily'){this.stageId='daily-'+utcDay();this.carId='comet';}else if(mode==='school')this.stageId='school';else this.stageId='fern';
        this.refreshMenu();this.loadStage(this.stageId);
    }
    refreshMenu() {
        const stage=getStage(this.stageId),car=CARS.find(c=>c.id===this.carId);
        for(const mode of ['campaign','daily','school'])$(mode+'-tab').classList.toggle('active',this.mode===mode);
        $('campaign-points').textContent=this.progress.points+' / 12';$('progress-summary').textContent=STAGES.filter(s=>s.id!=='school'&&this.progress.medal(s.id)>0).length+' / 4 roads mastered';
        const stages=this.mode==='daily'?[stage]:this.mode==='school'?[STAGES[0]]:STAGES.slice(1);
        $('stage-list').replaceChildren(...stages.map((s,i)=>{const b=document.createElement('button');b.className='stage-card'+(s.id===this.stageId?' selected':'');b.dataset.stage=s.id;b.disabled=!s.daily&&!this.progress.unlocked(s.id);b.setAttribute('aria-pressed',String(s.id===this.stageId));
            const n=document.createElement('span');n.className='stage-number';n.textContent=s.daily?'D':String(i+1).padStart(2,'0');const info=document.createElement('span');info.className='stage-info';const name=document.createElement('strong');name.textContent=s.name;const sub=document.createElement('small');sub.textContent=s.difficulty+' · '+Math.round(s.blocks.reduce((n,b)=>n+b[0],0)/100)/10+' km · '+s.subtitle;info.append(name,sub);const medal=document.createElement('span');medal.className='stage-medal';medal.textContent=b.disabled?'Locked':this.progress.medal(s.id)?MEDAL_NAMES[this.progress.medal(s.id)]:'→';b.append(n,info,medal);return b;}));
        $('car-list').replaceChildren(...CARS.map(c=>{const b=document.createElement('button');b.className='car-card'+(c.id===this.carId?' selected':'');b.dataset.car=c.id;b.disabled=!!stage.daily&&c.id!==stage.car;b.setAttribute('aria-pressed',String(c.id===this.carId));b.append(document.createTextNode(c.name));const small=document.createElement('small');small.textContent=c.tag;b.append(small);return b;}));
        $('livery-select').replaceChildren(...LIVERIES.map(l=>{const o=document.createElement('option');o.value=l.id;o.textContent=l.name+(l.points>this.progress.points?' · '+l.points+' medal points':'');o.disabled=l.points>this.progress.points;o.selected=l.id===this.progress.data.livery;return o;}));
        $('preview-region').textContent=stage.region;$('preview-name').textContent=stage.name;$('preview-desc').textContent=car.description;
        $('medal-targets').replaceChildren(...['Gold','Silver','Bronze'].map((name,i)=>{const s=document.createElement('span');s.textContent=name;const strong=document.createElement('strong');strong.textContent=HUD.fmt(stage.medals[i]*1000);s.append(strong);return s;}));
        const best=this.progress.best(stage.id,car.id);$('preview-best').textContent=best?'Your best · '+HUD.fmt(best.time*1000)+' · '+car.name:'A fresh road. Set your first time.';
        $('mode-description').textContent=this.mode==='daily'?'A new course every day at 00:00 UTC. Everyone drives the Comet with the same road and conditions.':this.mode==='school'?'Practice braking before the bend, coast through the turn, then accelerate out.': 'Earn bronze to open the next road. Medals unlock liveries; your skill sets the pace.';
        $('storage-status').textContent=this.progress.available?'Progress and your best ghost save on this device.':'Device storage unavailable. Progress lasts for this session.';
        $('race-button').textContent=this.loadingStage?'Building stage…':'Drive '+stage.name;$('race-button').disabled=this.loadingStage;
        $('build-version').textContent=RULES_VERSION;this.applyLivery();
    }
    async loadStage(id) {
        this.loadingStage=true;this.refreshMenu();$('loading').hidden=false;
        await new Promise(resolve=>requestAnimationFrame(resolve));
        if(id!==this.stageId)return;
        this.track?.dispose();this.track=new Track(this.scene,id);this.sim=new RallySimulation(this.track.course,this.carId);this.vehicle.sync(this.sim);this.vehicle.headlightsOn=this.track.course.definition.timeOfDay>.7;
        this.camera.position.copy(this.vehicle.position).add(new THREE.Vector3(0,3,-7));this.cameraController.update(.1,this.viewMode);
        this.maxDist=0;this.loadingStage=false;this.fixed.reset();this.lastFrame=null;$('loading').hidden=true;this.refreshMenu();this.refreshBoard();
    }
    start() {
        if(this.loadingStage||!['MENU','FINISHED','PAUSED'].includes(this.state))return;
        this.sim=new RallySimulation(this.track.course,this.carId);this.vehicle.sync(this.sim);this.input.clear();this.pendingReset=false;this.countdown=3;this.lastCount=0;this.clock=0;this.maxDist=0;this.lastImpact=-10;this.paceTimer=0;this.lastCorner=null;this.runs=[];this.frames=[this.sim.snapshot()];this.bestRecord=this.progress.best(this.stageId,this.carId);this.ghost.load(this.bestRecord?.frames);this.rival.load(this.friend?.frames);this.result=null;this.submitted=null;this.fixed.reset();this.lastFrame=null;
        this.dust.clear();this.state='COUNTDOWN';$('race-ui').inert=false;$('game-canvas').focus();$('main-menu').hidden=true;$('pause-menu').hidden=true;$('results-screen').hidden=true;$('race-ui').hidden=false;$('race-stage').textContent=this.track.course.definition.name;$('race-car').textContent=CARS.find(c=>c.id===this.carId).name+(this.track.course.definition.daily?' · DAILY CHALLENGE':'');
        $('race-tip').textContent=this.stageId==='school'?'W / ↑ accelerate · S / ↓ brake · release the throttle through the bend':'Brake before the bend. T retries · R recovers (+5s)';
        this.audio.init();this.audio.resume();this.audio.setMuted(false);this.audio.setVolume(this.settings.volume);this.hud.setCountdown('3');this.audio.beep(440,.12);this.updateHUD();
    }
    restart(){this.state='MENU';this.start();}
    pause(){if(!['RACING','COUNTDOWN'].includes(this.state))return;this.resumeState=this.state;this.state='PAUSED';this.input.clear();this.fixed.reset();$('pause-menu').hidden=false;$('race-ui').inert=true;$('resume-button').focus();this.audio.setMuted(true);window.speechSynthesis?.cancel();}
    resume(){if(this.state!=='PAUSED')return;this.state=this.resumeState||'RACING';this.input.clear();this.fixed.reset();this.lastFrame=null;$('pause-menu').hidden=true;$('race-ui').inert=false;$('game-canvas').focus();this.audio.resume();this.audio.setMuted(false);}
    menu(){this.state='MENU';this.input.clear();this.fixed.reset();this.audio.setMuted(true);window.speechSynthesis?.cancel();this.hud.setCountdown(null);this.hud.showCorner(null);this.ghost.group.visible=false;this.rival.group.visible=false;$('pause-menu').hidden=true;$('results-screen').hidden=true;$('race-ui').hidden=true;$('main-menu').hidden=false;$('race-button').focus();this.refreshMenu();this.refreshBoard();}
    nextStage(){const index=STAGES.findIndex(s=>s.id===this.stageId),next=STAGES[index+1];if(next&&this.progress.unlocked(next.id)){this.menu();this.mode='campaign';this.stageId=next.id;this.refreshMenu();this.loadStage(next.id);}}
    controls() {
        const pad=this.gamepad.poll();
        if(pad.wantPause||this.input.consume('pause')){if(this.state==='MENU')this.start();else if(this.state==='PAUSED')this.resume();else this.pause();}
        if(this.input.consume('confirm')&&this.state==='MENU')this.start();
        if(this.input.consume('retry')&&['RACING','PAUSED','FINISHED','COUNTDOWN'].includes(this.state))this.restart();
        if((pad.wantCamera||this.input.consume('camera'))&&['RACING','COUNTDOWN','PAUSED'].includes(this.state)){this.viewMode=this.viewMode==='CHASE'?'CLOSE':this.viewMode==='CLOSE'?'COCKPIT':'CHASE';this.hud.flashMessage(this.viewMode==='COCKPIT'?'HOOD CAMERA':this.viewMode+' CAMERA');}
        if((pad.wantLights||this.input.consume('lights'))&&this.state!=='MENU'){const on=this.vehicle.toggleHeadlights();this.hud.flashMessage(on?'HEADLIGHTS ON':'HEADLIGHTS OFF');}
        const reset=pad.wantReset||this.input.consume('reset');if(reset&&this.state==='RACING')this.pendingReset=true;
        const k=this.input.getState();return {throttle:Math.max(k.up?1:0,pad.throttle),brake:Math.max(k.down?1:0,pad.brake),steer:Math.max(-1,Math.min(1,(k.right?1:0)-(k.left?1:0)+pad.steer)),handbrake:Math.max(k.handbrake?1:0,pad.handbrake),reverse:k.reverse||pad.reverse,reset:false};
    }
    tick(input) {
        if(this.state==='COUNTDOWN'){
            this.countdown-=1/60;const count=Math.ceil(this.countdown);
            if(count>0&&count!==this.lastCount){this.lastCount=count;this.hud.setCountdown(String(count));if(count<3)this.audio.beep(440,.12);}
            if(this.countdown<=0){this.state='RACING';this.hud.setCountdown(null);this.audio.beep(880,.25);this.hud.flashMessage('GO!');}return;
        }
        if(this.state!=='RACING')return;
        input={...input,reset:this.pendingReset};this.pendingReset=false;
        appendInput(this.runs,input);const quantized=unpackInput(this.runs.at(-1));const oldGate=this.sim.gate;this.sim.step(quantized);this.clock+=1/60;
        if(quantized.reset){this.frames.push(this.sim.snapshot());this.hud.flashMessage('RECOVERED · +5 SECONDS');}
        if(this.sim.ticks%6===0)this.frames.push(this.sim.snapshot());
        this.maxDist=Math.max(this.maxDist,this.sim.frame.dist);
        if(this.sim.gate>oldGate&&!this.sim.finished){this.audio.checkpoint();const delta=this.bestRecord?.splits?.[oldGate];this.hud.flashMessage('SECTOR '+this.sim.gate+' · '+HUD.fmt(this.sim.elapsed*1000)+(delta!==undefined?' · '+this.delta(this.sim.elapsed-delta):''));}
        if(this.sim.impact>2&&this.clock-this.lastImpact>.4){this.lastImpact=this.clock;this.cameraController.shake=Math.min(1,this.sim.impact/10);this.audio.impact(Math.min(1,this.sim.impact/10));this.gamepad.rumble(Math.min(1,this.sim.impact/10),.15);}
        if(this.sim.speed>7){this.vehicle.sync(this.sim);this.vehicle.rearWheelPos(this._dustPos||=new THREE.Vector3());this.dust.kickUp(this._dustPos.x,this._dustPos.y,this._dustPos.z,this.sim.speed*3.6,this.sim.surface,this.sim.slip);}
        this.dust.update(1/60);
        if(this.sim.finished)this.finish();else if(this.sim.ticks>=18000){this.pause();this.hud.flashMessage('RUN LIMIT · Retry for a fresh attempt');}
    }
    delta(seconds){return (seconds<=0?'−':'+')+Math.abs(seconds).toFixed(2)+'s';}
    updateHUD() {
        this.hud.update(this.sim.speed*3.6,this.vehicle.gear,this.sim.elapsed*1000);
        $('ui-progress').value=this.sim.frame.dist/this.track.totalLength;$('ui-distance').textContent=Math.round(this.sim.frame.dist)+' / '+Math.round(this.track.totalLength)+' m';$('ui-surface').textContent=this.sim.surface.toUpperCase();$('ui-damage').textContent='Damage '+Math.round(this.sim.damage*100)+'%';
        const target=this.track.course.definition.medals;const best=this.bestRecord;const next=best&&best.time<=target[0]?'PERSONAL BEST':best&&best.time<=target[1]?'GOLD':best&&best.time<=target[2]?'SILVER':'BRONZE';$('ui-target').textContent=next+' · '+HUD.fmt((next==='PERSONAL BEST'?best.time:target[next==='GOLD'?0:next==='SILVER'?1:2])*1000);
        const split=this.sim.gate>0?this.sim.splits[this.sim.gate-1]:null;const ref=this.bestRecord?.splits?.[this.sim.gate-1];$('ui-delta').textContent=split!==null&&ref!==undefined?'LAST SPLIT '+this.delta(split-ref):'';
    }
    render(dt) {
        if(!this.track||!this.sim)return;
        this.vehicle.sync(this.sim,this.state==='RACING'?this.fixed.alpha:1);
        this.cameraController.update(dt,this.viewMode);this.sun.position.copy(this.vehicle.position).addScaledVector(this.sunDir,160);this.sun.target.position.copy(this.vehicle.position);this._updateDayCycle();
        if(['RACING','COUNTDOWN'].includes(this.state)){
            this.updateHUD();this.ghost.update(this.sim.elapsed,this.settings.ghost);this.rival.update(this.sim.elapsed,!!this.friend);
            this.hud.drawMinimap(this.track,this.vehicle.position,this.vehicle.rotation.y);
            if(this.state==='RACING'){
                this.audio.update(this.vehicle.rpm,this.sim.pedal,this.sim.slip,this.sim.speed*3.6,this.sim.surface,Math.abs(this.sim.frame.lateral)>3.9);
                const corner=this.track.course.cornerAhead(this.sim.frame.dist,this.sim.speed);this.hud.showCorner(corner);
                if(corner&&corner.id!==this.lastCorner){this.lastCorner=corner.id;if(this.settings.voice&&this.settings.volume>0&&'speechSynthesis'in window){window.speechSynthesis.cancel();const speech=new SpeechSynthesisUtterance(corner.dir+' '+corner.sev+', '+Math.round(corner.dist)+' meters');speech.rate=1.2;speech.volume=this.settings.volume;window.speechSynthesis.speak(speech);}}
                if(this.sim.elapsed>8&&this.stageId!=='school')$('race-tip').textContent='';
                if(this.stageId==='school')$('race-tip').textContent=this.sim.frame.dist<100?'Accelerate on the straight. Brake before the first left.':this.sim.frame.dist<290?'Release the throttle, turn smoothly, then accelerate as the road opens.':this.sim.frame.dist<420?'Gravel ahead: brake earlier and leave room for the slide.':'Follow the road to the finish. Beat your ghost on the next run.';
            }
        }
        for(const f of this.track.flags||[])f.rotation.y=f.userData.base+Math.sin(this.clock*4+f.userData.phase)*.2;
        if(this.composer&&this.settings.quality==='high')this.composer.render();else this.renderer.render(this.scene,this.camera);
    }
    animate(now) {
        requestAnimationFrame(t=>this.animate(t));if(now===undefined)return;
        const dt=this.lastFrame===null?0:Math.max(0,(now-this.lastFrame)/1000);this.lastFrame=now;
        const controls=this.controls();
        if(['RACING','COUNTDOWN'].includes(this.state)&&!this.fixed.advance(dt,()=>this.tick(controls))){this.pause();this.hud.flashMessage('PAUSED AFTER A STALL · Resume when ready');}
        this.render(Math.min(dt,.05));
    }
    finish() {
        if(this.state!=='RACING')return;this.frames.push(this.sim.snapshot());this.state='FINISHED';this.audio.fanfare();setTimeout(()=>{if(this.state==='FINISHED')this.audio.setMuted(true);},750);window.speechSynthesis?.cancel();this.hud.showCorner(null);this.ghost.group.visible=false;this.rival.group.visible=false;$('race-ui').hidden=true;$('results-screen').hidden=false;$('retry-result').focus();
        this.result={time:this.sim.elapsed,frames:this.frames,splits:[...this.sim.splits],distance:this.sim.distanceDriven,damage:this.sim.damage};
        const result=this.progress.finish(this.track.course.definition,this.carId,this.result);$('res-time').textContent=HUD.fmt(this.result.time*1000);$('res-medal').textContent=MEDAL_NAMES[result.medal];$('res-best').textContent=result.improved?'New best!':HUD.fmt(this.progress.best(this.stageId,this.carId).time*1000);$('res-avg').textContent=Math.round(this.sim.distanceDriven/(this.sim.ticks/60)*3.6)+' km/h';$('res-damage').textContent=Math.round(this.sim.damage*100)+'%';$('result-title').textContent=result.improved?'A new personal best.':'Another road behind you.';
        const targets=this.track.course.definition.medals;
        $('result-message').textContent=result.medal===3?'Gold earned. Now chase the perfect line.':(this.result.time-targets[2-result.medal]).toFixed(2)+'s to '+MEDAL_NAMES[result.medal+1]+'. Follow your ghost and find the time.';
        $('result-splits').replaceChildren(...this.sim.splits.map((time,i)=>{const span=document.createElement('span');span.textContent='S'+(i+1)+' '+HUD.fmt(time*1000)+(this.bestRecord?.splits?.[i]!==undefined?' ('+this.delta(time-this.bestRecord.splits[i])+')':'');return span;}));
        const index=STAGES.findIndex(s=>s.id===this.stageId),next=STAGES[index+1];$('next-result').hidden=!next||!this.progress.unlocked(next.id)||this.stageId.startsWith('daily-');$('result-unlock').textContent=next&&result.medal>0?'Next road open: '+next.name+'.':this.progress.points+' campaign medal points · cosmetic liveries in the garage.';
        $('submit-status').textContent='Your replay will be checked by the server before it appears on the board.';$('submit-run').disabled=false;$('share-link').hidden=true;$('share-button').textContent='Copy stage link';this.refreshMenu();
    }
    async refreshBoard() {
        const request=++this.boardRequest,id=this.stageId,car=this.carId;$('board-status').textContent='Loading standings…';$('leaderboard').replaceChildren();
        try{const r=await fetch('/api/leaderboard?stage='+encodeURIComponent(id)+'&car='+car);if(!r.ok)throw Error();const data=await r.json();if(request!==this.boardRequest)return;
            $('board-status').textContent=data.entries.length?'Server-verified input replays · names are not authenticated':'No verified runs yet. Set the first time.';
            $('leaderboard').replaceChildren(...data.entries.map((e,i)=>{const li=document.createElement('li'),rank=document.createElement('span'),name=document.createElement('span'),time=document.createElement('strong'),b=document.createElement('button');rank.textContent=String(i+1).padStart(2,'0');name.textContent=e.name;name.className='driver';time.textContent=HUD.fmt(e.time*1000);b.textContent='Race ghost';b.className='text-button';b.addEventListener('click',()=>this.loadSharedGhost(e.id));li.append(rank,name,time,b);return li;}));
        }catch{if(request===this.boardRequest)$('board-status').textContent='Competition server unavailable. Campaign and personal ghosts work offline.';}
    }
    async loadSharedGhost(id) {
        try{const response=await fetch('/api/replay/'+encodeURIComponent(id));if(!response.ok)throw Error('Replay unavailable');const replay=await response.json();
            if(!replay.stage.startsWith('daily-')&&!this.progress.unlocked(replay.stage))throw Error('Earn bronze on the previous road to race this ghost.');
            if(this.state!=='MENU')throw Error('Return to stage selection to load a rival.');
            if(this.stageId!==replay.stage){this.stageId=replay.stage;this.carId=replay.car;this.mode=replay.stage.startsWith('daily-')?'daily':replay.stage==='school'?'school':'campaign';await this.loadStage(replay.stage);}else if(this.carId!==replay.car){this.carId=replay.car;this.sim=new RallySimulation(this.track.course,this.carId);this.vehicle.sync(this.sim);this.refreshBoard();}
            this.friend=replay;this.rival.load(replay.frames);$('friend-status').hidden=false;$('clear-friend').hidden=false;$('friend-status').textContent='Cyan ghost · '+replay.name+' · '+HUD.fmt(replay.time*1000);this.refreshMenu();
        }catch(error){$('friend-status').hidden=false;$('friend-status').textContent=error.message;}
    }
    async submitRun() {
        if(!this.result||this.state!=='FINISHED')return;const name=$('driver-name').value.trim();if(!name){$('submit-status').textContent='Enter a driver name first.';return;}
        const stage=this.stageId,car=this.carId,time=this.result.time,runs=this.runs.map(r=>[...r]);$('submit-run').disabled=true;$('submit-status').textContent='Checking your full input replay…';
        try{const response=await fetch('/api/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:RULES_VERSION,stage,car,time,name,runs})});const data=await response.json();if(!response.ok)throw Error(data.error||'Could not submit run');if(this.state!=='FINISHED'||this.stageId!==stage)return;this.submitted=data.id;$('submit-status').textContent=data.placed?'Replay verified. Your run is on the stage leaderboard.':'Replay verified. Finish inside the top ten to appear on the board.';$('share-button').textContent=data.id?'Copy rival ghost link':'Copy stage link';this.refreshBoard();}
        catch(error){$('submit-status').textContent=error.message||'Server unavailable. Your personal best is saved locally.';$('submit-run').disabled=false;}
    }
    async share() {
        const url=new URL(location.href);url.search='';url.searchParams.set('stage',this.stageId);url.searchParams.set('car',this.carId);if(this.submitted)url.searchParams.set('ghost',this.submitted);
        $('share-link').hidden=false;$('share-link').value=url.href;
        try{await navigator.clipboard.writeText(url.href);$('share-button').textContent='Copied!';}catch{$('share-link').select();$('share-button').textContent='Select and copy the link below';}
    }
    _setupSkyAndLights() {
        const sky = new Sky();
        sky.scale.setScalar(3000);
        const u = sky.material.uniforms;
        u.turbidity.value = 6;
        u.rayleigh.value = 1.8;
        u.mieCoefficient.value = 0.004;
        u.mieDirectionalG.value = 0.85;
        const elevation = 26, azimuth = 135;
        const phi = THREE.MathUtils.degToRad(90 - elevation);
        const theta = THREE.MathUtils.degToRad(azimuth);
        this.sunDir = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
        u.sunPosition.value.copy(this.sunDir);
        this.scene.add(sky);
        this.skyU = u;

        this.hemi = new THREE.HemisphereLight(0xbdd7ee, 0x3a5f3a, 0.7);
        this.scene.add(this.hemi);

        this.sun = new THREE.DirectionalLight(0xfff1dd, 2.6);
        this.sun.castShadow = true;
        this.sun.shadow.mapSize.set(2048, 2048);
        this.sun.shadow.camera.left = -45;
        this.sun.shadow.camera.right = 45;
        this.sun.shadow.camera.top = 45;
        this.sun.shadow.camera.bottom = -45;
        this.sun.shadow.camera.near = 10;
        this.sun.shadow.camera.far = 500;
        this.sun.shadow.bias = -0.0004;
        this.scene.add(this.sun);
        this.scene.add(this.sun.target);
    }

    _setupComposer() {
        try {
            const size = new THREE.Vector2(window.innerWidth, window.innerHeight);
            const rt = new THREE.WebGLRenderTarget(size.x, size.y, { samples: 4, type: THREE.HalfFloatType });
            this.composer = new EffectComposer(this.renderer, rt);
            this.composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            this.composer.addPass(new RenderPass(this.scene, this.camera));
            const bloom = new UnrealBloomPass(size, 0.32, 0.55, 0.85);
            this.composer.addPass(bloom);
            this.composer.addPass(new OutputPass());
        } catch (e) {
            console.warn('Post-processing unavailable, using direct render.', e);
            this.composer = null;
        }
    }

    _updateDayCycle() {
        const total = Math.max(this.track.totalLength, 1);
        const p = this.track.course.definition.timeOfDay;
        const elev = THREE.MathUtils.lerp(30, -9, Math.pow(p, 1.15));
        this.sunDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - elev), THREE.MathUtils.degToRad(135));
        this.skyU.sunPosition.value.copy(this.sunDir);
        const sunset = Math.exp(-Math.pow((p - 0.55) / 0.18, 2));
        this.skyU.rayleigh.value = 1.8 + sunset * 2.4;
        this.skyU.turbidity.value = 6 + sunset * 4;
        this.skyU.mieCoefficient.value = 0.004 + sunset * 0.02;
        const night = THREE.MathUtils.smoothstep(p, 0.72, 0.95);
        if (p < 0.6) this.sun.color.copy(_DAY).lerp(_SET, p / 0.6);
        else this.sun.color.copy(_SET).lerp(_NIGHT, (p - 0.6) / 0.4);
        this.sun.intensity = THREE.MathUtils.lerp(2.6, 0.12, night);
        this.hemi.intensity = THREE.MathUtils.lerp(1.0, 0.35, night);
        this.renderer.toneMappingExposure = THREE.MathUtils.lerp(1.05, 0.85, night);
        if (p < 0.6) this.scene.fog.color.copy(_FOGDAY).lerp(_FOGSET, p / 0.6);
        else this.scene.fog.color.copy(_FOGSET).lerp(_FOGNIGHT, (p - 0.6) / 0.4);
        this.scene.fog.density = 0.0028 + night * 0.0014;
        // Headlights take over automatically after dark
        const autoNight = night > 0.5;
        for (const b of this.vehicle.beams) b.visible = this.vehicle.headlightsOn;
        this.vehicle.lampMat.emissiveIntensity = this.vehicle.headlightsOn ? 3 : 0.15;
    }

}
