
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

const $ = id => document.getElementById(id);
const canvas = $("scene");
let renderer, scene, camera, clock, drone, ws, myId = "", roomId = "";
let mode = "pvp", started = false, paused = false, cinematic = true;
let hp = 100, speed = 0, yaw = 0, pitch = -0.15;
const keys = new Set();
const remote = new Map();
const particles = [];
const buildings = [];
const impacts = [];
let lastNet = 0, lastFrame = performance.now(), frames = 0, fps = 60;
let serverEndpoint = "";
let globalTimer = 0;
const SERVER_HTTP_PORT = 8000;

const state = {pos:new THREE.Vector3(0,18,20), vel:new THREE.Vector3(), yaw:0, pitch:-.15};
const target = {pos:new THREE.Vector3(), yaw:0, pitch:0};

function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
function showBootError(message){
  const b=$("boot");
  b.innerHTML=`<div class="boot-error">
    <div class="boot-error-title">SKYBREAK НЕ ЗАПУСТИЛСЯ</div>
    <div class="boot-error-text">${escapeHtml(message)}</div>
    <div class="boot-error-hint">Проверь интернет-соединение для загрузки Three.js и затем обнови страницу.</div>
    <button id="retryBoot">ПОВТОРИТЬ</button>
  </div>`;
  $("retryBoot").onclick=()=>location.reload();
}
async function boot(){
  try{
    if(!window.WebGLRenderingContext) throw new Error("Браузер не поддерживает WebGL.");
    await sleep(700);
    $("boot").classList.add("hidden");
    $("menu").classList.remove("hidden");
    $("lobbyStatus").textContent = "Сервер: проверка…";
    checkServer();
    refreshGlobal();
  }catch(e){
    showBootError(e.message||"Неизвестная ошибка");
  }
}
async function checkServer(){
  try{
    const r=await fetch("/health",{cache:"no-store"});
    if(!r.ok)throw new Error("HTTP "+r.status);
    const data=await r.json();
    $("lobbyStatus").textContent=`Сервер: ONLINE // ${data.players ?? 0} пилотов`;
    $("lobbyStatus").classList.add("ok");
    document.querySelector(".status-dot")?.classList.add("ok");
  }catch{
    $("lobbyStatus").textContent="Сервер: OFFLINE — запусти server.py";
  }
}
function normalizeEndpoint(raw){
  raw=(raw||"").trim();
  if(!raw) return location.hostname;
  raw=raw.replace(/^https?:\/\//,"").replace(/^wss?:\/\//,"").replace(/\/$/,"");
  return raw.split("/")[0];
}
function serverWsUrl(){
  let host=normalizeEndpoint(serverEndpoint);
  if(!host) return `${location.protocol==="https:"?"wss":"ws"}://${location.host}/ws`;
  const hasPort=host.match(/:\d+$/);
  const scheme=location.protocol==="https:"?"wss":"ws";
  return `${scheme}://${host}${hasPort?"":(location.port?":"+location.port:"")}/ws`;
}
function serverHttpUrl(){
  let host=normalizeEndpoint(serverEndpoint);
  if(!host) return "";
  const scheme=location.protocol==="https:"?"https":"http";
  return `${scheme}://${host}`;
}
async function refreshGlobal(){
  try{
    const base=serverEndpoint?serverHttpUrl():"";
    const r=await fetch(`${base}/api/global`,{cache:"no-store"});
    if(!r.ok)throw new Error("global");
    const data=await r.json();
    $("globalCount").textContent=`Пилоты мира: ${data.total_players ?? 0}`;
    $("globalUpdated").textContent=`SYNC ${new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}`;
    const list=(data.players||[]).slice(0,24);
    $("globalPlayers").innerHTML=list.length?list.map(p=>`<div class="global-row"><span>${escapeHtml(p.name)}</span><small>${escapeHtml(p.region||p.room||"ZONE")}</small></div>`).join(""):'<div class="empty-state">ЭФИР ПУСТ</div>';
  }catch{
    $("globalCount").textContent="Пилоты мира: —";
    $("globalUpdated").textContent="NO SIGNAL";
    $("globalPlayers").innerHTML='<div class="empty-state">НЕТ СИГНАЛА СЕТИ</div>';
  }
}
$("refreshGlobal").onclick=refreshGlobal;
setInterval(()=>{if(!started)refreshGlobal()},7000);

boot();

document.querySelectorAll(".mode").forEach(b=>b.onclick=()=>{document.querySelectorAll(".mode").forEach(x=>x.classList.remove("active"));b.classList.add("active");mode=b.dataset.mode});
$("create").onclick=()=>connect("create");
$("join").onclick=()=>connect("join");
$("ready").onclick=()=>send({type:"ready",ready:true});
$("start").onclick=()=>send({type:"start"});
$("back").onclick=()=>leaveLobby();
$("leave").onclick=()=>leaveLobby();

function connect(action){
  const name = $("name").value.trim() || "Pilot";
  serverEndpoint = $("server").value.trim();
  let rid = $("room").value.trim();
  if(action==="create" && !rid) rid=Math.random().toString(36).slice(2,8).toUpperCase();
  $("room").value=rid;
  const wsUrl=serverWsUrl();
  ws=new WebSocket(wsUrl);
  $("lobbyStatus").textContent=`Подключение: ${normalizeEndpoint(serverEndpoint) || location.hostname}…`;
  ws.onopen=()=>{
    $("lobbyStatus").textContent="Сеть: LINKED";
    send({type:"hello",name}, false);
    setTimeout(()=>send({type:action,room:rid,mode}),80);
  };
  ws.onmessage=e=>handle(JSON.parse(e.data));
  ws.onerror=()=>{$("lobbyStatus").textContent="Ошибка сетевого канала"};
  ws.onclose=()=>{$("lobbyStatus").textContent="Соединение закрыто"};
}
function send(obj, withName=true){
  if(ws && ws.readyState===1){if(withName)obj.name=$("name").value.trim()||"Pilot";ws.send(JSON.stringify(obj))}
}
function handle(m){
  if(m.type==="hello"){myId=m.id;return}
  if(m.type==="error"){alert(m.message);return}
  if(m.type==="room_state"){
    roomId=m.room;$("roomTitle").textContent=`ROOM // ${roomId}`;
    $("menu").classList.add("hidden");$("lobby").classList.remove("hidden");
    $("roster").innerHTML=m.players.map((p,i)=>`<div class="roster-row"><span>${escapeHtml(p.name)} ${i===0?'<span class="badge">HOST</span>':''}</span><span>${p.ready?"READY":"WAITING"} // ${escapeHtml(p.role||"pilot")}</span></div>`).join("");
    mode=m.mode;$("modeLabel").textContent=m.mode.toUpperCase();$("roomNet").textContent=serverEndpoint?normalizeEndpoint(serverEndpoint):location.hostname;
  }
  if(m.type==="start"){startGame(m.mode)}
  if(m.type==="player_state") { updateRemote(m); $("onlineHud").textContent=`${remote.size+1} PILOTS`; }
  if(m.type==="impact") impact(new THREE.Vector3(...m.pos),m.power);
}
function escapeHtml(s){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

function init3D(){
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:"high-performance"});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  scene=new THREE.Scene();scene.background=new THREE.Color(0x061018);scene.fog=new THREE.FogExp2(0x071019,.012);
  camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.1,1200);
  clock=new THREE.Clock();
  const hemi=new THREE.HemisphereLight(0x9bc9ff,0x182020,2.0);scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xffffff,4);sun.position.set(-120,180,80);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);scene.add(sun);
  makeWorld();makeDrone();
  addEventListener("resize",resize);addEventListener("keydown",e=>{keys.add(e.code);if(e.code==="Escape"){paused=!paused;$("pause").classList.toggle("hidden",!paused)}});addEventListener("keyup",e=>keys.delete(e.code));
  canvas.addEventListener("mousedown",e=>{if(e.button===0)arcadeStrike()});
  canvas.addEventListener("mousemove",e=>{if(document.pointerLockElement===canvas){yaw-=e.movementX*.0022;pitch-=e.movementY*.0018;pitch=THREE.MathUtils.clamp(pitch,-1.0,.55)}});
  canvas.addEventListener("click",()=>canvas.requestPointerLock?.());
  animate();
}
function makeWorld(){
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(1000,1000),new THREE.MeshStandardMaterial({color:0x101b20,roughness:1}));
  ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
  const grid=new THREE.GridHelper(1000,100,0x18303a,0x0c171d);grid.position.y=.03;scene.add(grid);
  // Dense procedural city: no target dots/markers, only physical architecture.
  for(let x=-180;x<=180;x+=24) for(let z=-180;z<=180;z+=24){
    if(Math.abs(x)<45 && Math.abs(z)<45) continue;
    const h=8+Math.random()*45,w=13+Math.random()*8,d=13+Math.random()*8;
    addBuilding(x,z,w,h,d);
  }
  const roadMat=new THREE.MeshStandardMaterial({color:0x171d21,roughness:.92});
  for(let i=-180;i<=180;i+=48){
    const r1=new THREE.Mesh(new THREE.BoxGeometry(1000,.08,10),roadMat);r1.position.set(0,.04,i);scene.add(r1);
    const r2=new THREE.Mesh(new THREE.BoxGeometry(10,.08,1000),roadMat);r2.position.set(i,.045,0);scene.add(r2);
  }
  const sky=new THREE.Mesh(new THREE.SphereGeometry(500,32,16),new THREE.MeshBasicMaterial({color:0x07141d,side:THREE.BackSide}));
  scene.add(sky);
}
function addBuilding(x,z,w,h,d){
  const group=new THREE.Group();
  const mat=new THREE.MeshStandardMaterial({color:new THREE.Color().setHSL(.55,.12,.12+Math.random()*.08),roughness:.7,metalness:.08});
  const body=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);body.position.y=h/2;body.castShadow=true;body.receiveShadow=true;group.add(body);
  const glass=new THREE.MeshStandardMaterial({color:0x163d4d,emissive:0x06151b,metalness:.35,roughness:.28});
  for(let y=5;y<h-2;y+=5){
    const win=new THREE.Mesh(new THREE.BoxGeometry(w*.82,.65,.08),glass);win.position.set(0,y,d/2+.03);group.add(win);
    const win2=win.clone();win2.position.z=-d/2-.03;group.add(win2);
  }
  group.position.set(x,0,z);scene.add(group);buildings.push({group,box:new THREE.Box3().setFromObject(body),hp:100});
}
function makeDrone(){
  drone=new THREE.Group();
  const dark=new THREE.MeshStandardMaterial({color:0x151d24,metalness:.7,roughness:.24});
  const body=new THREE.Mesh(new THREE.BoxGeometry(2.5,.7,3.8),dark);body.castShadow=true;drone.add(body);
  const nose=new THREE.Mesh(new THREE.ConeGeometry(.9,1.5,4),dark);nose.rotation.x=-Math.PI/2;nose.position.z=-2.3;nose.position.y=.05;drone.add(nose);
  const armMat=new THREE.MeshStandardMaterial({color:0x2c3941,metalness:.8,roughness:.22});
  for(const x of [-1.9,1.9])for(const z of [-1.1,1.1]){
    const arm=new THREE.Mesh(new THREE.BoxGeometry(2.2,.22,.28),armMat);arm.position.set(x/2,0,z);arm.rotation.y=x>0?.08:-.08;drone.add(arm);
    const rotor=new THREE.Mesh(new THREE.CylinderGeometry(.85,.85,.08,32),new THREE.MeshStandardMaterial({color:0x88d9ff,transparent:true,opacity:.42}));
    rotor.position.set(x,z?0:0,z);rotor.position.y=.35;drone.add(rotor);
  }
  scene.add(drone);
}
let cutsceneActive=false;
let cutsceneStart=0;
let cutsceneDrone;
function startGame(m){
  mode=m;started=true;paused=false;
  $("lobby").classList.add("hidden");$("game").classList.remove("hidden");
  $("modeLabelGame").textContent=m.toUpperCase();$("onlineHud").textContent=`${remote.size+1} PILOTS`;
  if(!renderer)init3D();
  state.pos.set(myId? -24:24,18,0);
  state.vel.set(0,0,0);
  beginCutscene();
}
function beginCutscene(){
  cutsceneActive=true;
  cutsceneStart=performance.now();
  $("cinematic").classList.remove("hidden");
  $("cinTitle").textContent="SKYBREAK";
  $("cinSub").textContent=mode==="PVP"?"OPERATION // DUEL":"OPERATION // CO-OP";
  $("cinHint").textContent="ЛКМ / ENTER — пропустить";
  if(!cutsceneDrone){
    cutsceneDrone=new THREE.Group();
    const mat=new THREE.MeshStandardMaterial({color:0x72e7ff,metalness:.75,roughness:.2});
    const body=new THREE.Mesh(new THREE.BoxGeometry(3,.6,4.2),mat);
    body.castShadow=true; cutsceneDrone.add(body);
    const nose=new THREE.Mesh(new THREE.ConeGeometry(.85,1.4,4),mat);
    nose.rotation.x=-Math.PI/2;nose.position.z=-2.35;cutsceneDrone.add(nose);
    scene.add(cutsceneDrone);
  }
  cutsceneDrone.visible=true;
  addEventListener("keydown",skipCutsceneOnce,{once:true});
  $("cinematic").onclick=skipCutscene;
}
function skipCutsceneOnce(e){
  if(e.code==="Enter"||e.code==="Space"||e.code==="Escape") skipCutscene();
  else beginCutscene();
}
function skipCutscene(){
  if(!cutsceneActive)return;
  cutsceneActive=false;
  $("cinematic").classList.add("hidden");
  if(cutsceneDrone)cutsceneDrone.visible=false;
  $("cinematic").onclick=null;
  camera.position.copy(state.pos).add(new THREE.Vector3(0,4,9));
}
function updateCutscene(now){
  if(!cutsceneActive)return;
  const t=(now-cutsceneStart)/1000;
  const duration=6.5;
  const p=Math.min(1,t/duration);
  if(t>=duration){skipCutscene();return;}
  const radius=78-35*p;
  const angle=-1.8+p*2.8;
  const center=new THREE.Vector3(0,15,0);
  camera.position.set(Math.cos(angle)*radius,22+Math.sin(p*Math.PI)*18,Math.sin(angle)*radius);
  camera.lookAt(center);
  if(cutsceneDrone){
    cutsceneDrone.position.set(
      -55+95*p,
      28+Math.sin(p*Math.PI*2)*7,
      25-50*p
    );
    cutsceneDrone.rotation.y=angle+Math.PI;
    cutsceneDrone.rotation.z=Math.sin(p*Math.PI*4)*.08;
  }
}
function updateRemote(m){
  if(m.id===myId)return;
  let r=remote.get(m.id);
  if(!r){r=new THREE.Group();const mat=new THREE.MeshStandardMaterial({color:0xff7b52,metalness:.7,roughness:.25});const b=new THREE.Mesh(new THREE.BoxGeometry(2.5,.7,3.8),mat);r.add(b);scene.add(r);remote.set(m.id,r)}
  r.position.set(...m.pos);r.rotation.y=m.yaw;r.userData.target=m.pos;r.userData.targetYaw=m.yaw;
}
function update(dt){
  if(!started||paused)return;
  if(cutsceneActive){
    updateCutscene(performance.now());
    return;
  }
  const forward=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw));
  const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
  const input=new THREE.Vector3();
  if(keys.has("KeyW"))input.add(forward);
  if(keys.has("KeyS"))input.sub(forward);
  if(keys.has("KeyD"))input.add(right);
  if(keys.has("KeyA"))input.sub(right);
  if(keys.has("Space"))input.y+=.65;
  if(keys.has("ShiftLeft")||keys.has("ShiftRight"))input.y-=.65;
  if(input.lengthSq()>0)input.normalize();
  state.vel.lerp(input.multiplyScalar(26),1-Math.pow(.002,dt));
  state.pos.addScaledVector(state.vel,dt);
  state.pos.y=THREE.MathUtils.clamp(state.pos.y,5,95);
  state.pos.x=THREE.MathUtils.clamp(state.pos.x,-470,470);state.pos.z=THREE.MathUtils.clamp(state.pos.z,-470,470);
  // Camera follows drone; this is intentionally arcade-like, not a real flight model.
  drone.position.lerp(state.pos,1-Math.pow(.0001,dt));drone.rotation.y=yaw;drone.rotation.z=-state.vel.x*.018;
  const camOffset=new THREE.Vector3(0,4.2,9).applyAxisAngle(new THREE.Vector3(0,1,0),yaw);
  camera.position.lerp(state.pos.clone().add(camOffset),1-Math.pow(.00001,dt));
  const look=state.pos.clone().add(forward.multiplyScalar(35)).add(new THREE.Vector3(0,pitch*20,0));
  camera.lookAt(look);
  speed=state.vel.length();$("speed").textContent=`SPD ${speed.toFixed(0)}`;$("alt").textContent=`ALT ${state.pos.y.toFixed(0)}`;
  hp=Math.max(0,hp);$("hpbar").style.width=hp+"%";$("hptext").textContent=hp;
  for(const r of remote.values()){if(r.userData.target){const t=new THREE.Vector3(...r.userData.target);r.position.lerp(t,Math.min(1,dt*8));if(Number.isFinite(r.userData.targetYaw))r.rotation.y=THREE.MathUtils.lerp(r.rotation.y,r.userData.targetYaw,Math.min(1,dt*7))}}
  if(performance.now()-lastNet>70){send({type:"state",pos:state.pos.toArray(),yaw,pitch,hp});lastNet=performance.now()}
}
function arcadeStrike(){
  if(!started||paused)return;
  const dir=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  const origin=state.pos.clone().add(dir.multiplyScalar(2));
  const ray=new THREE.Raycaster(origin,dir.normalize(),0,110);
  const hits=ray.intersectObjects(scene.children,true).filter(h=>h.object.type==="Mesh");
  if(hits.length){const p=hits[0].point;impact(p,1.0);send({type:"impact",pos:p.toArray(),power:1})}
}
function impact(pos,power){
  for(let i=0;i<28;i++){
    const m=new THREE.Mesh(new THREE.SphereGeometry(.12+Math.random()*.22,6,6),new THREE.MeshBasicMaterial({color:i%2?0xff9c52:0x9fefff,transparent:true}));
    m.position.copy(pos);m.userData.v=new THREE.Vector3((Math.random()-.5)*14,Math.random()*14,(Math.random()-.5)*14);m.userData.life=1.0+Math.random();
    scene.add(m);particles.push(m);
  }
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.5, .08, 8, 32),new THREE.MeshBasicMaterial({color:0xff9c52,transparent:true}));
  ring.position.copy(pos);ring.rotation.x=Math.PI/2;ring.userData.life=1;scene.add(ring);impacts.push(ring);
}
function particlesUpdate(dt){
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.position.addScaledVector(p.userData.v,dt);p.userData.v.y-=10*dt;p.userData.life-=dt;p.material.opacity=Math.max(0,p.userData.life);if(p.userData.life<=0){scene.remove(p);particles.splice(i,1)}}
  for(let i=impacts.length-1;i>=0;i--){const r=impacts[i];r.userData.life-=dt;r.scale.multiplyScalar(1+dt*4);r.material.opacity=Math.max(0,r.userData.life);if(r.userData.life<=0){scene.remove(r);impacts.splice(i,1)}}
}
let fpsStamp=performance.now();
function animate(){
  requestAnimationFrame(animate);
  const now=performance.now();
  const dt=Math.min(.05,(now-lastFrame)/1000);
  lastFrame=now;
  frames++;
  if(now-fpsStamp>=1000){
    fps=Math.round(frames*1000/(now-fpsStamp));
    frames=0;fpsStamp=now;
  }
  $("fps").textContent=`${fps} FPS`;
  update(dt);
  particlesUpdate(dt);
  if(renderer)renderer.render(scene,camera);
}
function resize(){if(!renderer)return;renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}
function leaveLobby(){
  started=false;$("pause").classList.add("hidden");$("game").classList.add("hidden");$("lobby").classList.add("hidden");$("menu").classList.remove("hidden");
  if(ws){ws.close();ws=null}
}
