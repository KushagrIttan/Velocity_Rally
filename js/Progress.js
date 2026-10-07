import { RULES_VERSION, STAGES, medalFor } from './Stages.js';
export const recordKey=(stage,car)=>`${RULES_VERSION}:${stage}:${car}`;
export class Progress {
    constructor(storage){
        this.available=true;
        if(storage===undefined){try{storage=globalThis.localStorage;}catch{this.available=false;}}
        this.storage=storage;
        this.data={records:{},medals:{},settings:{volume:.65,quality:'medium',ghost:true,voice:false},livery:'heritage'};
        try{const saved=JSON.parse(storage?.getItem('velocity-rally-v2')||'null');if(saved&&typeof saved==='object'){for(const field of ['records','medals','settings'])if(saved[field]&&typeof saved[field]==='object'&&!Array.isArray(saved[field]))Object.assign(this.data[field],saved[field]);if(typeof saved.livery==='string')this.data.livery=saved.livery;}}
        catch{this.available=false;}
        const settings=this.data.settings;
        settings.volume=Math.max(0,Math.min(1,Number(settings.volume)||0));
        if(!['low','medium','high'].includes(settings.quality))settings.quality='medium';
        settings.ghost=settings.ghost!==false;settings.voice=settings.voice===true;
    }
    save(){try{this.storage.setItem('velocity-rally-v2',JSON.stringify(this.data));return true;}catch{this.available=false;return false;}}
    get points(){return STAGES.filter(s=>s.id!=='school').reduce((n,s)=>n+this.medal(s.id),0);}
    medal(id){return Math.max(0,Math.min(3,Number(this.data.medals[`${RULES_VERSION}:${id}`])||0));}
    unlocked(id){const index=STAGES.findIndex(s=>s.id===id);return index<=1||this.medal(STAGES[index-1].id)>0;}
    best(stage,car){const r=this.data.records[recordKey(stage,car)];return r&&Number.isFinite(r.time)&&r.time>0&&Array.isArray(r.frames)&&r.frames.length<=20000&&r.frames.every(f=>Array.isArray(f)&&f.length===5&&f.every(Number.isFinite))?r:null;}
    finish(stage,car,record){
        const old=this.best(stage.id,car),medal=medalFor(record.time,stage.medals);
        this.data.medals[`${RULES_VERSION}:${stage.id}`]=Math.max(this.medal(stage.id),medal);
        const improved=!old||record.time<old.time;
        if(improved)this.data.records[recordKey(stage.id,car)]=record;
        // Daily records expire from local storage after 14 dates, preserving campaign ghosts.
        const daily=Object.keys(this.data.records).filter(k=>k.includes(':daily-')).sort().reverse();
        for(const key of daily.slice(14))delete this.data.records[key];
        this.save();return {improved,medal,previous:old?.time};
    }
}
