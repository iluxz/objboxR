// cube-engine.js — The Cube Rebuild (Three.js)
// audio, rendering, terminal, obj, reactor, and all the void

// ===== AUDIO =====
var bgm = null;
var bgmFile = 'drone2lp.wav';
var bgmVolume = 0.3;
var audioCtx = null;
var analyser = null;
var audioStarted = false;

function initAudio() {
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    bgm = new Audio(bgmFile);
    bgm.loop = true;
    bgm.volume = bgmVolume;
    const src = audioCtx.createMediaElementSource(bgm);
    src.connect(analyser);
    analyser.connect(audioCtx.destination);
  } catch (e) {
    console.warn('Audio init failed:', e);
  }
}

function playBgm() {
  if (bgm && !audioStarted) {
    bgm.play().catch(() => {});
    audioStarted = true;
  }
}

// ===== SCENE SETUP =====
var scene, camera, renderer;
var outerCube, innerCubes = [];
var particles = null;
var particleCount = 200;
var rotation = { x: 0, y: 0 };
var velocity = { x: 0, y: 0 };
var isDragging = false;
var lastMouse = { x: 0, y: 0 };
var zoom = 5;
var themes = [
  { name: 'void', bg: 0x000000, outer: 0x888888, inner: [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0xffffff, 0x888888] },
  { name: 'blood', bg: 0x1a0000, outer: 0x884444, inner: [0xff3333, 0xcc0000, 0x990000, 0xff6666, 0xcc3333, 0x993333, 0xff9999, 0x660000] },
  { name: 'ice', bg: 0x00001a, outer: 0x4488aa, inner: [0x66ccff, 0x3399ff, 0x0066cc, 0x99ddff, 0x66aadd, 0x3388cc, 0xccffff, 0x004488] },
  { name: 'toxic', bg: 0x001a00, outer: 0x448844, inner: [0x66ff66, 0x33cc33, 0x009900, 0x99ff99, 0x66dd66, 0x33aa33, 0xccffcc, 0x006600] },
  { name: 'void alt', bg: 0x000000, outer: 0x888888, inner: [0x888888, 0x666666, 0x444444, 0xaaaaaa, 0x777777, 0x555555, 0xbbbbbb, 0x333333] },
];
var currentTheme = 0;

function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(themes[currentTheme].bg);
  
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = zoom;
  
  const canvas = document.getElementById('main');
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  
  // Lights
  const ambient = new THREE.AmbientLight(0x404040, 0.5);
  scene.add(ambient);
  
  const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00];
  for (let i = 0; i < 4; i++) {
    const light = new THREE.PointLight(colors[i], 1, 100);
    light.position.set(
      Math.cos(i * Math.PI / 2) * 5,
      Math.sin(i * Math.PI / 2) * 5,
      3
    );
    scene.add(light);
  }
  
  // Outer cube
  const outerGeo = new THREE.BoxGeometry(4, 4, 4);
  const outerMat = new THREE.MeshPhongMaterial({
    color: themes[currentTheme].outer,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
    wireframe: false,
  });
  outerCube = new THREE.Mesh(outerGeo, outerMat);
  scene.add(outerCube);
  
  // Inner cubes
  const innerGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
  for (let i = 0; i < 8; i++) {
    const mat = new THREE.MeshPhongMaterial({
      color: themes[currentTheme].inner[i],
      emissive: themes[currentTheme].inner[i],
      emissiveIntensity: 0.2,
    });
    const cube = new THREE.Mesh(innerGeo, mat);
    const angle = (i / 8) * Math.PI * 2;
    const radius = 1.2;
    cube.position.set(
      Math.cos(angle) * radius,
      Math.sin(angle * 2) * 0.5,
      Math.sin(angle) * radius
    );
    innerCubes.push(cube);
    scene.add(cube);
  }
  
  // Particles
  const partGeo = new THREE.BufferGeometry();
  const partPos = new Float32Array(particleCount * 3);
  const partCol = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    partPos[i * 3] = (Math.random() - 0.5) * 8;
    partPos[i * 3 + 1] = (Math.random() - 0.5) * 8;
    partPos[i * 3 + 2] = (Math.random() - 0.5) * 8;
    const c = new THREE.Color().setHSL(Math.random() * 0.3 + 0.5, 1, 0.5);
    partCol[i * 3] = c.r;
    partCol[i * 3 + 1] = c.g;
    partCol[i * 3 + 2] = c.b;
  }
  partGeo.setAttribute('position', new THREE.BufferAttribute(partPos, 3));
  partGeo.setAttribute('color', new THREE.BufferAttribute(partCol, 3));
  const partMat = new THREE.PointsMaterial({
    size: 0.05,
    vertexColors: true,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
  });
  particles = new THREE.Points(partGeo, partMat);
  scene.add(particles);
  
  window.addEventListener('resize', onResize);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ===== INTERACTION =====
