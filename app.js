import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';

const RADII = [
  20,      // 0: ラ   φ40mm
  19.375,  // 1: ソ#  φ38.75mm
  18.75,   // 2: ソ   φ37.5mm
  18.333,  // 3: ファ# φ36.67mm
  17.917,  // 4: ファ  φ35.83mm
  17.5,    // 5: ミ   φ35mm
  16.875,  // 6: レ#  φ33.75mm
  16.25,   // 7: レ   φ32.5mm
  15.625,  // 8: ド#  φ31.25mm
  15,      // 9: ド   φ30mm
];
const HOLE_HALF = 5.25;
const THICKNESS = 1.8;
const SUB = 8;

const NOTE_COLORS  = ['#ef4444','#f97316','#fb923c','#eab308','#a3e635','#84cc16','#22c55e','#06b6d4','#3b82f6','#8b5cf6'];
const NOTE_SOLFEGE = ['ラ','ソ#','ソ','ファ#','ファ','ミ','レ#','レ','ド#','ド'];
const NOTE_FREQ    = [440, 415, 392, 370, 349, 330, 311, 294, 277, 262];

// キラキラ星 25 beats: ド ド ソ ソ ラ ラ ソ ソ | ファ ファ ミ ミ レ レ ド ド | ソ ソ ファ ファ ミ ミ レ レ レ
const DEFAULT_MELODY = [9,9,2,2,0,0,2,2, 4,4,5,5,7,7,9,9, 2,2,4,4,5,5,7,7,7];

let melody = [...DEFAULT_MELODY];

function melodyToRadii() {
  let last = RADII[0];
  return melody.map(n => n >= 0 ? (last = RADII[n]) : last);
}

// ── Three.js ─────────────────────────────────────────────
const container = document.getElementById('preview-container');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0xe8f0f8);
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, container.clientWidth / container.clientHeight, 0.1, 1000);
camera.position.set(35, 42, -48);
camera.lookAt(0, 0, 0);

scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
keyLight.position.set(50, 70, 50);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xb0c8ff, 0.4);
fillLight.position.set(-40, 10, -30);
scene.add(fillLight);
const rimLight = new THREE.DirectionalLight(0xffffff, 0.2);
rimLight.position.set(0, -30, -50);
scene.add(rimLight);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.target.set(0, 0, 0);
controls.minDistance = 20;
controls.maxDistance = 200;
controls.update();

let meshObj = null, edgeObj = null, frontMarkerObj = null;

// 表面マーカー用パラメータ（正三角形の突起）
const MRK_MS = 1.5;                        // 半辺長 mm（辺長 3mm）
const MRK_MH = MRK_MS * Math.sqrt(3);      // 三角形の高さ
const MRK_CX = HOLE_HALF + 2.5;            // 表面マーカー中心 X 座標
const MRK_RH = 0.4;                        // 突起高さ mm

function buildGeometry() {
  if (meshObj)        { scene.remove(meshObj);        meshObj.geometry.dispose(); }
  if (edgeObj)        { scene.remove(edgeObj);        edgeObj.geometry.dispose(); }
  if (frontMarkerObj) { scene.remove(frontMarkerObj); frontMarkerObj.geometry.dispose(); }

  const seq = melodyToRadii();
  const N = seq.length;
  const shape = new THREE.Shape();
  shape.moveTo(seq[0], 0);
  for (let i = 0; i < N; i++) {
    const a1 = 2 * Math.PI * i / N, a2 = 2 * Math.PI * (i + 1) / N;
    const r = seq[i], rn = seq[(i + 1) % N];
    for (let j = 1; j <= SUB; j++) {
      const a = a1 + (a2 - a1) * j / SUB;
      shape.lineTo(r * Math.cos(a), r * Math.sin(a));
    }
    if (Math.abs(r - rn) > 1e-9) shape.lineTo(rn * Math.cos(a2), rn * Math.sin(a2));
  }
  shape.closePath();

  const hole = new THREE.Path();
  hole.moveTo(-HOLE_HALF, -HOLE_HALF);
  hole.lineTo( HOLE_HALF, -HOLE_HALF);
  hole.lineTo( HOLE_HALF,  HOLE_HALF);
  hole.lineTo(-HOLE_HALF,  HOLE_HALF);
  hole.closePath();
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, { depth: THICKNESS, bevelEnabled: false });
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: 0x7ab4d0, metalness: 0.25, roughness: 0.4 });
  meshObj = new THREE.Mesh(geo, mat);
  scene.add(meshObj);
  edgeObj = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 18), new THREE.LineBasicMaterial({ color: 0x1e40af }));
  scene.add(edgeObj);

  // 表面マーカー：正三角形の突起（+X 方向が頂点）
  const fmShape = new THREE.Shape();
  fmShape.moveTo(MRK_CX - MRK_MH / 3, -MRK_MS);
  fmShape.lineTo(MRK_CX - MRK_MH / 3, +MRK_MS);
  fmShape.lineTo(MRK_CX + 2 * MRK_MH / 3, 0);
  fmShape.closePath();
  const fmGeo = new THREE.ExtrudeGeometry(fmShape, { depth: MRK_RH, bevelEnabled: false });
  fmGeo.computeVertexNormals();
  frontMarkerObj = new THREE.Mesh(fmGeo, mat);
  frontMarkerObj.position.z = -MRK_RH;
  scene.add(frontMarkerObj);
}
buildGeometry();

