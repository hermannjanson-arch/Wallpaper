// Steuerung der Seite: Foto, Handy, Varianten, Vorschau und Export.
import { DEFAULT_DEVICE } from './config.js';
import { loadImageFile, makeCanvas, context2d, canvasToBlob, downloadBlob, buildFileName, canShareFile, shareBlob } from './image-io.js';
import { loadDevices, searchDevices, detectScreen } from './devices.js';
import { containRect, fillShare, freeAxis } from './layout.js';
import { blurVariant } from './variants/blur.js';

// Reihenfolge = Reihenfolge der Anzeige. Weitere Varianten (KI, Seam Carving, Kombination) folgen.
const VARIANTS = [blurVariant];

const $ = (id) => document.getElementById(id);
const state = {
  devices: [],
  source: null,        // { canvas, width, height, name, ... }
  target: null,        // { w, h, label, slug }
  offset: 0.5,         // Position des Originals entlang der freien Achse
  selected: null,      // id der gewählten Variante
  results: new Map(),  // id -> Canvas in voller Zielauflösung
};

// ---------- Speicher für Komfort (wird ignoriert, falls der Browser ihn blockiert) ----------
const prefs = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* egal */ } },
};

// ---------- Foto ----------
async function useFile(file) {
  $('fileError').hidden = true;
  if (!file) return;
  if (file.type && !file.type.startsWith('image/')) {
    showFileError('Das ist keine Bilddatei.');
    return;
  }
  try {
    state.source = await loadImageFile(file);
  } catch (err) {
    showFileError(err.message);
    return;
  }
  state.offset = 0.5;
  const s = state.source;
  const thumb = $('sourceThumb');
  const t = Math.min(1, 128 / Math.max(s.width, s.height));
  thumb.width = Math.round(s.width * t); thumb.height = Math.round(s.height * t);
  context2d(thumb).drawImage(s.canvas, 0, 0, thumb.width, thumb.height);
  $('sourceName').textContent = file.name || 'Foto';
  $('sourceInfo').textContent = `${s.originalWidth} × ${s.originalHeight} px`;
  document.querySelector('.dz-empty').hidden = true;
  document.querySelector('.dz-loaded').hidden = false;
  renderAll();
}

function showFileError(message) {
  $('fileError').textContent = message;
  $('fileError').hidden = false;
}

function setupFileInput() {
  $('fileInput').addEventListener('change', (e) => useFile(e.target.files[0]));
  const dz = $('dropzone');
  ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, () => dz.classList.remove('drag')));
  dz.addEventListener('drop', (e) => { e.preventDefault(); useFile(e.dataTransfer.files[0]); });
  // Fotos auch auf der ganzen Seite annehmen, damit ein Fehlwurf nicht das Bild im Tab öffnet
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => { e.preventDefault(); useFile(e.dataTransfer?.files[0]); });

  $('sampleBtn').addEventListener('click', async () => {
    const blob = await (await fetch('assets/beispiel-strand.jpg')).blob();
    useFile(new File([blob], 'beispiel-strand.jpg', { type: blob.type }));
  });
}

// ---------- Handy ----------
function setTarget(target) {
  state.target = target;
  state.offset = 0.5; // neues Format: Original wieder mittig setzen
  $('targetInfo').innerHTML = '';
  const b = document.createElement('strong');
  b.textContent = target.label;
  $('targetInfo').append('Ziel: ', b, ` · ${target.w} × ${target.h} px`);
  prefs.set('target', JSON.stringify(target));
  renderAll();
}

function deviceTarget(d) {
  return { w: d.w, h: d.h, label: d.label, slug: d.slug };
}

