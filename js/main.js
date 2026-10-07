function showFatal(error) {
    console.error(error);
    document.getElementById('loading').hidden=true;
    const card=document.querySelector('#main-menu .menu-shell');
    const button=document.getElementById('race-button');if(button){button.disabled=true;button.textContent='Scene unavailable';}
    if(card&&!document.getElementById('fatal-err')){const p=document.createElement('p');p.id='fatal-err';p.setAttribute('role','alert');p.style.color='#9a2a1a';p.textContent='Could not load the game: '+(error?.message||error)+'. Check WebGL support, then reload.';card.prepend(p);}
}
window.addEventListener('error',e=>{if(!window.game)showFatal(e.error||e.message);});
window.addEventListener('unhandledrejection',e=>showFatal(e.reason));
try{const {Game}=await import('./Game.js');window.game=new Game();}catch(error){showFatal(error);}