window.addEventListener('resize', () => {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
});
(function animate() { requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); })();

// ── STL generation ────────────────────────────────────────
function generateSTL() {
  scene.updateMatrixWorld();
  return new STLExporter().parse(scene, { binary: false });
}

// ── SVG generation ────────────────────────────────────────
function generateSVG() {
  const seq = melodyToRadii();
  const N = seq.length;
  const f = v => v.toFixed(3);

  // 外周輪郭（STL と同じく段付きで生成）。SVG は y 軸下向きなので y を反転。
  let d = `M ${f(seq[0])} ${f(0)}`;
  for (let i = 0; i < N; i++) {
    const a1 = 2 * Math.PI * i / N, a2 = 2 * Math.PI * (i + 1) / N;
    const r = seq[i], rn = seq[(i + 1) % N];
    for (let j = 1; j <= SUB; j++) {
      const a = a1 + (a2 - a1) * j / SUB;
      d += ` L ${f(r * Math.cos(a))} ${f(-r * Math.sin(a))}`;
    }
    if (Math.abs(r - rn) > 1e-9) d += ` L ${f(rn * Math.cos(a2))} ${f(-rn * Math.sin(a2))}`;
  }
  d += ' Z';

  // 中央穴（+X 側に V 溝マーカー）。evenodd で抜く。
  const h = HOLE_HALF, gw = 1.0, gd = 1.5;
  const hole = [[-h,-h],[h,-h],[h,-gw],[h+gd,0],[h,gw],[h,h],[-h,h]];
  let hd = `M ${f(hole[0][0])} ${f(-hole[0][1])}`;
  for (let k = 1; k < hole.length; k++) hd += ` L ${f(hole[k][0])} ${f(-hole[k][1])}`;
  hd += ' Z';

  const R = RADII[0] + 0.5; // 余白付き半径
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${f(2*R)}mm" height="${f(2*R)}mm" viewBox="${f(-R)} ${f(-R)} ${f(2*R)} ${f(2*R)}">
  <path d="${d} ${hd}" fill="#7ab4d0" fill-rule="evenodd" stroke="#1e40af" stroke-width="0.2"/>
</svg>
`;
}

// ── Piano roll ────────────────────────────────────────────
const pianoRoll = document.getElementById('piano-roll');
let prCells = [];

function buildPianoRoll() {
  pianoRoll.innerHTML = '';
  prCells = [];
  pianoRoll.style.gridTemplateColumns = `48px repeat(${melody.length}, 1fr)`;

  pianoRoll.appendChild(document.createElement('div'));
  for (let b = 0; b < melody.length; b++) {
    const el = document.createElement('div');
    el.className = 'pr-beat-num';
    el.textContent = b + 1;
    pianoRoll.appendChild(el);
  }

  for (let n = 0; n < NOTE_SOLFEGE.length; n++) {
    const key = document.createElement('div');
    key.className = 'pr-key';
    key.style.background = NOTE_COLORS[n];
    key.textContent = NOTE_SOLFEGE[n];
    pianoRoll.appendChild(key);

    for (let b = 0; b < melody.length; b++) {
      const cell = document.createElement('div');
      cell.className = 'pr-cell';
      cell.addEventListener('click', () => {
        melody[b] = melody[b] === n ? -1 : n;
        refreshPianoRoll();
        buildGeometry();
      });
      pianoRoll.appendChild(cell);
      prCells.push(cell);
    }
  }
  refreshPianoRoll();
}

function refreshPianoRoll() {
  const N = NOTE_SOLFEGE.length;
  for (let n = 0; n < N; n++)
    for (let b = 0; b < melody.length; b++)
      prCells[n * melody.length + b].style.background = melody[b] === n ? NOTE_COLORS[n] : '#dde3ec';
}

buildPianoRoll();

// ── Audio preview ─────────────────────────────────────────
let audioCtx = null;

document.getElementById('clearBtn').addEventListener('click', () => {
  melody.fill(-1);
  refreshPianoRoll();
  buildGeometry();
});

document.getElementById('playBtn').addEventListener('click', () => {
  audioCtx ??= new AudioContext();
  const bpm = 150, beat = 60 / bpm, now = audioCtx.currentTime + 0.05;
  const btn = document.getElementById('playBtn');
  btn.disabled = true;
  melody.forEach((n, i) => {
    if (n < 0) return;
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.type = 'triangle';
    osc.frequency.value = NOTE_FREQ[n];
    const t0 = now + i * beat;
    gain.gain.setValueAtTime(0.25, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + beat * 0.9);
    osc.start(t0); osc.stop(t0 + beat);
  });
  setTimeout(() => { btn.disabled = false; }, melody.length * beat * 1000 + 200);
});

// ── Download ──────────────────────────────────────────────
function download(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  Object.assign(document.createElement('a'), { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
}

document.getElementById('downloadBtn').addEventListener('click', () =>
  download(generateSTL(), 'melody_disk.stl', 'text/plain'));

document.getElementById('downloadSvgBtn').addEventListener('click', () =>
  download(generateSVG(), 'melody_disk.svg', 'image/svg+xml'));
