import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ── Constants ────────────────────────────────────────────
// 10 chromatic notes, index 0 (最高: ラ) → 9 (最低: ド)
// 中間音のラジアスは既知5点間を半音ベースで線形補間
const RADII = [
  20,      // 0: ラ   A4  φ40mm
  19.375,  // 1: ソ#  Ab4 φ38.75mm
  18.75,   // 2: ソ   G4  φ37.5mm
  18.333,  // 3: ファ# F#4 φ36.67mm
  17.917,  // 4: ファ  F4  φ35.83mm
  17.5,    // 5: ミ   E4  φ35mm
  16.875,  // 6: レ#  Eb4 φ33.75mm
  16.25,   // 7: レ   D4  φ32.5mm
  15.625,  // 8: ド#  Db4 φ31.25mm
  15,      // 9: ド   C4  φ30mm
];
const REST_R    = RADII[0]; // kept for compatibility
const HOLE_HALF = 5.25;
const THICKNESS = 1.8;
const SUB       = 8;

const NOTE_COLORS = [
  '#ef4444','#f97316','#fb923c','#eab308',
  '#a3e635','#84cc16','#22c55e','#06b6d4','#3b82f6','#8b5cf6',
];
const NOTE_SOLFEGE = ['ラ','ソ#','ソ','ファ#','ファ','ミ','レ#','レ','ド#','ド'];
const NOTE_FREQ    = [440, 415, 392, 370, 349, 330, 311, 294, 277, 262]; // Hz

// "キラキラ星" 25 beats (no rests, 25 sectors)
//  ド ド ソ ソ ラ ラ ソ ソ | ファ ファ ミ ミ レ レ ド ド | ソ ソ ファ ファ ミ ミ レ レ ド
const DEFAULT_MELODY = [9,9,2,2,0,0,2,2, 4,4,5,5,7,7,9,9, 2,2,4,4,5,5,7,7,9];

// ── State ────────────────────────────────────────────────
let melody = [...DEFAULT_MELODY];

function noteSeqToRadii(noteSeq) {
  return noteSeq.map(n => RADII[n] ?? REST_R);
}

function getRadiiSeq() {
  return noteSeqToRadii(melody);
}

// ── Helpers ──────────────────────────────────────────────
function sqPt(angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const m = Math.max(Math.abs(c), Math.abs(s));
  return [HOLE_HALF * c / m, HOLE_HALF * s / m];
}

// ── Three.js setup ───────────────────────────────────────
const container = document.getElementById('preview-container');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0xe8f0f8);
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36,
  container.clientWidth / container.clientHeight, 0.1, 1000);
camera.position.set(35, 42, 48);
camera.lookAt(0, 0, 1);

scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const key = new THREE.DirectionalLight(0xffffff, 1.0);
key.position.set(50, 70, 50); scene.add(key);
const fill = new THREE.DirectionalLight(0xb0c8ff, 0.4);
fill.position.set(-40, 10, -30); scene.add(fill);
const rim = new THREE.DirectionalLight(0xffffff, 0.2);
rim.position.set(0, -30, -50); scene.add(rim);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.target.set(0, 0, 1);
controls.minDistance = 20;
controls.maxDistance = 200;
controls.update();

let meshObj = null, edgeObj = null, markerObj = null;

function buildGeometry() {
  if (meshObj)   { scene.remove(meshObj);   meshObj.geometry.dispose(); }
  if (edgeObj)   { scene.remove(edgeObj);   edgeObj.geometry.dispose(); }
  if (markerObj) { scene.remove(markerObj); markerObj.geometry.dispose(); markerObj = null; }

  const seq = getRadiiSeq();
  const N = seq.length;

  const shape = new THREE.Shape();
  shape.moveTo(seq[0], 0);
  for (let i = 0; i < N; i++) {
    const a1 = 2 * Math.PI * i / N;
    const a2 = 2 * Math.PI * (i + 1) / N;
    const r  = seq[i];
    const rn = seq[(i + 1) % N];
    for (let j = 1; j <= SUB; j++) {
      const a = a1 + (a2 - a1) * j / SUB;
      shape.lineTo(r * Math.cos(a), r * Math.sin(a));
    }
    if (Math.abs(r - rn) > 1e-9)
      shape.lineTo(rn * Math.cos(a2), rn * Math.sin(a2));
  }
  shape.closePath();

  const hole = new THREE.Path();
  const gw = 1.0, gd = 1.5; // groove half-width / depth (mm)
  hole.moveTo(-HOLE_HALF, -HOLE_HALF);
  hole.lineTo(HOLE_HALF, -HOLE_HALF);
  // V-groove on the +X wall of square hole marks sector 0 start
  hole.lineTo(HOLE_HALF, -gw);
  hole.lineTo(HOLE_HALF + gd, 0);
  hole.lineTo(HOLE_HALF, gw);
  hole.lineTo(HOLE_HALF, HOLE_HALF);
  hole.lineTo(-HOLE_HALF, HOLE_HALF);
  hole.closePath();
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, { depth: THICKNESS, bevelEnabled: false });
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({ color: 0x7ab4d0, metalness: 0.25, roughness: 0.4 });
  meshObj = new THREE.Mesh(geo, mat);
  scene.add(meshObj);

  const edgesGeo = new THREE.EdgesGeometry(geo, 18);
  edgeObj = new THREE.LineSegments(edgesGeo, new THREE.LineBasicMaterial({ color: 0x1e40af }));
  scene.add(edgeObj);
}
buildGeometry();