function setupInteraction() {
  const canvas = renderer.domElement;
  
  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastMouse = { x: e.clientX, y: e.clientY };
    document.body.classList.add('dragging');
  });
  
  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastMouse.x;
    const dy = e.clientY - lastMouse.y;
    velocity.x = dx * 0.005;
    velocity.y = dy * 0.005;
    rotation.y += velocity.x;
    rotation.x += velocity.y;
    lastMouse = { x: e.clientX, y: e.clientY };
  });
  
  window.addEventListener('mouseup', () => {
    isDragging = false;
    document.body.classList.remove('dragging');
  });
  
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoom += e.deltaY * 0.001;
    zoom = Math.max(2, Math.min(15, zoom));
    camera.position.z = zoom;
  }, { passive: false });
  
  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (e.key === ' ') {
      e.preventDefault();
      // toggle rotation
    }
    if (e.key >= '1' && e.key <= '5') {
      currentTheme = parseInt(e.key) - 1;
      applyTheme();
    }
    if (e.key === '`' || e.key === '~') {
      toggleTerminal();
    }
  });
}

function applyTheme() {
  const t = themes[currentTheme];
  scene.background = new THREE.Color(t.bg);
  outerCube.material.color.set(t.outer);
  innerCubes.forEach((cube, i) => {
    cube.material.color.set(t.inner[i]);
    cube.material.emissive.set(t.inner[i]);
  });
  document.getElementById('themeIndicator').textContent = 'theme: ' + t.name;
}

// ===== ANIMATION LOOP =====
var clock = new THREE.Clock();
var fps = 0;
var frameCount = 0;
var lastFpsTime = 0;

function animate() {
  requestAnimationFrame(animate);
  
  const delta = clock.getDelta();
  const time = clock.getElapsedTime();
  
  // Momentum
  if (!isDragging) {
    velocity.x *= 0.95;
    velocity.y *= 0.95;
    rotation.y += velocity.x;
    rotation.x += velocity.y;
  }
  
  // Apply rotation
  if (outerCube) {
    outerCube.rotation.x = rotation.x;
    outerCube.rotation.y = rotation.y;
  }
  
  // Inner cubes orbit
  innerCubes.forEach((cube, i) => {
    const angle = (i / 8) * Math.PI * 2 + time * 0.3;
    const radius = 1.2;
    cube.position.x = Math.cos(angle) * radius;
    cube.position.z = Math.sin(angle) * radius;
    cube.position.y = Math.sin(angle * 2) * 0.3;
    cube.rotation.x = time * 0.5 + i;
    cube.rotation.y = time * 0.3 + i;
    
    // Audio reactivity
    if (analyser) {
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      const level = data[i * 4] / 255;
      cube.material.emissiveIntensity = 0.2 + level * 0.3;
    }
  });
  
  // Particles
  if (particles) {
    const pos = particles.geometry.attributes.position.array;
    for (let i = 0; i < particleCount; i++) {
      pos[i * 3 + 1] += Math.sin(time + i) * 0.001;
    }
    particles.geometry.attributes.position.needsUpdate = true;
    particles.rotation.y = time * 0.05;
  }
  
  // FPS counter
  frameCount++;
  if (time - lastFpsTime >= 1) {
    fps = frameCount;
    frameCount = 0;
    lastFpsTime = time;
    document.getElementById('stats').textContent = 'fps: ' + fps;
  }
  
  // Clock
  const now = new Date();
  document.getElementById('clock').textContent = 
    now.getHours().toString().padStart(2, '0') + ':' +
    now.getMinutes().toString().padStart(2, '0') + ':' +
    now.getSeconds().toString().padStart(2, '0');
  
  renderer.render(scene, camera);
}

