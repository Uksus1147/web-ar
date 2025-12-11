import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.152.2/examples/jsm/loaders/GLTFLoader.js';
import { ARButton } from 'https://unpkg.com/three@0.152.2/examples/jsm/webxr/ARButton.js';

let scene, camera, renderer, reticle, controller, model;
let fpsDisplay = document.getElementById('fps');
let samples = [];
let measuring = false;

init();
animate();

function init(){
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera();

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);

  document.body.appendChild( ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] }) );
let hitTestSource = null;
let localSpace = null;

renderer.xr.addEventListener("sessionstart", async () => {
  const session = renderer.xr.getSession();

  const viewerSpace = await session.requestReferenceSpace("viewer");
  hitTestSource = await session.requestHitTestSource({ space: viewerSpace });

  localSpace = await session.requestReferenceSpace("local");

  session.addEventListener("end", () => {
    hitTestSource = null;
    localSpace = null;
  });
});

  // light
  const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
  scene.add(light);

  // reticle for placement
  const geometry = new THREE.RingGeometry(0.05, 0.07, 32).rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({color: 0x00ff00});
  reticle = new THREE.Mesh(geometry, material);
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  // controller for hit-test
  controller = renderer.xr.getController(0);
  scene.add(controller);

  // UI
  document.getElementById('startBtn').addEventListener('click', () => {
    // ARButton triggers session, so nothing else needed here
    startMeasurement();
  });
  document.getElementById('modelSelect').addEventListener('change', (e)=>{
    loadModel(e.target.value);
  });
  document.getElementById('exportBtn').addEventListener('click', exportCSV);

  // load default
  loadModel('models/model_low.glb');
}

function loadModel(path){
  const loader = new GLTFLoader();
  loader.load(path, gltf=>{
    if(model) scene.remove(model);
    model = gltf.scene;
    model.scale.set(0.5,0.5,0.5);
    model.position.set(0,0,0);
    scene.add(model);
  }, undefined, err=>console.error(err));
}

function startMeasurement(){
  samples = [];
  measuring = true;
  // warm-up 5s
  setTimeout(()=>{ measuring = true; }, 5000);
  // stop after 30s
  setTimeout(()=>{ measuring = false; }, 35000);
}

let lastTime = performance.now();
let frames = 0;
function animate(){
  renderer.setAnimationLoop(render);
}

function render(time, frame){
  // FPS
  frames++;
  if(time - lastTime >= 1000){
    const fps = Math.round((frames*1000)/(time-lastTime));
    fpsDisplay.textContent = `FPS: ${fps}`;
    if(measuring) samples.push({t:Date.now(), fps});
    frames = 0; lastTime = time;
  }

  // HIT TEST (ЭТО И ЕСТЬ AR!)
  if(frame && hitTestSource){
    const hitTestResults = frame.getHitTestResults(hitTestSource);
    if(hitTestResults.length > 0){
      const hit = hitTestResults[0];
      const pose = hit.getPose(localSpace);

      reticle.visible = true;
      reticle.matrix.fromArray(pose.transform.matrix);

      // ставим модель, если она ещё не поставлена
      controller.addEventListener("select", () => {
        if(model){
          model.position.setFromMatrixPosition(reticle.matrix);
        }
      });

    } else {
      reticle.visible = false;
    }
  }

  renderer.render(scene, camera);
}


function exportCSV(){
  if(samples.length===0){ alert('No samples'); return; }
  let csv = 'timestamp,fps\n' + samples.map(s=>`${s.t},${s.fps}`).join('\n');
  const blob = new Blob([csv], {type: 'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'fps_data.csv'; a.click();
  URL.revokeObjectURL(url);
}