function setupDevicePicker() {
  const input = $('deviceSearch'), list = $('deviceList');
  let items = [], active = -1;

  function open() {
    items = searchDevices(state.devices, input.value);
    active = -1;
    list.innerHTML = '';
    if (!items.length) {
      const li = document.createElement('li');
      li.className = 'none';
      li.textContent = 'Kein Modell gefunden. Unten kannst du eine eigene Größe eingeben.';
      list.append(li);
    }
    items.forEach((d, i) => {
      const li = document.createElement('li');
      li.id = `dev-${i}`;
      li.setAttribute('role', 'option');
      const name = document.createElement('span');
      name.textContent = d.label;
      const meta = document.createElement('span');
      meta.className = 'meta';
      meta.textContent = `${d.jahr} · ${d.w}×${d.h}`;
      li.append(name, meta);
      li.addEventListener('pointerdown', (e) => { e.preventDefault(); choose(i); });
      list.append(li);
    });
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function close() {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }

  function choose(i) {
    const d = items[i];
    if (!d) return;
    input.value = d.label;
    close();
    setTarget(deviceTarget(d));
  }

  function highlight(i) {
    list.querySelector('[aria-selected="true"]')?.setAttribute('aria-selected', 'false');
    active = Math.max(0, Math.min(items.length - 1, i));
    const li = $(`dev-${active}`);
    if (!li) return;
    li.setAttribute('aria-selected', 'true');
    li.scrollIntoView({ block: 'nearest' });
    input.setAttribute('aria-activedescendant', li.id);
  }

  input.addEventListener('focus', () => { input.select(); open(); });
  input.addEventListener('input', open);
  input.addEventListener('blur', () => {
    close();
    if (state.target) input.value = state.target.label; // nach Abbruch wieder das gewählte Gerät zeigen
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (list.hidden) open(); highlight(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); highlight(active - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(active >= 0 ? active : 0); input.blur(); }
    else if (e.key === 'Escape') { input.blur(); }
  });

  $('customForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const w = Number($('customW').value), h = Number($('customH').value);
    if (!(w >= 100 && h >= 100 && w <= 8000 && h <= 8000)) return;
    input.value = '';
    setTarget({ w, h, label: 'Eigene Größe', slug: 'eigene-groesse' });
  });
}

function initialTarget() {
  const detected = detectScreen(state.devices);
  if (detected) {
    const btn = $('detectedBtn');
    const names = detected.matches.slice(0, 3).map((d) => d.shortLabel).join(', ');
    const target = detected.matches.length === 1
      ? deviceTarget(detected.matches[0])
      : { w: detected.w, h: detected.h, label: 'Dieses Handy', slug: 'dieses-handy' };
    btn.textContent = `Dieses Handy: ${detected.w} × ${detected.h} px` + (names ? ` (passt zu ${names})` : '') + '. Bitte prüfen.';
    btn.hidden = false;
    btn.addEventListener('click', () => { $('deviceSearch').value = target.label; setTarget(target); });
    $('deviceSearch').value = target.label;
    return target;
  }
  try {
    const saved = JSON.parse(prefs.get('target'));
    if (saved?.w && saved?.h) { $('deviceSearch').value = saved.label; return saved; }
  } catch { /* ungültig, Standard nehmen */ }
  const d = state.devices.find((x) => x.label === DEFAULT_DEVICE) ?? state.devices[0];
  $('deviceSearch').value = d.label;
  return deviceTarget(d);
}

// ---------- Varianten ----------
function makeJob() {
  const { w: W, h: H } = state.target;
  const s = state.source;
  const rect = containRect(s.width, s.height, W, H, state.offset);
  return { source: s.canvas, W, H, rect, share: fillShare(rect, W, H), axis: freeAxis(rect, W, H) };
}

let renderQueued = false;
function renderAll() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; renderNow(); });
}

function renderNow() {
  if (!state.source || !state.target) return;
  const job = makeJob();
  const available = VARIANTS.filter((v) => v.isAvailable(job));
  $('emptyHint').hidden = true;
  $('editor').hidden = false;
  $('fillInfo').hidden = false;
  $('fillInfo').textContent = job.axis
    ? `Zu füllen: ${Math.round(job.share * 100)} % der Fläche.`
    : 'Das Foto hat schon genau das richtige Format.';

  state.results.clear();
  for (const v of available) state.results.set(v.id, v.render(job));
  if (!state.results.has(state.selected)) state.selected = available[0]?.id ?? null;

  renderCards(available);
  updatePositionControls(job);
  drawPreview();
}

