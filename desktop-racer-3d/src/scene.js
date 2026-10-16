import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const C = { graphite: 0x282e31, dark: 0x151d21, silver: 0xb7bec0, red: 0xd84832, white: 0xe9ece5 };
const materials = new Map();
function mat(color, roughness = .65, metalness = 0) {
  const key = `${color}-${roughness}-${metalness}`;
  if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness }));
  return materials.get(key);
}
function box(parent, w, h, d, x, y, z, color, radius = .035) {
  const mesh = new THREE.Mesh(radius ? new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 3, h / 3, d / 3)) : new THREE.BoxGeometry(w, h, d), typeof color === 'number' ? mat(color) : color);
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh);
  return mesh;
}
function cylinder(parent, r, h, x, y, z, color, r2 = r) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r2, h, 32), mat(color));
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function texture(draw, w = 1024, h = 512) {
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  draw(canvas.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; return tex;
}
function plane(parent, w, h, tex, x, y, z, flat = false) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
  mesh.position.set(x, y, z); if (flat) mesh.rotation.x = -Math.PI / 2; parent.add(mesh); return mesh;
}
function label(parent, text, w, h, x, y, z, color = '#d9dfd8', flat = false) {
  const tex = texture((ctx, cw, ch) => { ctx.fillStyle = color; ctx.font = '700 80px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, cw / 2, ch / 2); }, 1024, 128);
  return plane(parent, w, h, tex, x, y, z, flat);
}
function cable(parent, points, color = 0x252c2a, radius = .027) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, radius, 6, false), mat(color)); parent.add(mesh);
}
function screenTexture(mode) {
  return texture((ctx, w, h) => {
    ctx.fillStyle = mode === 'code' ? '#152426' : '#1f3836'; ctx.fillRect(0, 0, w, h);
    if (mode === 'mountain') {
      const gradient = ctx.createLinearGradient(0, 0, 0, h); gradient.addColorStop(0, '#b3c8b5'); gradient.addColorStop(1, '#4b7571'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
      ['#799b85', '#456d61', '#244c46'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(0, h); for (let j = 0; j <= 10; j++) ctx.lineTo(j * w / 10, h * (.3 + i * .15) + Math.sin(j * 2.3 + i) * 70); ctx.lineTo(w, h); ctx.fill(); });
      ctx.fillStyle = '#ffffffcc'; ctx.font = '300 88px Arial'; ctx.textAlign = 'center'; ctx.fillText('09:41', w / 2, h * .35); ctx.font = '18px Arial'; ctx.fillText('THURSDAY, OCTOBER 15', w / 2, h * .43);
    } else {
      ctx.fillStyle = '#26383a'; ctx.fillRect(0, 0, w, 38); ctx.fillStyle = '#36484a'; ctx.fillRect(0, 38, 155, h);
      ['#e27568', '#dfc16e', '#79ab89'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(22 + i * 25, 19, 6, 0, 7); ctx.fill(); });
      for (let row = 0; row < 22; row++) { ctx.fillStyle = '#688880'; ctx.fillRect(22, 65 + row * 18, 55 + (row % 3) * 19, 5); ctx.fillStyle = ['#7cafac', '#b7c899', '#c19c7c', '#849da0'][row % 4]; ctx.fillRect(194 + (row % 4) * 20, 63 + row * 19, 110 + ((row * 83) % 370), 6); }
      ctx.fillStyle = '#2d716b'; ctx.fillRect(0, h - 19, w, 19);
    }
    ctx.fillStyle = '#d5dfd966'; ctx.fillRect(w * .36, h - 12, w * .28, 4);
  });
}