// ===== TERMINAL =====
var termOutput = document.getElementById('termOutput');
var termInput = document.getElementById('termInput');
var termHistory = [];
var termHistIdx = -1;

function cubePrint(text) {
  const line = document.createElement('div');
  line.textContent = text;
  termOutput.appendChild(line);
  termOutput.scrollTop = termOutput.scrollHeight;
}

function cubeError(text) {
  const line = document.createElement('div');
  line.style.color = '#ff4444';
  line.textContent = text;
  termOutput.appendChild(line);
  termOutput.scrollTop = termOutput.scrollHeight;
}

function cubeOk(text) {
  const line = document.createElement('div');
  line.style.color = '#44ff44';
  line.textContent = text;
  termOutput.appendChild(line);
  termOutput.scrollTop = termOutput.scrollHeight;
}

function toggleTerminal() {
  const term = document.getElementById('terminal');
  term.style.display = term.style.display === 'none' ? 'block' : 'none';
  if (term.style.display === 'block') termInput.focus();
}

// ===== OBJ (the void's primary interface) =====
var objLines = [
  '...huh. nothing to do.',
  'maybe I will reorganize the nothing. again.',
  '...is that dust? that dust is new. exciting.',
  'day 4000 of no intruders. bliss. mostly.',
  '...did i leave the void on? i AM the void.',
];
var objIdx = 0;

function objSpeak(text) {
  const bar = document.getElementById('objBar');
  const objText = document.getElementById('objText');
  bar.classList.add('visible');
  objText.textContent = '';
  let i = 0;
  const interval = setInterval(() => {
    if (i < text.length) {
      objText.textContent += text[i];
      i++;
    } else {
      clearInterval(interval);
      setTimeout(() => bar.classList.remove('visible'), 4000);
    }
  }, 60);
}

function objIdle() {
  if (Math.random() < 0.3) {
    objSpeak(objLines[Math.floor(Math.random() * objLines.length)]);
  }
}

// ===== INIT =====
function init() {
  initScene();
  setupInteraction();
  animate();
  
  // Terminal input
  termInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const cmd = termInput.value.trim();
      termInput.value = '';
      if (cmd) {
        termHistory.push(cmd);
        termHistIdx = termHistory.length;
        cubePrint('> ' + cmd);
        executeCommand(cmd);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (termHistIdx > 0) {
        termHistIdx--;
        termInput.value = termHistory[termHistIdx];
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (termHistIdx < termHistory.length - 1) {
        termHistIdx++;
        termInput.value = termHistory[termHistIdx];
      } else {
        termHistIdx = termHistory.length;
        termInput.value = '';
      }
    }
  });
  
  // Obj idle chatter
  setInterval(objIdle, 18000);
  
  // Play audio on first interaction
  document.addEventListener('click', playBgm, { once: true });
  document.addEventListener('keydown', playBgm, { once: true });
}

function executeCommand(cmd) {
  const parts = cmd.split(' ');
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);
  
  switch (command) {
    case 'help':
      cubePrint('commands: help, clear, obj, void, ping, cube, theme, particles, time, status');
      break;
    case 'clear':
      termOutput.innerHTML = '';
      break;
    case 'obj':
      objSpeak('...huh. you called?');
      break;
    case 'void':
      cubePrint('the void is watching. it is always watching.');
      break;
    case 'ping':
      cubePrint('pong. (the void does not do pong. i do pong.)');
      break;
    case 'cube':
      cubePrint('i am the cube. the cube is me. we are one. (not really. i am better.)');
      break;
    case 'theme':
      if (args[0] && args[0] >= 1 && args[0] <= 5) {
        currentTheme = parseInt(args[0]) - 1;
        applyTheme();
        cubeOk('theme changed to ' + themes[currentTheme].name);
      } else {
        cubePrint('usage: theme 1-5');
      }
      break;
    case 'particles':
      cubePrint('particles: ' + particleCount);
      break;
    case 'time':
      cubePrint(new Date().toString());
      break;
    case 'status':
      cubePrint('cube status: operational. obj status: bored. void status: present.');
      break;
    default:
      cubePrint('unknown command: ' + command + '. type help.');
  }
}

// Start
init();