function renderCards(available) {
  const cards = $('cards');
  // Karten nur neu anlegen, wenn sich die Auswahl an Varianten geändert hat
  const ids = available.map((v) => v.id).join(',');
  if (cards.dataset.ids !== ids) {
    cards.dataset.ids = ids;
    cards.innerHTML = '';
    available.forEach((v, i) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'card';
      card.dataset.id = v.id;
      card.setAttribute('role', 'radio');
      const canvas = document.createElement('canvas');
      const title = document.createElement('strong');
      title.textContent = v.name;
      const desc = document.createElement('span');
      desc.className = 'desc';
      desc.textContent = v.description;
      card.append(canvas, title, desc);
      if (i === 0 && available.length > 1) {
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = 'Empfohlen';
        card.append(badge);
      }
      card.addEventListener('click', () => { state.selected = v.id; markSelected(); drawPreview(); });
      cards.append(card);
    });
  }
  for (const card of cards.children) {
    const result = state.results.get(card.dataset.id);
    const canvas = card.querySelector('canvas');
    const scale = Math.min(1, 380 / result.height);
    canvas.width = Math.round(result.width * scale);
    canvas.height = Math.round(result.height * scale);
    context2d(canvas).drawImage(result, 0, 0, canvas.width, canvas.height);
  }
  markSelected();
}

function markSelected() {
  for (const card of $('cards').children) card.setAttribute('aria-checked', String(card.dataset.id === state.selected));
}

// ---------- Vorschau und Position ----------
function previewSize() {
  const { w: W, h: H } = state.target;
  const wrap = $('previewWrap');
  const maxW = Math.max(120, wrap.clientWidth - 24);
  const maxH = Math.max(240, Math.min(window.innerHeight * 0.72, 760));
  const s = Math.min(maxW / W, maxH / H);
  return { cssW: Math.round(W * s), cssH: Math.round(H * s), scale: s };
}

function drawPreview() {
  const result = state.results.get(state.selected);
  if (!result) return;
  const canvas = $('preview');
  const { cssW, cssH } = previewSize();
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  context2d(canvas).drawImage(result, 0, 0, canvas.width, canvas.height);
  $('exportInfo').textContent = `Wird exakt in ${state.target.w} × ${state.target.h} Pixeln gespeichert.`;
}

function updatePositionControls(job) {
  const box = $('positionBox'), canvas = $('preview');
  canvas.classList.toggle('movable-x', job.axis === 'x');
  canvas.classList.toggle('movable-y', job.axis === 'y');
  box.hidden = !job.axis;
  if (!job.axis) return;
  $('positionLabel').textContent = job.axis === 'y' ? 'Position: oben ↔ unten' : 'Position: links ↔ rechts';
  $('positionSlider').value = String(Math.round(state.offset * 100));
}

function setOffset(value) {
  state.offset = Math.max(0, Math.min(1, value));
  renderAll();
}

function setupPosition() {
  $('positionSlider').addEventListener('input', (e) => setOffset(Number(e.target.value) / 100));

  // Ziehen in der Vorschau
  const canvas = $('preview');
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (!state.source) return;
    const job = makeJob();
    if (!job.axis) return;
    const { scale } = previewSize();
    const freeCss = (job.axis === 'x' ? job.W - job.rect.w : job.H - job.rect.h) * scale;
    drag = { axis: job.axis, start: job.axis === 'x' ? e.clientX : e.clientY, offset: state.offset, freeCss };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const pos = drag.axis === 'x' ? e.clientX : e.clientY;
    setOffset(drag.offset + (pos - drag.start) / drag.freeCss);
  });
  const end = () => { drag = null; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(drawPreview, 100); });
}

// ---------- Export ----------
function currentFormat() {
  return document.querySelector('input[name="format"]:checked').value;
}

async function exportBlob() {
  const result = state.results.get(state.selected);
  const format = currentFormat();
  const blob = await canvasToBlob(result, format);
  const name = buildFileName(state.source.name, state.target.slug, state.target.w, state.target.h, format);
  return { blob, name };
}

function setupExport() {
  $('downloadBtn').addEventListener('click', async () => {
    const { blob, name } = await exportBlob();
    downloadBlob(blob, name);
  });
  $('shareBtn').addEventListener('click', async () => {
    const { blob, name } = await exportBlob();
    try { await shareBlob(blob, name); } catch { /* abgebrochen */ }
  });
  // Teilen nur auf Touch-Geräten anbieten: dort landet das Bild so am einfachsten in der Galerie
  const probe = new Blob([new Uint8Array(1)], { type: 'image/jpeg' });
  $('shareBtn').hidden = !(matchMedia('(pointer: coarse)').matches && canShareFile(probe, 'test.jpg'));
}

// ---------- Start ----------
async function init() {
  setupFileInput();
  setupDevicePicker();
  setupPosition();
  setupExport();
  state.devices = await loadDevices();
  setTarget(initialTarget());
}

init();
