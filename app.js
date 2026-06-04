import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';

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

let meshObj = null, edgeObj = null;

const START_ANGLE = Math.PI / 2;   // 始点(+X)を画面の上(+Y)に向ける表示回転

// 「オモテ」表示用の貫通穴（Arial Unicode から抽出、font em 座標 y上、UPM2048、bbox x[197,5956] y[-125,1612]）
const OMOTE_PATH = "M1950 1073H1470V127Q1470 42 1399.0 -25.0Q1328 -92 1223 -92Q1160 -92 1018 -86L967 109Q1156 96 1225 96Q1250 96 1268.0 117.5Q1286 139 1286 166V1008H1282Q1111 723 891.0 523.5Q671 324 313 125L197 293Q437 400 687.0 600.0Q937 800 1116 1073H244V1257H1286V1612H1470V1257H1950Z M3924 784H3076V236Q3076 172 3160 172H3807V-12H3074Q3003 -12 2947.5 54.5Q2892 121 2892 219V784H2214V969H2892V1329H2333V1513H3820V1329H3076V969H3924Z M5751 1331H4444V1516H5751ZM5956 827H5229Q5231 803 5231 745Q5231 134 4694 -125L4549 39Q4793 125 4918.5 300.0Q5044 475 5044 721Q5044 793 5040 827H4246V1012H5956Z";
const OMOTE_SUBPATHS = new SVGLoader()
  .parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${OMOTE_PATH}"/></svg>`)
  .paths[0].subPaths;

// 中央穴の頂点。始点(+X)側に三角切り込み(V溝)を常に入れる。
function holePoints() {
  const h = HOLE_HALF;
  const gw = 2.0, gd = 3.0;   // 始点の三角切り込みの幅・深さ
  return [[-h,-h],[h,-h],[h,-gw],[h+gd,0],[h,gw],[h,h],[-h,h]];
}

function buildGeometry() {
  if (meshObj) { scene.remove(meshObj); meshObj.geometry.dispose(); }
  if (edgeObj) { scene.remove(edgeObj); edgeObj.geometry.dispose(); }

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

  const pts = holePoints();
  const hole = new THREE.Path();
  hole.moveTo(pts[0][0], pts[0][1]);
  for (let k = 1; k < pts.length; k++) hole.lineTo(pts[k][0], pts[k][1]);
  hole.closePath();
  shape.holes.push(hole);

  // 「オモテ」表示用の貫通穴（中心より下。mesh 回転を打ち消して正立配置）
  {
    const s = 10 / 5759, cx = 3076.5, cy = 743.5, yOff = -8.5;
    for (const sp of OMOTE_SUBPATHS) {
      const pts = sp.getPoints();
      const hole = new THREE.Path();
      pts.forEach((p, i) => {
        const nx = (p.x - cx) * s, ny = (p.y - cy) * s;
        const hx = ny + yOff, hy = nx;    // 回転相殺＋表面(カメラ -z 側)から正立に見えるよう左右反転
        i === 0 ? hole.moveTo(hx, hy) : hole.lineTo(hx, hy);
      });
      hole.closePath();
      shape.holes.push(hole);
    }
  }

  const geo = new THREE.ExtrudeGeometry(shape, { depth: THICKNESS, bevelEnabled: false });
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: 0x7ab4d0, metalness: 0.25, roughness: 0.4 });
  meshObj = new THREE.Mesh(geo, mat);
  meshObj.rotation.z = START_ANGLE;
  scene.add(meshObj);
  edgeObj = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 18), new THREE.LineBasicMaterial({ color: 0x1e40af }));
  edgeObj.rotation.z = START_ANGLE;
  scene.add(edgeObj);
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

  // 中央穴（始点 +X 側に三角切り込み）。
  const pts = holePoints();
  let hd = `M ${f(pts[0][0])} ${f(-pts[0][1])}`;
  for (let k = 1; k < pts.length; k++) hd += ` L ${f(pts[k][0])} ${f(-pts[k][1])}`;
  hd += ' Z';

  // 「オモテ」表示穴（STL と同じ shape 座標で生成）
  let od = '';
  {
    const s = 10 / 5759, cx = 3076.5, cy = 743.5, yOff = -8.5;
    for (const sp of OMOTE_SUBPATHS) {
      const pts = sp.getPoints();
      pts.forEach((p, i) => {
        const nx = (p.x - cx) * s, ny = (p.y - cy) * s;
        const hx = ny + yOff, hy = nx;
        od += (i === 0 ? ' M ' : ' L ') + `${f(hx)} ${f(-hy)}`;
      });
      od += ' Z';
    }
  }

  const R = RADII[0] + 0.5; // 余白付き半径
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${f(2*R)}mm" height="${f(2*R)}mm" viewBox="${f(-R)} ${f(-R)} ${f(2*R)} ${f(2*R)}">
  <g transform="scale(-1,1) rotate(-90)"><path d="${d} ${hd}${od}" fill="none" stroke="#000000" stroke-width="0.1"/></g>
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
let bpm = 300;   // サンプル MIDI と同じ ♩=300。MIDI 読込時はそのテンポに追従し、保存にも使う。