export function createScene(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe7e9e7);
  scene.fog = new THREE.Fog(0xe7e9e7, 45, 95);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
  container.appendChild(renderer.domElement);
  const camera = new THREE.OrthographicCamera(-20, 20, 12, -12, .1, 150);
  camera.position.set(21, 23, 29); camera.lookAt(0, 3, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8c9e8b, 2.6));
  const sun = new THREE.DirectionalLight(0xfff4dd, 4);
  sun.position.set(-10, 24, 10); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 65 });
  sun.shadow.normalBias = .035; sun.shadow.bias = -.0002; sun.shadow.radius = 5; scene.add(sun);
  const fill = new THREE.DirectionalLight(0xc9e0ee, 1.3); fill.position.set(14, 10, -10); scene.add(fill);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), mat(0xe1e5de, .9));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.05; ground.receiveShadow = true; scene.add(ground);
  const desk = new THREE.Group(); desk.position.y = 4.6; scene.add(desk);
  const wood = texture((ctx, w, h) => {
    ctx.fillStyle = '#a88a64'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1700; i++) { const seed = Math.sin(i * 17.317) * 43758.5453; const r = seed - Math.floor(seed); ctx.strokeStyle = i % 3 === 0 ? `rgba(68,42,17,${.025 + r * .06})` : 'rgba(241,216,168,.045)'; ctx.lineWidth = .3 + r * 1.7; const y = i * h / 1700; ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(w * .3, y + r * 9, w * .6, y - r * 7, w, y + r * 2); ctx.stroke(); }
  }, 2048, 1024);
  const woodMat = new THREE.MeshStandardMaterial({ map: wood, roughness: .72 });
  box(desk, 19.2, .38, 11, 0, -.22, 0, woodMat, .18);
  box(desk, 18.9, .09, 10.8, 0, -.43, 0, 0x292e2b, .04);
  const legs = [];
  for (const x of [-6.5, 6.5]) {
    box(scene, 1.05, .22, 5.5, x, .12, 0, C.graphite, .1);
    box(scene, .66, 2.3, .8, x, 1.32, 0, C.graphite, .06);
    const leg = box(scene, .51, 2.7, .64, x, 3.3, 0, 0x3b4243, .03); legs.push(leg);
    box(desk, 1.1, .25, 7.5, x, -.61, 0, C.graphite, .04);
  }
  box(desk, 13.5, .45, .65, 0, -.8, .1, C.graphite);
  box(desk, 1.9, .29, .55, 6.2, -.55, 5.15, C.dark, .07);
  label(desk, '075  ∧ ∨', 1.5, .18, 6.2, -.55, 5.434, '#b2d1be');
  label(desk, 'TT RACING', 2.1, .22, -5.3, -.23, 5.508, '#e4e7df');
  const obstacles = [];
  const obstacle = (x, z, w, d) => obstacles.push({ x, z, w, d });
  // The dark felt infield makes the wood route readable without hiding the desk.
  box(desk, 12.6, .025, 6.5, 0, .005, -.1, 0x343d38, .22);
  const trackTex = texture((ctx, w, h) => {
    const sx = w / 19.2, sz = h / 11;
    const route = (inset) => {
      const left = (9.6 - 7.65 + inset) * sx, top = (5.5 - 4.35 + inset) * sz;
      const width = (15.3 - inset * 2) * sx, height = (8.7 - inset * 2) * sz;
      ctx.beginPath(); ctx.roundRect(left, top, width, height, [1.9 * sx]); ctx.stroke();
    };
    ctx.strokeStyle = '#ece9d28c'; ctx.lineWidth = 3; route(-.65); route(.65);
    ctx.setLineDash([12, 13]); ctx.strokeStyle = '#eee5ca85'; ctx.lineWidth = 2; route(0); ctx.setLineDash([]);
    for (let j = 0; j < 10; j++) for (let i = 0; i < 3; i++) { ctx.fillStyle = (i + j) % 2 === 0 ? '#f5f1dd' : '#353b32'; ctx.fillRect((9.6 + i * .14) * sx, (5.5 + 3.65 + j * .14) * sz, .14 * sx + .5, .14 * sz + .5); }
    ctx.fillStyle = '#f7f0d3'; ctx.font = 'bold 20px Arial'; ctx.textAlign = 'center';
    [[-4, 4.35, 0], [4.8, 4.35, 0], [7.65, 1.5, -Math.PI / 2], [3, -4.35, Math.PI], [-4.4, -4.35, Math.PI], [-7.65, -1.5, Math.PI / 2]].forEach(([x,z,r]) => {ctx.save();ctx.translate((x+9.6)*sx,(z+5.5)*sz);ctx.rotate(r);ctx.fillText('››',0,7);ctx.restore();});
    ctx.font = '600 15px Arial'; ctx.fillStyle = '#e8dfc49c'; ctx.fillText('DESKTOP CIRCUIT / 01', 9.6 * sx, (5.5 + 2.95) * sz);
  }, 2048, 1174);
  plane(desk, 19.2, 11, trackTex, 0, .027, 0, true);
  for (const [x, z, rotation] of [[6.8,3.75,0],[-6.8,-3.75,0],[6.9,-3.6,Math.PI/2],[-6.9,3.6,Math.PI/2]]) {
    for (let i = 0; i < 7; i++) { const block = box(desk, .35, .07, .2, x + Math.cos(rotation) * i * .35, .04, z + Math.sin(rotation) * i * .35, i % 2 ? C.white : C.red, .015); block.rotation.y = -rotation; }
  }
  const gates = [];
  for (const [x, z, rot] of [[7.6,0,0],[0,-4.35,Math.PI/2],[-7.6,0,0],[0,4.35,Math.PI/2]]) {
    const gate = new THREE.Group(); gate.position.set(x, 0, z); gate.rotation.y = rot; desk.add(gate);
    for (const side of [-1,1]) { cylinder(gate,.09,.37,side*.82,.2,0,C.red); cylinder(gate,.14,.05,side*.82,.04,0,C.dark); }
    const indicator = box(gate,1.5,.009,.07,0,.034,0,new THREE.MeshBasicMaterial({color:0xe6a76b}),0); gates.push(indicator);
  }
  // Two external monitors: a code editor and a mountain desktop.
  function monitor(x, z, mode, rotation = 0) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotation; desk.add(g);
    box(g, 1.8, .1, 1.15, 0, .09, .1, C.graphite, .08);
    box(g, .23, 1.15, .25, 0, .65, -.1, C.graphite);
    box(g, 4.5, 2.65, .18, 0, 2.15, -.1, C.dark, .09);
    plane(g, 4.28, 2.4, screenTexture(mode), 0, 2.2, .001);
    box(g, .06, .025, .01, 1.95, .92, .005, 0x9ad1b0, .005);
    label(g,'TT',.23,.07,0,.9,.005);
    obstacle(x, z, 4.5, 1.3);
  }
  monitor(-2.6, -2.15, 'code', .1);
  monitor(2.3, -2.3, 'mountain', -.12);
  function keyboard(parent, x, y, z, width = 3.5, depth = 1.1) {
    box(parent,width,.09,depth,x,y,z,0x929b97,.06);
    for(let row=0;row<5;row++) for(let col=0;col<14;col++) {
      if(row===4&&col>3&&col<10)continue;
      box(parent,width/15.5,.055,depth/6.3,x-width/2+.16+col*width/14.4,y+.065,z-depth/2+.13+row*depth/5.1,(col===0&&row===0)?C.red:0xcbd0c6,.015);
    }
    box(parent,width*.37,.055,depth/6.3,x,y+.065,z+depth*.4,0xcbd0c6,.015);
  }
  keyboard(desk,-.3,.11,1.13); obstacle(-.3,1.13,3.5,1.1);
  box(desk,2.2,.035,1.7,3,.055,1.2,0x202c2a,.1);
  box(desk,.48,.23,.78,3,.18,1.2,0xbdc6bf,.18); obstacle(3,1.2,.8,1.1);
  box(desk,.025,.03,.15,3,.305,1.05,C.dark,.01);
  function laptop(x,z,rotation,mode) {
    const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rotation;desk.add(g);
    box(g,2.5,.1,1.7,0,.1,0,C.silver,.05);
    keyboard(g,0,.165,-.21,2.23,.88);
    box(g,.8,.01,.4,0,.163,.51,0x909b99,.025);
    const lid=new THREE.Group();lid.position.set(0,.18,-.78);lid.rotation.x=-.21;g.add(lid);
    box(lid,2.5,1.65,.09,0,.825,0,0x9ba5a6,.04);
    box(lid,2.4,1.52,.02,0,.84,.05,C.dark,.02);
    plane(lid,2.25,1.37,screenTexture(mode),0,.84,.064);
    obstacle(x,z,2.9,2.3);
  }
  laptop(-4.75,.7,.18,'mountain');
  laptop(4.8,-.45,-.3,'code');
  function phone(x,z,rotation,color) {
    const g=new THREE.Group();g.position.set(x,.075,z);g.rotation.y=rotation;desk.add(g);
    box(g,.57,.065,1.13,0,0,0,C.dark,.08);
    const tex=texture((ctx,w,h)=>{ctx.fillStyle=color;ctx.fillRect(0,0,w,h);ctx.fillStyle='#ffffffdd';ctx.font='100px Arial';ctx.textAlign='center';ctx.fillText('9:41',w/2,h*.36);ctx.fillStyle='#ffffff55';for(let j=0;j<3;j++)ctx.fillRect(w*.12,h*(.55+j*.12),w*.76,h*.08);},256,512);
    plane(g,.49,1.02,tex,0,.036,0,true);box(g,.17,.003,.045,0,.04,-.43,C.dark,.02);
    obstacle(x,z,.9,1.3);
  }
  phone(-2.45,2.3,-.17,'#386561');phone(5.5,1.8,.3,'#b07e57');
  function mug(x,z,color) {
    cylinder(desk,.48,.055,x,.06,z,0x343e36);
    const body=new THREE.Mesh(new THREE.CylinderGeometry(.35,.3,.7,48,1,true),mat(color,.28));
    body.position.set(x,.4,z);body.castShadow=true;desk.add(body);
    const rim=new THREE.Mesh(new THREE.TorusGeometry(.33,.037,10,48),mat(color,.28));rim.rotation.x=Math.PI/2;rim.position.set(x,.76,z);desk.add(rim);
    cylinder(desk,.3,.02,x,.68,z,0x37281c);
    const handle=new THREE.Mesh(new THREE.TorusGeometry(.23,.07,10,24),mat(color,.28));handle.position.set(x+.37,.43,z);desk.add(handle);
    obstacle(x+.1,z,1.05,.9);
  }
  mug(-5.4,-2.6,0xe6e2cf);mug(4.2,2.5,0xc36b49);
  // Podcast microphone on a small desktop stand.
  cylinder(desk,.47,.07,-.3,.075,-.8,C.dark);
  cylinder(desk,.055,.72,-.3,.46,-.8,C.graphite);
  const mic=box(desk,.38,.8,.38,-.3,1.2,-.8,0x2a3235,.17);
  for(let i=0;i<10;i++)box(desk,.34,.017,.015,-.3,.94+i*.061,-.603,0x626c6b,.005);
  box(desk,.035,.5,.5,-.56,.93,-.8,C.graphite);
  box(desk,.035,.5,.5,-.04,.93,-.8,C.graphite);
  obstacle(-.3,-.8,1,1);
  cable(desk,[[-.3,.08,-.8],[.4,.07,-1.5],[1,.07,-2.5],[.6,.07,-3.3]]);
  cable(desk,[[-2.7,.1,-2.3],[-3.1,.04,-3.1],[-1.4,.04,-3.2],[-1,.05,-2.8]]);
  // A small succulent, stationery, and sticky notes complete the working desk.
  cylinder(desk,.38,.65,6,-2+2.36,-2.6,0xc8b499,.3);
  cylinder(desk,.32,.02,6,.695,-2.6,0x453f2b);
  for(let i=0;i<9;i++){
    const leaf=new THREE.Mesh(new THREE.SphereGeometry(.23,10,10),mat(i%2?0x547557:0x6d8c68));leaf.scale.set(.48,1.9,.5);leaf.position.set(6+Math.sin(i*2.4)*.18,.9+Math.cos(i)*.08,-2.6+Math.cos(i*2.4)*.18);leaf.rotation.z=Math.sin(i*2.4)*.65;leaf.rotation.x=Math.cos(i*2.4)*.65;desk.add(leaf);
  }
  obstacle(6,-2.6,.9,.9);
  box(desk,.8,.04,.8,-4.2, .06,2.4,0xd4b76b,.01);
  const pen=box(desk,.07,.065,1.05,-3.5,.08,2.3,0x27382e);pen.rotation.y=.25;
  box(desk,1.3,.16,1.6,1.9,.13,-.7,0xa29a7c,.04);label(desk,'NOTES',.85,.13,1.9,.217,-.8,'#364236',true);obstacle(1.9,-.7,1.3,1.6);
  // Miniature red sports car, with black roof, white stripes and four rubber wheels.
  const car=new THREE.Group();desk.add(car);
  box(car,.5,.17,.97,0,.17,0,C.red,.09);
  box(car,.49,.08,.86,0,.3,-.01,C.red,.06);
  box(car,.38,.19,.43,0,.38,-.08,0x1e3037,.07);
  box(car,.35,.025,.26,0,.48,-.09,C.red,.025);
  for(const x of [-.075,.075]){
    box(car,.043,.006,.27,x,.346,.30,C.white,.002);
    box(car,.043,.006,.16,x,.498,-.09,C.white,.002);
    box(car,.043,.006,.15,x,.346,-.36,C.white,.002);
  }
  const wheels=[];
  for(const x of [-.265,.265])for(const z of [-.3,.3]){
    const wheel=cylinder(car,.135,.095,x,.145,z,0x172021);wheel.rotation.z=Math.PI/2;wheels.push(wheel);
    const hub=cylinder(car,.067,.1,x,.145,z,0xa0a7a4);hub.rotation.z=Math.PI/2;
  }
  for(const x of [-.16,.16]){box(car,.12,.055,.025,x,.235,.49,0xffeac4,.015);box(car,.12,.04,.025,x,.235,-.49,0x9f251e,.01);}
  box(car,.58,.035,.13,0,.36,-.45,C.dark,.01);
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(.8,1.3),new THREE.MeshBasicMaterial({map:texture((ctx,w,h)=>{const g=ctx.createRadialGradient(w/2,h/2,10,w/2,h/2,w/2);g.addColorStop(0,'#17231c70');g.addColorStop(1,'#17231c00');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);},128,128),transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.035;car.add(shadow);
  const target=new THREE.Vector3(0,3,0);
  let height=4.6, cameraMode=0;
  function resize(){
    const w=container.clientWidth,h=container.clientHeight,aspect=w/h;
    renderer.setSize(w,h);
    const scale=aspect<.9?17:11.7;
    const offset=aspect<.9?0:-4.9;
    camera.left=-scale*aspect+offset;camera.right=scale*aspect+offset;camera.top=scale;camera.bottom=-scale;camera.updateProjectionMatrix();
  }
  resize();window.addEventListener('resize',resize);
  return {
    renderer, scene, car, obstacles,
    setHeight(cm){height=4.6+(cm-75)*.048;},
    setCamera(mode){cameraMode=mode;},
    update(state,dt,elapsed,racing){
      desk.position.y=THREE.MathUtils.damp(desk.position.y,height,5,dt);
      legs.forEach(leg=>{const top=desk.position.y-.6;leg.scale.y=(top-2)/2.7;leg.position.y=2+(top-2)/2;});
      car.position.set(state.x,.055,state.z);car.rotation.y=state.angle;
      car.rotation.z=THREE.MathUtils.damp(car.rotation.z,Math.sin(elapsed*25)*Math.abs(state.speed)*.001,8,dt);
      wheels.forEach(w=>{w.rotation.x+=state.speed*dt*5;});
      gates.forEach((g,i)=>g.material.color.setHex(i===state.nextCheckpoint&&racing?0xffce6c:0xa8aaa0));
      const mobile=container.clientWidth<700;
      if(cameraMode===1){
        const desired=new THREE.Vector3(state.x-Math.sin(state.angle)*7,desk.position.y+6,state.z-Math.cos(state.angle)*7);
        camera.position.lerp(desired,1-Math.exp(-3*dt));target.lerp(new THREE.Vector3(state.x,desk.position.y,state.z),1-Math.exp(-5*dt));
        const aspect=container.clientWidth/container.clientHeight,s=mobile?7:6;
        camera.left=-s*aspect;camera.right=s*aspect;camera.top=s;camera.bottom=-s;camera.updateProjectionMatrix();
      }else{
        camera.position.lerp(new THREE.Vector3(21,23,29),1-Math.exp(-4*dt));
        target.lerp(new THREE.Vector3(0,mobile?4.7:3,0),1-Math.exp(-4*dt));
        const aspect=container.clientWidth/container.clientHeight,s=mobile?17:11.7,offset=mobile?0:racing?0:-4.9;
        camera.left=THREE.MathUtils.damp(camera.left,-s*aspect+offset,4,dt);camera.right=THREE.MathUtils.damp(camera.right,s*aspect+offset,4,dt);camera.top=s;camera.bottom=-s;camera.updateProjectionMatrix();
      }
      camera.lookAt(target);renderer.render(scene,camera);
    }
  };
}
