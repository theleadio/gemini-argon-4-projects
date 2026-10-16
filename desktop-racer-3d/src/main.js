import { createScene } from './scene.js';
import { createCarState, stepCar, formatTime } from './physics.js';

const $ = (id) => document.getElementById(id);
let game;
try {
  game = createScene($('scene'));
} catch (error) {
  $('error').hidden = false;
  $('error').textContent = 'The 3D engine could not start. Please enable hardware acceleration or open this page in a WebGL-capable browser.';
  $('start').disabled = true;
  console.error(error);
}
if (game) init(game);

function init(game) {
  let car = createCarState(), phase = 'ready', cameraMode = 0, countdown = 0, best = Infinity;
  let lastFrame = performance.now(), elapsed = 0, toastUntil = 0, lastCollision = 0;
  const keys = new Set();
  try { const stored = Number(localStorage.getItem('desktop-racer-best')); if (stored > 0) best = stored; } catch { /* Storage is optional. */ }
  if (Number.isFinite(best)) $('best').textContent = formatTime(best);
  let audio, oscillator, gain, sound = false;
  function toggleSound() {
    sound = !sound;
    if (sound && !audio) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) { sound = false; return; }
      audio = new AudioContext(); oscillator = audio.createOscillator(); gain = audio.createGain();
      oscillator.type = 'triangle'; oscillator.frequency.value = 55; gain.gain.value = 0;
      oscillator.connect(gain).connect(audio.destination); oscillator.start();
    }
    if (sound) audio.resume();
    $('sound').innerHTML = sound ? '♪' : '♪<span class="slash">／</span>';
    $('sound').setAttribute('aria-label', sound ? 'Mute engine sound' : 'Enable engine sound');
    $('sound').setAttribute('aria-pressed', String(sound));
  }
  function notify(message, duration = 3) { $('announcement').textContent = message; $('announcement').classList.add('visible'); toastUntil = elapsed + duration; }
  function start() {
    if ($('help-dialog').open) return;
    car = createCarState(); keys.clear(); phase = 'countdown'; countdown = 3.5;
    document.body.classList.add('racing');
    $('speedometer').hidden = false; $('race-buttons').hidden = false;
    $('pause').innerHTML = 'Pause <kbd>P</kbd>';
    $('time').textContent = formatTime(0); $('lap').textContent = '01';
    $('announcement').classList.remove('visible');
    $('start').blur();
  }
  function pause() {
    if (phase === 'racing') { phase = 'paused'; notify('Paused. Take a breather. Press P to resume.', 86400); $('pause').innerHTML = 'Resume <kbd>P</kbd>'; }
    else if (phase === 'paused') { phase = 'racing'; $('announcement').classList.remove('visible'); $('pause').innerHTML = 'Pause <kbd>P</kbd>'; }
    keys.clear();
  }
  function switchCamera(){cameraMode=(cameraMode+1)%2;game.setCamera(cameraMode);$('camera-label').textContent=cameraMode?'Chase cam':'Overview';}
  function setHeight(value){const cm=Math.max(70,Math.min(120,Number(value)));$('height').value=String(cm);$('height-value').textContent=String(cm);game.setHeight(cm);}
  $('start').onclick=start;$('restart').onclick=start;$('pause').onclick=pause;$('camera').onclick=switchCamera;$('sound').onclick=toggleSound;
  $('height').oninput=(e)=>setHeight(e.target.value);
  $('raise').onclick=()=>setHeight(Number($('height').value)+5);
  $('lower').onclick=()=>setHeight(Number($('height').value)-5);
  $('help').onclick=()=>{if(phase==='racing')pause();$('help-dialog').showModal();};
  $('close-help').onclick=()=>$('help-dialog').close();
  $('help-dialog').addEventListener('click',e=>{if(e.target===$('help-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
  window.addEventListener('keydown',e=>{
    if(e.target instanceof HTMLInputElement || $('help-dialog').open)return;
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
    keys.add(e.code);
    if(e.repeat)return;
    if(e.code==='Enter'&&(phase==='ready'||phase==='finished'))start();
    if(e.code==='KeyR')start();
    if(e.code==='KeyP'||e.code==='Escape')pause();
    if(e.code==='KeyC')switchCamera();
  });
  window.addEventListener('keyup',e=>keys.delete(e.code));
  window.addEventListener('blur',()=>{keys.clear();if(phase==='racing')pause();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();if(phase==='racing')pause();}});
  document.querySelectorAll('[data-key]').forEach(button=>{
    button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);keys.add(button.dataset.key);});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>keys.delete(button.dataset.key));
  });
  function frame(now){
    const dt=Math.min((now-lastFrame)/1000,.05);lastFrame=now;elapsed+=dt;
    if(phase==='countdown'){
      countdown-=dt;$('countdown').textContent=countdown>.5?String(Math.ceil(countdown-.5)):'GO';
      if(countdown<=0){phase='racing';$('countdown').textContent='';notify('Follow the arrows. 3 laps. Make them count.',3);}
    }
    if(phase==='racing'){
      const input={
        throttle:Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown')),
        steer:Number(keys.has('KeyA')||keys.has('ArrowLeft'))-Number(keys.has('KeyD')||keys.has('ArrowRight')),
        boost:keys.has('ShiftLeft')||keys.has('ShiftRight'),brake:keys.has('Space')
      };
      // Fixed substeps keep collisions stable at low and variable frame rates.
      const steps=Math.ceil(dt/(1/120));
      for(let i=0;i<steps;i++){
        const result=stepCar(car,input,dt/steps,game.obstacles);
        if(result.collision&&elapsed-lastCollision>1.5){lastCollision=elapsed;notify('Easy there. Office equipment has the right of way.',2);}
        if(result.lap&&!car.finished)notify(`Lap ${car.lap} complete · ${formatTime(car.lapTimes.at(-1))}`,3);
        if(car.finished){
          phase='finished';const personalBest=car.time<best;
          if(personalBest){best=car.time;try{localStorage.setItem('desktop-racer-best',String(best));}catch{/* Private browsing may block storage. */}$('best').textContent=formatTime(best);}
          notify(`${personalBest?'New personal best!':'Finish!'} ${formatTime(car.time)} · Enter to race again`,86400);
          break;
        }
      }
      $('time').textContent=formatTime(car.time);$('lap').textContent=String(Math.min(car.lap+1,3)).padStart(2,'0');
    }
    if(elapsed>toastUntil)$('announcement').classList.remove('visible');
    $('speed').textContent=String(Math.round(Math.abs(car.speed)*12));$('boost-fill').style.width=`${car.boost*100}%`;
    if(audio){gain.gain.setTargetAtTime(sound&&phase==='racing'?.025+Math.abs(car.speed)*.004:0,audio.currentTime,.1);oscillator.frequency.setTargetAtTime(48+Math.abs(car.speed)*28,audio.currentTime,.05);}
    game.update(car,dt,elapsed,phase!=='ready');
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
