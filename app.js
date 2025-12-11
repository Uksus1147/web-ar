import * as THREE from './libs/three.module.js';
import { GLTFLoader } from './libs/GLTFLoader.js';
import { ARButton } from './libs/ARButton.js';
import Stats from './libs/stats.module.js';

let camera, scene, renderer;
let model = null;
let stats;
let currentModelName = 'low';
const modelPolyCount = { low: 0, mid: 0, high: 0 };

init();
animate();

function init() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);

  // Свет
  const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1.5);
  scene.add(light);

  // FPS
  stats = new Stats();
  stats.dom.style.position = 'absolute';
  stats.dom.style.top = '10px';
  stats.dom.style.right = '10px';
  stats.dom.style.left = 'auto';
  document.body.appendChild(stats.dom);

  // Кнопка AR
  const arButton = ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] });
  document.getElementById('startAR').replaceWith(arButton);

  // Смена модели
  document.getElementById('modelSelect').addEventListener('change', (e) => {
    currentModelName = e.target.value;
    loadModel();
  });

  loadModel();
  window.addEventListener('resize', onWindowResize);
}

function loadModel() {
  if (model) scene.remove(model);

  const loader = new GLTFLoader();
  loader.load(`./models/${currentModelName}.glb`, (gltf) => {
    model = gltf.scene;

    // Автомасштаб
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);
    const maxDim = Math.max(size.x, size.y, size.z);
    model.scale.setScalar(1.5 / maxDim);
    model.position.y = -0.5;
    model.position.z = -1.5;

    scene.add(model);

    // Подсчёт полигонов
    let polyCount = 0;
    model.traverse((child) => {
      if (child.isMesh) {
        const geo = child.geometry;
        if (geo.index) polyCount += geo.index.count / 3;
        else if (geo.attributes.position) polyCount += geo.attributes.position.count / 3;
      }
    });
    modelPolyCount[currentModelName] = Math.round(polyCount);

    updateInfo();
  });
}

function updateInfo() {
  const fps = stats.fps ? Math.round(stats.fps) : 0;
  document.getElementById('info').innerHTML = `
    FPS: ${fps}<br>
    Полигонов: ${modelPolyCount[currentModelName] || '...'}
  `;
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  renderer.setAnimationLoop((time) => {
    stats.update();
    updateInfo();
    renderer.render(scene, camera);
  });
}