document.getElementById('clearBtn').addEventListener('click', () => {
  melody.fill(-1);
  refreshPianoRoll();
  buildGeometry();
});

document.getElementById('playBtn').addEventListener('click', () => {
  audioCtx ??= new AudioContext();
  const beat = 60 / bpm, now = audioCtx.currentTime + 0.05;
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

// 厚紙貼付け・プリント用に、枠データを原寸（mm）の PDF で出力。
// jsPDF + svg2pdf.js は重いので、押下時に動的 import する。
const pdfBtn = document.getElementById('downloadPdfBtn');
pdfBtn.addEventListener('click', async () => {
  pdfBtn.disabled = true;
  let wrap;
  try {
    const { jsPDF } = await import('jspdf');
    const svgMod = await import('svg2pdf.js');
    const svg2pdf = svgMod.svg2pdf || svgMod.default;   // ESM 版は名前付き export
    const size = 2 * (RADII[0] + 0.5);     // generateSVG と同じ実寸（mm）
    // getBBox を効かせるため SVG を一時的に画面外へ追加
    wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;left:-9999px;top:0';
    wrap.innerHTML = generateSVG();
    document.body.appendChild(wrap);
    const svgEl = wrap.querySelector('svg');
    // A4 縦の左上隅に原寸（mm）で配置（generateSVG が表面像を返す）
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const opts = { x: 0, y: 0, width: size, height: size };
    if (typeof doc.svg === 'function') await doc.svg(svgEl, opts);   // プラグイン版
    else await svg2pdf(svgEl, doc, opts);                            // 関数版
    doc.save('melody_disk.pdf');
  } catch (err) {
    alert('PDF の生成に失敗しました: ' + err.message);
  } finally {
    if (wrap) wrap.remove();
    pdfBtn.disabled = false;
  }
});

// ── MIDI ファイル読み込み・保存 ───────────────────────────
// SMF を解析し、ノートオン列を 1 拍 = 4 分音符として melody に割り当てる。
// アプリ音域はラ〜ド（A〜C の 10 半音）なので、オクターブ畳み込みで対応付ける。

// MIDI ノート番号 → melody index（0=ラ…9=ド）。畳み込めない A#・B 系は null。
function midiNoteToIndex(note) {
  const i = ((69 - note) % 12 + 12) % 12;   // A からの下行半音数（オクターブ無視）
  return i < NOTE_SOLFEGE.length ? i : null;
}

// SMF (format 0/1) の全トラックからノートオンを { tick, note } の列で取り出す。
function parseMidi(buffer) {
  const b = new Uint8Array(buffer);
  let p = 0;
  const u16 = () => (p += 2, (b[p - 2] << 8) | b[p - 1]);
  const u32 = () => (p += 4, ((b[p - 4] << 24) | (b[p - 3] << 16) | (b[p - 2] << 8) | b[p - 1]) >>> 0);
  const vlq = () => { let v = 0, c; do { c = b[p++]; v = (v << 7) | (c & 0x7f); } while (c & 0x80); return v; };

  if (u32() !== 0x4d546864) throw new Error('MIDI ファイル（SMF）ではありません');   // 'MThd'
  p += 4;                       // ヘッダー長（常に 6）
  u16();                        // format
  const ntrk = u16();
  const division = u16();       // 4 分音符あたりの tick 数
  if (division & 0x8000) throw new Error('SMPTE 時間形式には未対応です');

  const notes = [];
  let tempo = null;             // 最初のテンポメタ（µs/4 分音符）
  for (let t = 0; t < ntrk; t++) {
    if (u32() !== 0x4d54726b) throw new Error('トラックの解析に失敗しました');       // 'MTrk'
    const trkLen = u32();
    const end = p + trkLen;
    let tick = 0, running = 0;
    while (p < end) {
      tick += vlq();
      let s = b[p];
      if (s & 0x80) p++; else s = running;                // ランニングステータス
      if (s === 0xff) {                                            // メタイベント（型 1 byte + 可変長データ）
        const type = b[p++];
        const len = vlq();
        if (type === 0x51 && len === 3 && tempo === null) tempo = (b[p] << 16) | (b[p + 1] << 8) | b[p + 2];
        p += len;
      }
      else if (s === 0xf0 || s === 0xf7) { const len = vlq(); p += len; }  // SysEx
      else {
        running = s;
        const hi = s & 0xf0;
        if (hi === 0x90 && b[p + 1] > 0) notes.push({ tick, note: b[p] });
        p += (hi === 0xc0 || hi === 0xd0) ? 1 : 2;        // プログラム/チャンネルプレッシャーのみ 1 byte
      }
    }
    p = end;
  }
  notes.sort((x, y) => x.tick - y.tick);
  return { notes, division, tempo };
}

// melody を SMF format 0 に変換（保存用）。サンプル MIDI と同じ 25/4・4 分音符刻み・A5〜C5。
function melodyToMidi() {
  const TPQ = 480, DUR = 360;
  const vlq = v => { const out = [v & 0x7f]; while ((v >>= 7) > 0) out.unshift((v & 0x7f) | 0x80); return out; };
  const tempo = Math.round(60e6 / bpm);              // µs/拍。試聴と同じテンポで書き出す
  const body = [
    0, 0xff, 0x51, 0x03, (tempo >> 16) & 0xff, (tempo >> 8) & 0xff, tempo & 0xff,
    0, 0xff, 0x58, 0x04, melody.length, 2, 24, 8,    // 拍子 25/4（1 周 = 1 小節）
  ];
  let cursor = 0;
  melody.forEach((n, i) => {
    if (n < 0) return;
    const note = 81 - n;                             // 0=ラ→A5(81) … 9=ド→C5(72)
    body.push(...vlq(i * TPQ - cursor), 0x90, note, 0x5f);
    body.push(...vlq(DUR), 0x80, note, 0x40);
    cursor = i * TPQ + DUR;
  });
  body.push(0, 0xff, 0x2f, 0x00);                    // End of Track
  return new Uint8Array([
    0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6,              // 'MThd'
    0, 0, 0, 1, TPQ >> 8, TPQ & 0xff,                // format 0・1 トラック・480tpq
    0x4d, 0x54, 0x72, 0x6b,                          // 'MTrk'
    (body.length >>> 24) & 0xff, (body.length >>> 16) & 0xff, (body.length >>> 8) & 0xff, body.length & 0xff,
    ...body,
  ]);
}

document.getElementById('loadBtn').addEventListener('click', () =>
  document.getElementById('loadFile').click());

document.getElementById('saveBtn').addEventListener('click', () =>
  download(melodyToMidi(), 'melody.midi', 'audio/midi'));

document.getElementById('loadFile').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let parsed;
    try {
      parsed = parseMidi(reader.result);
    } catch (err) {
      alert('MIDI の読み込みに失敗しました: ' + err.message);
      return;
    }
    const N = melody.length;                 // 25 セクター固定
    const next = new Array(N).fill(-1);      // 音のない拍は休符
    let overflow = 0, outOfRange = 0, collision = 0;
    for (const { tick, note } of parsed.notes) {
      const beat = Math.round(tick / parsed.division);   // 1 拍 = 4 分音符
      const idx = midiNoteToIndex(note);
      if (beat >= N) overflow++;
      else if (idx === null) outOfRange++;
      else if (next[beat] >= 0) collision++;             // 同一拍の重複（和音）は先勝ち
      else next[beat] = idx;
    }
    if (parsed.tempo) bpm = Math.round(60e6 / parsed.tempo);   // 試聴テンポを MIDI に合わせる
    melody = next;
    refreshPianoRoll();
    buildGeometry();
    const msgs = [];
    if (!parsed.notes.length) msgs.push('ノートが見つかりませんでした。');
    if (overflow) msgs.push(`${N} 拍を超える ${overflow} 音を切り捨てました。`);
    if (outOfRange) msgs.push(`音域（ラ〜ド）に畳み込めない ${outOfRange} 音を無視しました。`);
    if (collision) msgs.push(`同じ拍に重なる ${collision} 音を無視しました。`);
    if (msgs.length) alert(msgs.join('\n'));
  };
  reader.readAsArrayBuffer(file);
  e.target.value = '';   // 同じファイルを連続で選べるようにリセット
});