window.addEventListener('resize', () => {
  const w = container.clientWidth, h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
});
(function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
})();

// ── STL generation ────────────────────────────────────────
function generateSTL(customSeq = null, addMarker = false) {
  const t = THICKNESS, hh = HOLE_HALF;
  const seq = customSeq ?? getRadiiSeq();
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
    const r  = seq[i];
    const rn = seq[(i + 1) % N];
    const as = 2 * Math.PI * i / N;
    const ae = 2 * Math.PI * (i + 1) / N;

    for (let j = 0; j < SUB; j++) {
      const a1 = as + (ae - as) * j / SUB;
      const a2 = as + (ae - as) * (j + 1) / SUB;
      const ox1 = r * Math.cos(a1), oy1 = r * Math.sin(a1);
      const ox2 = r * Math.cos(a2), oy2 = r * Math.sin(a2);
      const [ix1, iy1] = sqPt(a1);
      const [ix2, iy2] = sqPt(a2);
      const deg = Math.abs(ix1 - ix2) < 1e-9 && Math.abs(iy1 - iy2) < 1e-9;

      facet([0,0,1], [ox1,oy1,t], [ox2,oy2,t], [ix2,iy2,t]);
      if (!deg) facet([0,0,1], [ox1,oy1,t], [ix2,iy2,t], [ix1,iy1,t]);
      facet([0,0,-1], [ox1,oy1,0], [ix2,iy2,0], [ox2,oy2,0]);
      if (!deg) facet([0,0,-1], [ox1,oy1,0], [ix1,iy1,0], [ix2,iy2,0]);

      const nx = Math.cos((a1 + a2) / 2), ny = Math.sin((a1 + a2) / 2);
      facet([nx,ny,0], [ox1,oy1,0], [ox2,oy2,0], [ox1,oy1,t]);
      facet([nx,ny,0], [ox2,oy2,0], [ox2,oy2,t], [ox1,oy1,t]);
    }

    if (Math.abs(r - rn) > 1e-9) {
      const c = Math.cos(ae), s = Math.sin(ae);
      const sg = Math.sign(rn - r);
      const nx = sg * s, ny = -sg * c;
      facet([nx,ny,0], [r*c,r*s,0], [rn*c,rn*s,0], [rn*c,rn*s,t]);
      facet([nx,ny,0], [r*c,r*s,0], [rn*c,rn*s,t], [r*c,r*s,t]);
    }
  }

  const h = hh;
  const gw = 1.0, gd = 1.5; // groove half-width / depth (mm)

  if (addMarker) {
    // Right wall of square hole: split into lower strip / groove / upper strip
    const gn = 1 / Math.sqrt(gw*gw + gd*gd);
    // Lower strip: y from -h to -gw
    facet([-1,0,0], [h,-h,0], [h,-h,t], [h,-gw,0]);
    facet([-1,0,0], [h,-h,t], [h,-gw,t], [h,-gw,0]);
    // Upper strip: y from +gw to +h
    facet([-1,0,0], [h,gw,0], [h,gw,t], [h,h,0]);
    facet([-1,0,0], [h,gw,t], [h,h,t], [h,h,0]);
    // Left groove wall: (h,-gw)→(h+gd,0), normal outward into groove (-gw,+gd,0)
    facet([-gw*gn, gd*gn,0], [h,-gw,0], [h+gd,0,t], [h+gd,0,0]);
    facet([-gw*gn, gd*gn,0], [h,-gw,t], [h+gd,0,t], [h,-gw,0]);
    // Right groove wall: (h+gd,0)→(h,+gw), normal outward into groove (-gw,-gd,0)
    facet([-gw*gn,-gd*gn,0], [h+gd,0,0], [h,gw,t], [h,gw,0]);
    facet([-gw*gn,-gd*gn,0], [h+gd,0,t], [h,gw,t], [h+gd,0,0]);
    // Groove floor top (z=t) and bottom (z=0)
    facet([0,0, 1], [h,-gw,t], [h+gd,0,t], [h,gw,t]);
    facet([0,0,-1], [h,-gw,0], [h,gw,0], [h+gd,0,0]);
  } else {
    facet([-1,0,0], [ h,-h,0],[ h,-h,t],[ h, h,0]);
    facet([-1,0,0], [ h,-h,t],[ h, h,t],[ h, h,0]);
  }

  facet([ 1,0,0], [-h, h,0],[-h, h,t],[-h,-h,0]);
  facet([ 1,0,0], [-h, h,t],[-h,-h,t],[-h,-h,0]);
  facet([0,-1,0], [ h, h,0],[ h, h,t],[-h, h,0]);
  facet([0,-1,0], [ h, h,t],[-h, h,t],[-h, h,0]);
  facet([0, 1,0], [-h,-h,0],[-h,-h,t],[ h,-h,0]);
  facet([0, 1,0], [-h,-h,t],[ h,-h,t],[ h,-h,0]);

  lines.push('endsolid disk');
  return lines.join('\n');
}

