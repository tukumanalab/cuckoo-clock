import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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

function sqPt(a) {
  const c = Math.cos(a), s = Math.sin(a), m = Math.max(Math.abs(c), Math.abs(s));
  return [HOLE_HALF * c / m, HOLE_HALF * s / m];
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
camera.position.set(35, 42, 48);
camera.lookAt(0, 0, 1);

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
controls.target.set(0, 0, 1);
controls.minDistance = 20;
controls.maxDistance = 200;
controls.update();

let meshObj = null, edgeObj = null, markerObj = null;

// 表面マーカー用パラメータ（正三角形の突起）
const MRK_MS = 1.5;                        // 半辺長 mm（辺長 3mm）
const MRK_MH = MRK_MS * Math.sqrt(3);      // 三角形の高さ
const MRK_CY = HOLE_HALF + 2.5;            // 中心 Y 座標（穴の上方）
const MRK_RH = 0.4;                        // 突起高さ mm

function buildGeometry() {
  if (meshObj)  { scene.remove(meshObj);  meshObj.geometry.dispose(); }
  if (edgeObj)  { scene.remove(edgeObj);  edgeObj.geometry.dispose(); }
  if (markerObj){ scene.remove(markerObj);markerObj.geometry.dispose(); }

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
  const gw = 1.0, gd = 1.5;
  hole.moveTo(-HOLE_HALF, -HOLE_HALF);
  hole.lineTo( HOLE_HALF, -HOLE_HALF);
  hole.lineTo( HOLE_HALF, -gw);
  hole.lineTo( HOLE_HALF + gd, 0);
  hole.lineTo( HOLE_HALF,  gw);
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

  // 表面マーカー：正三角形の突起（△、+Y 方向が頂点）
  const mShape = new THREE.Shape();
  mShape.moveTo(-MRK_MS, MRK_CY - MRK_MH / 3);
  mShape.lineTo( MRK_MS, MRK_CY - MRK_MH / 3);
  mShape.lineTo(0,       MRK_CY + 2 * MRK_MH / 3);
  mShape.closePath();
  const mGeo = new THREE.ExtrudeGeometry(mShape, { depth: MRK_RH, bevelEnabled: false });
  mGeo.computeVertexNormals();
  markerObj = new THREE.Mesh(mGeo, mat);
  markerObj.position.z = THICKNESS;
  scene.add(markerObj);
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
  const t = THICKNESS, hh = HOLE_HALF;
  const seq = melodyToRadii();
  const N = seq.length;
  const lines = ['solid disk'];

  function facet(n, v1, v2, v3) {
    lines.push(
      `  facet normal ${n[0].toFixed(6)} ${n[1].toFixed(6)} ${n[2].toFixed(6)}`,
      '    outer loop',
      `      vertex ${v1[0].toFixed(6)} ${v1[1].toFixed(6)} ${v1[2].toFixed(6)}`,
      `      vertex ${v2[0].toFixed(6)} ${v2[1].toFixed(6)} ${v2[2].toFixed(6)}`,
      `      vertex ${v3[0].toFixed(6)} ${v3[1].toFixed(6)} ${v3[2].toFixed(6)}`,
      '    endloop',
      '  endfacet'
    );
  }

  for (let i = 0; i < N; i++) {
    const r = seq[i], rn = seq[(i + 1) % N];
    const as = 2 * Math.PI * i / N, ae = 2 * Math.PI * (i + 1) / N;

    for (let j = 0; j < SUB; j++) {
      const a1 = as + (ae - as) * j / SUB, a2 = as + (ae - as) * (j + 1) / SUB;
      const ox1 = r * Math.cos(a1), oy1 = r * Math.sin(a1);
      const ox2 = r * Math.cos(a2), oy2 = r * Math.sin(a2);
      const [ix1, iy1] = sqPt(a1), [ix2, iy2] = sqPt(a2);
      const deg = Math.abs(ix1 - ix2) < 1e-9 && Math.abs(iy1 - iy2) < 1e-9;

      facet([0,0,1],  [ox1,oy1,t], [ox2,oy2,t], [ix2,iy2,t]);
      if (!deg) facet([0,0,1],  [ox1,oy1,t], [ix2,iy2,t], [ix1,iy1,t]);
      facet([0,0,-1], [ox1,oy1,0], [ix2,iy2,0], [ox2,oy2,0]);
      if (!deg) facet([0,0,-1], [ox1,oy1,0], [ix1,iy1,0], [ix2,iy2,0]);

      const nx = Math.cos((a1 + a2) / 2), ny = Math.sin((a1 + a2) / 2);
      facet([nx,ny,0], [ox1,oy1,0], [ox2,oy2,0], [ox1,oy1,t]);
      facet([nx,ny,0], [ox2,oy2,0], [ox2,oy2,t], [ox1,oy1,t]);
    }

    if (Math.abs(r - rn) > 1e-9) {
      const c = Math.cos(ae), s = Math.sin(ae), sg = Math.sign(rn - r);
      facet([sg*s,-sg*c,0], [r*c,r*s,0], [rn*c,rn*s,0], [rn*c,rn*s,t]);
      facet([sg*s,-sg*c,0], [r*c,r*s,0], [rn*c,rn*s,t], [r*c,r*s,t]);
    }
  }

  // Square hole walls + V-groove on +X wall (sector-0 marker)
  const h = hh, gw = 1.0, gd = 1.5, gn = 1 / Math.sqrt(gw*gw + gd*gd);
  facet([-1,0,0], [h,-h,0], [h,-h,t], [h,-gw,0]);
  facet([-1,0,0], [h,-h,t], [h,-gw,t], [h,-gw,0]);
  facet([-1,0,0], [h, gw,0], [h, gw,t], [h, h,0]);
  facet([-1,0,0], [h, gw,t], [h,  h,t], [h, h,0]);
  facet([-gw*gn, gd*gn,0], [h,-gw,0], [h+gd,0,t], [h+gd,0,0]);
  facet([-gw*gn, gd*gn,0], [h,-gw,t], [h+gd,0,t], [h,-gw,0]);
  facet([-gw*gn,-gd*gn,0], [h+gd,0,0], [h,gw,t], [h,gw,0]);
  facet([-gw*gn,-gd*gn,0], [h+gd,0,t], [h,gw,t], [h+gd,0,0]);
  facet([0,0, 1], [h,-gw,t], [h+gd,0,t], [h, gw,t]);
  facet([0,0,-1], [h,-gw,0], [h, gw,0], [h+gd,0,0]);
  facet([ 1,0,0], [-h, h,0], [-h, h,t], [-h,-h,0]);
  facet([ 1,0,0], [-h, h,t], [-h,-h,t], [-h,-h,0]);
  facet([0,-1,0], [ h, h,0], [ h, h,t], [-h, h,0]);
  facet([0,-1,0], [ h, h,t], [-h, h,t], [-h, h,0]);
  facet([0, 1,0], [-h,-h,0], [-h,-h,t], [ h,-h,0]);
  facet([0, 1,0], [-h,-h,t], [ h,-h,t], [ h,-h,0]);

  // 表面マーカー：正三角形の突起（△）
  const ms = MRK_MS, mh = MRK_MH, mcy = MRK_CY, mr = MRK_RH;
  const BL  = [-ms, mcy - mh/3,    t     ], BR  = [ms, mcy - mh/3,    t     ], TT  = [0, mcy + 2*mh/3, t     ];
  const BL2 = [-ms, mcy - mh/3,    t + mr], BR2 = [ms, mcy - mh/3,    t + mr], TT2 = [0, mcy + 2*mh/3, t + mr];
  const s3 = Math.sqrt(3) / 2; // sin60°
  facet([0,-1,0],     BL,  BR,  BR2);   facet([0,-1,0],     BL,  BR2, BL2);
  facet([s3, 0.5, 0], BR,  TT,  TT2);   facet([s3, 0.5, 0], BR,  TT2, BR2);
  facet([-s3,0.5, 0], TT,  BL,  BL2);   facet([-s3,0.5, 0], TT,  BL2, TT2);
  facet([0, 0, 1],    BL2, BR2, TT2);

  lines.push('endsolid disk');
  return lines.join('\n');
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
document.getElementById('downloadBtn').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([generateSTL()], { type: 'text/plain' }));
  Object.assign(document.createElement('a'), { href: url, download: 'melody_disk.stl' }).click();
  URL.revokeObjectURL(url);
});
