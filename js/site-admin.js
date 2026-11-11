/* ==========================================================================
   site-admin.js — "वेबसाइट की फ़ोटो" in the admin panel
   Load on admin.html after github-publish.js.

   • Main poster: choose a new picture, preview it, publish it.
   • Founders and co-founders: round photo with zoom / move (sliders or drag),
     name, role, order, add and remove.

   Everything is saved to GitHub straight away (no 🚀 needed):
   pictures go to images/site/, the settings to data/site.json, which the
   home page reads through js/site-content.js.
   The first time, the current founders are read from index.html, so
   nothing has to be typed again.
   ========================================================================== */

'use strict';

const SITE_JSON_PATH = 'data/site.json';
const SITE_IMAGE_FOLDER = 'images/site/';

let siteData = null;          // { hero: { src }, founders: [ ... ] }
let siteDirty = false;        // founders changed but not saved yet
let pendingPoster = null;     // data URL of a newly chosen poster
const founderUploads = {};    // founder id → data URL of a newly chosen photo

/* --------------------------------------------------------------------------
   Pictures
   -------------------------------------------------------------------------- */
function compressPicture(file, maxSide, quality) {
  return new Promise(function (resolve, reject) {
    if (!file || !/^image\//.test(file.type)) { reject(new Error('सिर्फ़ फ़ोटो (JPG या PNG) चुनें।')); return; }
    const reader = new FileReader();
    reader.onerror = function () { reject(new Error('फ़ोटो पढ़ी नहीं जा सकी।')); };
    reader.onload = function () {
      const img = new Image();
      img.onerror = function () { reject(new Error('यह फ़ोटो खुल नहीं रही। JPG या PNG फ़ोटो चुनें।')); };
      img.onload = function () {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/** A picture path from the site, shown fresh from GitHub (or the new picture not yet saved). */
function sitePictureURL(src) {
  if (!src) return 'images/avatar.svg';
  if (/^data:/.test(src)) return src;
  return galleryImageURL(src.replace(/^\.?\//, '').split('?')[0]);
}

function founderLookStyle(f) {
  const fx = f.fx === undefined ? 50 : f.fx, fy = f.fy === undefined ? 25 : f.fy, z = f.zoom || 1;
  return 'width:100%;height:100%;display:block;object-fit:cover;object-position:' + fx + '% ' + fy + '%;transform:scale(' + z + ');transform-origin:' + fx + '% ' + fy + '%';
}

/* --------------------------------------------------------------------------
   Loading: data/site.json, or (first time) what index.html shows now
   -------------------------------------------------------------------------- */
async function loadSiteData() {
  const text = await ghReadText(SITE_JSON_PATH);
  if (text) {
    try {
      const data = JSON.parse(text);
      data.founders = Array.isArray(data.founders) ? data.founders : [];
      data.hero = data.hero || {};
      return data;
    } catch (error) { /* fall through to index.html */ }
  }
  const html = await ghReadText('index.html');
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  const hero = doc.querySelector('.hero-image');
  const founders = Array.from(doc.querySelectorAll('.founder-card')).map(function (card, i) {
    const img = card.querySelector('img');
    const style = (img && img.getAttribute('style')) || '';
    const pos = style.match(/object-position:\s*([\d.]+)%\s+([\d.]+)%/);
    const scale = style.match(/scale\(([\d.]+)\)/);
    const origin = style.match(/transform-origin:\s*([\d.]+)%\s+([\d.]+)%/);
    const role = (card.querySelector('.founder-role') || {}).textContent || '';
    return {
      id: 'f' + (i + 1),
      name: ((card.querySelector('.founder-name') || {}).textContent || '').trim(),
      role: role.trim(),
      lead: card.classList.contains('is-founder') || role.trim() === 'संस्थापक',
      src: img ? img.getAttribute('src') : '',
      fx: pos ? Number(pos[1]) : (origin ? Number(origin[1]) : 50),
      fy: pos ? Number(pos[2]) : (origin ? Number(origin[2]) : 25),
      zoom: scale ? Number(scale[1]) : 1
    };
  });
  return { hero: { src: hero ? hero.getAttribute('src') : 'images/hero-ghat.jpg' }, founders: founders };
}

/* --------------------------------------------------------------------------
   Panel
   -------------------------------------------------------------------------- */
function injectSiteAdminStyles() {
  if (document.getElementById('siteAdminStyles')) return;
  const style = document.createElement('style');
  style.id = 'siteAdminStyles';
  style.textContent = [
    '.site-admin{margin-top:2.5rem;}',
    '.site-admin h2{font-size:var(--step-2);}',
    '.site-admin h3{font-size:var(--step-1);margin:1.5rem 0 .5rem;}',
    '.poster-box{display:flex;flex-wrap:wrap;gap:1.25rem;align-items:flex-start;}',
    '.poster-box img{width:min(100%,420px);border-radius:14px;box-shadow:0 0 0 2px var(--line);background:var(--paper-deep);}',
    '.poster-side{flex:1;min-width:220px;}',
    '.founder-admin-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1.25rem;}',
    '.fa-card{padding:1rem;border:1px solid var(--line);border-radius:var(--radius-medium);background:var(--white);}',
    '.fa-card.is-changed{border-color:var(--marigold);box-shadow:0 0 0 2px rgba(245,166,35,.35);}',
    '.fa-circle{width:150px;height:150px;margin:0 auto .75rem;padding:5px;border-radius:50%;background:conic-gradient(var(--marigold),var(--saffron),var(--sindoor),var(--saffron),var(--marigold));}',
    '.fa-circle span{display:block;width:100%;height:100%;border-radius:50%;overflow:hidden;border:4px solid #fff;background:var(--paper-deep);cursor:grab;touch-action:none;}',
    '.fa-circle img{pointer-events:none;user-select:none;}',
    '.fa-card label{display:flex;flex-direction:column;gap:.2rem;font-weight:600;font-size:.9rem;margin-bottom:.5rem;}',
    '.fa-card input[type=text]{min-height:40px;padding:.35rem .6rem;border:2px solid var(--line);border-radius:var(--radius-small);font:inherit;}',
    '.fa-card input[type=range]{width:100%;accent-color:var(--sindoor);}',
    '.fa-row{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.5rem;}',
    '.fa-lead{flex-direction:row !important;align-items:center;gap:.5rem !important;}',
    '.site-save-bar{position:sticky;bottom:1rem;z-index:5;display:flex;flex-wrap:wrap;align-items:center;gap:1rem;margin-top:1.25rem;padding:.9rem 1.2rem;border-radius:var(--radius-medium);background:var(--paper-deep);box-shadow:var(--shadow-warm);}'
  ].join('\n');
  document.head.appendChild(style);
}

function buildSiteAdminPanel() {
  const dashboard = document.getElementById('dashboard');
  if (!dashboard || document.getElementById('siteAdmin')) return;
  const panel = document.createElement('section');
  panel.className = 'panel site-admin';
  panel.id = 'siteAdmin';
  panel.setAttribute('lang', 'hi');
  const note = dashboard.querySelector('.storage-note');
  if (note) note.insertAdjacentElement('beforebegin', panel);
  else dashboard.querySelector('.container').appendChild(panel);
}

function setSiteStatus(text, kind) {
  const el = document.getElementById('siteStatus');
  if (!el) return;
  el.textContent = text;
  el.className = 'gh-status' + (kind ? ' is-' + kind : '');
}

async function renderSiteAdmin() {
  const panel = document.getElementById('siteAdmin');
  if (!panel) return;
  if (!getGithubToken()) {
    panel.innerHTML = '<h2>वेबसाइट की फ़ोटो</h2><p class="gallery-admin-empty">पोस्टर और संस्थापक बदलने के लिए पहले ऊपर <strong>🚀 वेबसाइट पर प्रकाशित करें</strong> वाले हिस्से में GitHub टोकन जोड़ें।</p>';
    return;
  }
  panel.innerHTML = '<h2>वेबसाइट की फ़ोटो</h2><p class="gallery-admin-empty">लोड हो रहा है…</p>';
  try {
    siteData = await loadSiteData();
  } catch (error) {
    panel.innerHTML = '<h2>वेबसाइट की फ़ोटो</h2><p class="gh-status is-error">' + escapeHTML(error.message) + '</p>';
    return;
  }
  siteDirty = false;
  pendingPoster = null;
  Object.keys(founderUploads).forEach(function (k) { delete founderUploads[k]; });

  panel.innerHTML =
    '<h2>वेबसाइट की फ़ोटो</h2>' +
    '<p class="field-hint">यहाँ से होम पेज का मुख्य पोस्टर और संस्थापकों की फ़ोटो बदलें। सेव करते ही वेबसाइट पर चला जाएगा (3–10 मिनट में दिखेगा)।</p>' +
    '<h3>मुख्य पोस्टर</h3>' +
    '<div class="poster-box"><img id="posterPreview" alt="मुख्य पोस्टर की झलक" src="' + escapeHTML(sitePictureURL(siteData.hero.src)) + '">' +
      '<div class="poster-side"><div class="field"><label for="posterFile">नया पोस्टर चुनें</label><input id="posterFile" type="file" accept="image/*"></div>' +
      '<p class="field-hint">पोस्टर पूरा दिखता है, कटता नहीं। चौड़ा (आड़ा) पोस्टर सबसे अच्छा लगता है।</p>' +
      '<div class="form-actions"><button class="btn btn-primary" id="posterSave" type="button" disabled>पोस्टर बदलें</button>' +
      '<button class="btn btn-outline" id="posterCancel" type="button" hidden>रद्द करें</button></div></div></div>' +
    '<h3>संस्थापक और सह-संस्थापक</h3>' +
    '<p class="field-hint">गोल फ़ोटो पर उँगली या माउस से <strong>खींचकर</strong>, या स्लाइडर से फ़ोटो सेट करें। बदलाव के बाद नीचे <strong>"संस्थापक सेव करें"</strong> दबाएँ।</p>' +
    '<div class="founder-admin-list" id="founderList"></div>' +
    '<div class="form-actions" style="margin-top:1rem"><button class="btn btn-outline" id="founderAdd" type="button">+ नया व्यक्ति जोड़ें</button></div>' +
    '<div class="site-save-bar" id="siteSaveBar" hidden><strong>संस्थापकों में बदलाव सेव नहीं हुए हैं।</strong>' +
      '<button class="btn btn-primary" id="foundersSave" type="button">संस्थापक सेव करें</button>' +
      '<button class="btn btn-outline btn-small" id="foundersUndo" type="button">बदलाव रद्द करें</button></div>' +
    '<p class="gh-status" id="siteStatus"></p>';

  document.getElementById('posterFile').addEventListener('change', choosePoster);
  document.getElementById('posterSave').addEventListener('click', savePoster);
  document.getElementById('posterCancel').addEventListener('click', function () {
    pendingPoster = null;
    document.getElementById('posterFile').value = '';
    document.getElementById('posterPreview').src = sitePictureURL(siteData.hero.src);
    document.getElementById('posterSave').disabled = true;
    document.getElementById('posterCancel').hidden = true;
  });
  document.getElementById('founderAdd').addEventListener('click', function () {
    siteData.founders.push({ id: 'f' + Date.now().toString(36), name: '', role: 'सह-संस्थापक', lead: false, src: '', fx: 50, fy: 25, zoom: 1 });
    markFoundersChanged();
    renderFounderCards();
  });
  document.getElementById('foundersSave').addEventListener('click', saveFounders);
  document.getElementById('foundersUndo').addEventListener('click', function () {
    if (window.confirm('संस्थापकों के बिना सेव किए बदलाव हटाएँ?')) renderSiteAdmin();
  });
  renderFounderCards();
}

/* --------------------------------------------------------------------------
   Main poster
   -------------------------------------------------------------------------- */
async function choosePoster(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    setSiteStatus('पोस्टर तैयार हो रहा है…');
    pendingPoster = await compressPicture(file, 2000, 0.85);
    document.getElementById('posterPreview').src = pendingPoster;
    document.getElementById('posterSave').disabled = false;
    document.getElementById('posterCancel').hidden = false;
    setSiteStatus('झलक देख लें, फिर "पोस्टर बदलें" दबाएँ।');
  } catch (error) {
    event.target.value = '';
    setSiteStatus(error.message, 'error');
  }
}

async function savePoster() {
  if (!pendingPoster || ghBusy) return;
  ghBusy = true;
  const button = document.getElementById('posterSave');
  button.disabled = true;
  try {
    setSiteStatus('पोस्टर GitHub पर सेव हो रहा है…');
    const latest = await loadSiteData();              // keep founders as they are on GitHub
    const path = SITE_IMAGE_FOLDER + 'poster-' + Date.now().toString(36) + '.jpg';
    latest.hero = { src: path };
    await ghCommitFiles([
      { path: path, content: pendingPoster.split(',')[1], encoding: 'base64' },
      { path: SITE_JSON_PATH, content: JSON.stringify(latest, null, 2) + '\n' }
    ], 'Admin panel: मुख्य पोस्टर बदला');
    siteData.hero = latest.hero;
    pendingPoster = null;
    document.getElementById('posterFile').value = '';
    document.getElementById('posterCancel').hidden = true;
    setSiteStatus('✓ पोस्टर बदल गया। 3–10 मिनट में होम पेज पर दिखेगा।', 'ok');
    showToast('पोस्टर बदल गया ✓', 'success');
  } catch (error) {
    console.error(error);
    button.disabled = false;
    setSiteStatus(error.message || 'पोस्टर सेव नहीं हो पाया।', 'error');
  } finally {
    ghBusy = false;
  }
}

/* --------------------------------------------------------------------------
   Founders
   -------------------------------------------------------------------------- */
function markFoundersChanged() {
  siteDirty = true;
  const bar = document.getElementById('siteSaveBar');
  if (bar) bar.hidden = false;
}

function renderFounderCards() {
  const list = document.getElementById('founderList');
  list.innerHTML = siteData.founders.map(function (f, i) {
    const shown = founderUploads[f.id] || f.src;
    return '<div class="fa-card' + (founderUploads[f.id] ? ' is-changed' : '') + '" data-id="' + escapeHTML(f.id) + '">' +
      '<div class="fa-circle"><span class="fa-drag"><img alt="' + escapeHTML(f.name || 'फ़ोटो') + '" src="' + escapeHTML(sitePictureURL(shown)) + '" style="' + founderLookStyle(f) + '"></span></div>' +
      '<label>ज़ूम 🔍 <input type="range" min="1" max="3" step="0.05" value="' + (f.zoom || 1) + '" data-k="zoom"></label>' +
      '<label>बाएँ ↔ दाएँ <input type="range" min="0" max="100" step="1" value="' + (f.fx === undefined ? 50 : f.fx) + '" data-k="fx"></label>' +
      '<label>ऊपर ↕ नीचे <input type="range" min="0" max="100" step="1" value="' + (f.fy === undefined ? 25 : f.fy) + '" data-k="fy"></label>' +
      '<label>नाम <input type="text" maxlength="40" value="' + escapeHTML(f.name || '') + '" data-k="name" placeholder="जैसे: Aniket Yadav"></label>' +
      '<label>पद <input type="text" maxlength="30" value="' + escapeHTML(f.role || '') + '" data-k="role" placeholder="संस्थापक / सह-संस्थापक"></label>' +
      '<label class="fa-lead"><input type="checkbox" data-k="lead"' + (f.lead ? ' checked' : '') + '> लाल बैज (मुख्य संस्थापक)</label>' +
      '<div class="fa-row">' +
        '<label class="btn btn-outline btn-small" style="margin:0;flex-direction:row">फ़ोटो बदलें<input type="file" accept="image/*" data-k="file" hidden></label>' +
        '<button class="btn btn-outline btn-small" type="button" data-act="up"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
        '<button class="btn btn-outline btn-small" type="button" data-act="down"' + (i === siteData.founders.length - 1 ? ' disabled' : '') + '>↓</button>' +
        '<button class="btn btn-danger btn-small" type="button" data-act="remove">हटाएँ</button>' +
      '</div></div>';
  }).join('') || '<p class="gallery-admin-empty">अभी कोई व्यक्ति नहीं है। "+ नया व्यक्ति जोड़ें" दबाएँ।</p>';

  list.querySelectorAll('.fa-card').forEach(function (card) {
    const f = siteData.founders.find(function (x) { return x.id === card.getAttribute('data-id'); });
    const img = card.querySelector('img');
    const redraw = function () { img.setAttribute('style', founderLookStyle(f)); };

    card.querySelectorAll('input[type=range]').forEach(function (input) {
      input.addEventListener('input', function () {
        f[input.getAttribute('data-k')] = Number(input.value);
        redraw();
        markFoundersChanged();
      });
    });
    card.querySelectorAll('input[type=text]').forEach(function (input) {
      input.addEventListener('input', function () {
        f[input.getAttribute('data-k')] = input.value;
        img.alt = f.name || 'फ़ोटो';
        markFoundersChanged();
      });
    });
    card.querySelector('input[data-k=lead]').addEventListener('change', function (e) {
      f.lead = e.target.checked;
      markFoundersChanged();
    });
    card.querySelector('input[data-k=file]').addEventListener('change', async function (e) {
      const file = e.target.files[0];
      if (!file) return;
      try {
        founderUploads[f.id] = await compressPicture(file, 900, 0.85);
        Object.assign(f, { fx: 50, fy: 25, zoom: 1 });
        markFoundersChanged();
        renderFounderCards();
      } catch (error) {
        setSiteStatus(error.message, 'error');
      }
    });
    card.querySelectorAll('button[data-act]').forEach(function (button) {
      button.addEventListener('click', function () {
        const i = siteData.founders.indexOf(f);
        const act = button.getAttribute('data-act');
        if (act === 'up' && i > 0) siteData.founders.splice(i - 1, 0, siteData.founders.splice(i, 1)[0]);
        if (act === 'down' && i < siteData.founders.length - 1) siteData.founders.splice(i + 1, 0, siteData.founders.splice(i, 1)[0]);
        if (act === 'remove') {
          if (!window.confirm((f.name || 'इस व्यक्ति') + ' को संस्थापकों से हटाएँ?')) return;
          siteData.founders.splice(i, 1);
          delete founderUploads[f.id];
        }
        markFoundersChanged();
        renderFounderCards();
      });
    });

    // Drag the round photo to move it
    const area = card.querySelector('.fa-drag');
    let start = null;
    area.addEventListener('pointerdown', function (e) {
      start = { x: e.clientX, y: e.clientY, fx: f.fx === undefined ? 50 : f.fx, fy: f.fy === undefined ? 25 : f.fy };
      area.setPointerCapture(e.pointerId);
    });
    area.addEventListener('pointermove', function (e) {
      if (!start) return;
      const z = f.zoom || 1;
      f.fx = Math.max(0, Math.min(100, Math.round(start.fx - (e.clientX - start.x) / area.clientWidth * 100 / z)));
      f.fy = Math.max(0, Math.min(100, Math.round(start.fy - (e.clientY - start.y) / area.clientHeight * 100 / z)));
      card.querySelector('input[data-k=fx]').value = f.fx;
      card.querySelector('input[data-k=fy]').value = f.fy;
      redraw();
      markFoundersChanged();
    });
    ['pointerup', 'pointercancel'].forEach(function (t) { area.addEventListener(t, function () { start = null; }); });
  });
}

async function saveFounders() {
  if (ghBusy) return;
  const missing = siteData.founders.filter(function (f) { return !String(f.name || '').trim(); });
  if (missing.length) { setSiteStatus('हर व्यक्ति का नाम भरें।', 'error'); return; }
  ghBusy = true;
  const button = document.getElementById('foundersSave');
  button.disabled = true;
  try {
    setSiteStatus('संस्थापक GitHub पर सेव हो रहे हैं…');
    const files = [];
    siteData.founders.forEach(function (f) {
      if (founderUploads[f.id]) {
        const path = SITE_IMAGE_FOLDER + 'founder-' + f.id + '-' + Date.now().toString(36) + '.jpg';
        files.push({ path: path, content: founderUploads[f.id].split(',')[1], encoding: 'base64' });
        f.src = path;
      }
      f.name = String(f.name).trim();
      f.role = String(f.role || '').trim();
    });
    const latest = await loadSiteData();               // keep the poster as it is on GitHub
    const data = { hero: latest.hero || siteData.hero, founders: siteData.founders };
    files.push({ path: SITE_JSON_PATH, content: JSON.stringify(data, null, 2) + '\n' });
    await ghCommitFiles(files, 'Admin panel: संस्थापक अपडेट');
    Object.keys(founderUploads).forEach(function (k) { delete founderUploads[k]; });
    siteDirty = false;
    document.getElementById('siteSaveBar').hidden = true;
    setSiteStatus('✓ संस्थापक सेव हो गए। 3–10 मिनट में होम पेज पर दिखेंगे।', 'ok');
    showToast('संस्थापक सेव हो गए ✓', 'success');
    renderFounderCards();
  } catch (error) {
    console.error(error);
    setSiteStatus(error.message || 'सेव नहीं हो पाया।', 'error');
  } finally {
    ghBusy = false;
    button.disabled = false;
  }
}

window.addEventListener('beforeunload', function (e) {
  if (siteDirty || pendingPoster) { e.preventDefault(); e.returnValue = ''; }
});

/* --------------------------------------------------------------------------
   Start-up (admin page only), and again after the token is added or removed
   -------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', function () {
  if (!document.getElementById('dashboard') || typeof ghCommitFiles !== 'function') return;
  injectSiteAdminStyles();
  buildSiteAdminPanel();
  renderSiteAdmin();
  const ghPanel = document.getElementById('ghPanel');
  if (ghPanel && 'MutationObserver' in window) {
    let hadToken = !!getGithubToken();
    new MutationObserver(function () {
      const has = !!getGithubToken();
      if (has !== hadToken) { hadToken = has; renderSiteAdmin(); }
    }).observe(ghPanel, { childList: true });
  }
});