// ── Piano Roll UI ─────────────────────────────────────────
const pianoRoll = document.getElementById('piano-roll');
let prCells = []; // prCells[noteRow * melody.length + beatCol]

function buildPianoRoll() {
  pianoRoll.innerHTML = '';
  prCells = [];
  pianoRoll.style.gridTemplateColumns = `48px repeat(${melody.length}, 1fr)`;

  // Header: empty top-left + beat numbers
  pianoRoll.appendChild(document.createElement('div'));
  for (let b = 0; b < melody.length; b++) {
    const num = document.createElement('div');
    num.className = 'pr-beat-num';
    num.textContent = b + 1;
    pianoRoll.appendChild(num);
  }

  // Note rows (high → low)
  for (let n = 0; n < NOTE_SOLFEGE.length; n++) {
    const key = document.createElement('div');
    key.className = 'pr-key';
    key.style.background = NOTE_COLORS[n];
    key.textContent = NOTE_SOLFEGE[n];
    pianoRoll.appendChild(key);

    for (let b = 0; b < melody.length; b++) {
      const cell = document.createElement('div');
      cell.className = 'pr-cell';
      cell.dataset.beat = b;
      cell.dataset.note = n;
      cell.addEventListener('click', () => {
        melody[b] = n; // always set; no rest
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
  for (let n = 0; n < N; n++) {
    for (let b = 0; b < melody.length; b++) {
      const cell = prCells[n * melody.length + b];
      cell.style.background = (melody[b] === n) ? NOTE_COLORS[n] : '#dde3ec';
    }
  }
}

buildPianoRoll();

// ── Audio preview ─────────────────────────────────────────
let audioCtx = null;
function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playNote(noteIdx, startTime, dur) {
  const ctx = getCtx();
  const freq = NOTE_FREQ[noteIdx];
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.type = 'triangle';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.25, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur * 0.9);
  osc.start(startTime);
  osc.stop(startTime + dur);
}

document.getElementById('playBtn').addEventListener('click', () => {
  const ctx   = getCtx();
  const bpm   = 150;
  const beat  = 60 / bpm;
  const now   = ctx.currentTime + 0.05;
  const btn   = document.getElementById('playBtn');
  btn.disabled = true;
  melody.forEach((n, i) => {
    playNote(n, now + i * beat, beat * 0.85);
  });
  setTimeout(() => { btn.disabled = false; }, melody.length * beat * 1000 + 200);
});

// ── Download ──────────────────────────────────────────────
function downloadSTL(stl, filename) {
  const blob = new Blob([stl], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

document.getElementById('downloadBtn').addEventListener('click', () => {
  downloadSTL(generateSTL(null, true), 'melody_disk.stl');
});

// Single-note test disks: all 25 sectors at one radius
document.getElementById('dlTwinkle').addEventListener('click', () => {
  downloadSTL(generateSTL(noteSeqToRadii(DEFAULT_MELODY), true), 'disk_twinkle_star.stl');
});

