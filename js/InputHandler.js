const DRIVE = {KeyW:'up',ArrowUp:'up',KeyS:'down',ArrowDown:'down',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',Space:'handbrake',KeyB:'reverse'};
const ACTION = {KeyP:'pause',Escape:'pause',KeyC:'camera',KeyR:'reset',KeyT:'retry',KeyH:'lights',Enter:'confirm'};
export class InputHandler {
    constructor(){this.held=new Set();this.touch={};this.actions=new Set();}
    onKeyDown(e){if(DRIVE[e.code]||ACTION[e.code])e.preventDefault?.();if(DRIVE[e.code])this.held.add(e.code);if(ACTION[e.code]&&!e.repeat)this.actions.add(ACTION[e.code]);}
    onKeyUp(e){this.held.delete(e.code);}
    clear(){this.held.clear();this.touch={};this.actions.clear();}
    consume(action){const has=this.actions.has(action);this.actions.delete(action);return has;}
    getState(){const s={up:false,down:false,left:false,right:false,handbrake:false,reverse:false};for(const code of this.held)s[DRIVE[code]]=true;for(const [k,v]of Object.entries(this.touch))s[k]=s[k]||v;return s;}
}
