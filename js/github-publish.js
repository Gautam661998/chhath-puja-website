/* ==========================================================================
   github-publish.js — Admin panel: publish straight to GitHub
   Load on admin.html AFTER main.js, hindi.js and kharcha.js.

   1. "🚀 सब बदलाव प्रकाशित करें" saves donations (main.js), kharcha
      (kharcha.js) and bills (kharcha-bills.js) directly to GitHub in one go.
      GitHub Pages then updates the website in 1–3 minutes.
   2. "गैलरी फ़ोटो" lets the admin add / remove gallery photos.
      Photos go to images/gallery/ and the list to data/gallery.json,
      which index.html shows through js/gallery.js.

   The GitHub token is NOT written in this file. Each admin enters it once
   on their own phone/computer; it is kept only in that browser.
   ========================================================================== */

'use strict';

/* --------------------------------------------------------------------------
   SETTINGS — your GitHub repository
   -------------------------------------------------------------------------- */
const GITHUB_OWNER = 'shreepurparsa';
const GITHUB_REPO = 'shreepurparsa.github.io';
const GITHUB_BRANCH = 'main';

const GH_TOKEN_KEY = 'chhathPuja.githubToken';
const GH_LAST_PUBLISH_KEY = 'chhathPuja.lastPublish';
const GALLERY_JSON_PATH = 'data/gallery.json';
const GALLERY_IMAGE_FOLDER = 'images/gallery/';
const GALLERY_VIDEO_FOLDER = 'videos/';
const VIDEO_MAX_BYTES = 6 * 1024 * 1024;       // videos bigger than this are made smaller
const VIDEO_TARGET_BYTES = 5.4 * 1024 * 1024;  // aim a little below 6 MB
const VIDEO_MAX_SECONDS = 62;                   // 1 minute (with a small margin)

/* --------------------------------------------------------------------------
   GITHUB API
   -------------------------------------------------------------------------- */
function getGithubToken() {
  try { return localStorage.getItem(GH_TOKEN_KEY) || ''; } catch (error) { return ''; }
}

function ghErrorMessage(status, text) {
  if (status === 401) return 'GitHub टोकन ग़लत है या उसकी मियाद ख़त्म हो गई। नया टोकन डालें।';
  if (status === 403) return 'इस टोकन को बदलाव की अनुमति नहीं है। टोकन में “Contents: Read and write” चुनें।';
  if (status === 404) return 'GitHub पर रिपॉज़िटरी नहीं मिली। टोकन में chhath-puja-website चुनी गई है, यह जाँचें।';
  if (status === 409 || status === 422) return 'GitHub पर अभी कोई और बदलाव हुआ है। 1 मिनट बाद फिर से प्रकाशित करें।';
  return 'GitHub से जुड़ नहीं पाए (' + status + ')। इंटरनेट जाँचें और फिर कोशिश करें।';
}

async function ghRequest(path, options) {
  const token = getGithubToken();
  if (!token) throw new Error('पहले GitHub टोकन जोड़ें।');
  const settings = options || {};
  let response;
  try {
    response = await fetch('https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + path, {
      method: settings.method || 'GET',
      headers: Object.assign({
        Authorization: 'Bearer ' + token,
        Accept: settings.raw ? 'application/vnd.github.raw' : 'application/vnd.github+json'
      }, settings.body ? { 'Content-Type': 'application/json' } : {}),
      body: settings.body ? JSON.stringify(settings.body) : undefined,
      cache: 'no-store'
    });
  } catch (error) {
    throw new Error('इंटरनेट से जुड़ नहीं पाए। नेटवर्क जाँचकर फिर कोशिश करें।');
  }
  if (settings.allow404 && response.status === 404) return null;
  if (!response.ok) {
    const text = await response.text().catch(function () { return ''; });
    console.error('GitHub API', response.status, text);
    throw new Error(ghErrorMessage(response.status, text));
  }
  if (settings.raw) return response.text();
  if (response.status === 204) return null;
  return response.json();
}

/** Reads a text file from the repository (null if it does not exist). */
function ghReadText(path) {
  return ghRequest('/contents/' + path.split('/').map(encodeURIComponent).join('/') + '?ref=' + GITHUB_BRANCH,
    { raw: true, allow404: true });
}

/**
 * Saves several files in ONE commit, so GitHub Pages rebuilds only once.
 * files: [{ path, content, encoding: 'utf-8' | 'base64' }] or [{ path, remove: true }]
 */
async function ghCommitFiles(files, message) {
  const ref = await ghRequest('/git/ref/heads/' + GITHUB_BRANCH);
  const parentSha = ref.object.sha;
  const parent = await ghRequest('/git/commits/' + parentSha);

  const tree = [];
  for (const file of files) {
    if (file.remove) {
      tree.push({ path: file.path, mode: '100644', type: 'blob', sha: null });
      continue;
    }
    const blob = await ghRequest('/git/blobs', {
      method: 'POST',
      body: { content: file.content, encoding: file.encoding || 'utf-8' }
    });
    tree.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
  }

  const newTree = await ghRequest('/git/trees', { method: 'POST', body: { base_tree: parent.tree.sha, tree: tree } });
  const commit = await ghRequest('/git/commits', {
    method: 'POST',
    body: { message: message, tree: newTree.sha, parents: [parentSha] }
  });
  await ghRequest('/git/refs/heads/' + GITHUB_BRANCH, { method: 'PATCH', body: { sha: commit.sha } });
  return commit;
}

/* --------------------------------------------------------------------------
   BUILD THE FILES (same format as the download buttons)
   -------------------------------------------------------------------------- */
async function buildMainJs(source) {
  const startMarker = 'const SAMPLE_DONATIONS = [';
  const endMarker = '].map(function ([name, amount, date], index) {';
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start === -1 || end === -1) throw new Error('main.js में दान सूची नहीं मिली।');

  const records = await DonationStore.getAll();
  const years = Array.from(new Set(records.map(function (r) { return r.year; }))).sort(function (a, b) { return b - a; });
  const order = function (r) {
    const match = String(r.id).match(/^sample-(\d+)$/);
    return match ? Number(match[1]) : Infinity;
  };

  const lines = [startMarker];
  years.forEach(function (year) {
    const list = records.filter(function (r) { return r.year === year; }).sort(function (a, b) {
      return order(a) - order(b) || String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    });
    lines.push('  // ---------- Chhath Puja ' + year + ' — ' + list.length + ' donations, total ' +
      formatINR(summarizeDonations(list).total) + ' ----------');
    list.forEach(function (r) {
      lines.push('  [' + JSON.stringify(r.name) + ', ' + Number(r.amount) + ', ' + JSON.stringify(r.date) + '],');
    });
    lines.push('');
  });
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/,$/.test(lines[i])) { lines[i] = lines[i].replace(/,$/, ''); break; }
  }
  if (!records.length) lines.push('  // No donations yet');

  let output = source.slice(0, start) + lines.join('\n').replace(/\n+$/, '') + '\n' + source.slice(end);
  if (typeof OLD_MERGE_BLOCK === 'string' && output.indexOf('const publishedNow = {};') === -1 &&
      output.indexOf(OLD_MERGE_BLOCK) !== -1) {
    output = output.replace(OLD_MERGE_BLOCK, NEW_MERGE_BLOCK);
  }
  new Function(output); // safety check: valid JavaScript
  return output;
}

function buildKharchaJs(source) {
  if (typeof kharchaDraft === 'undefined' || !kharchaDraft) return null;
  const startMarker = '/* EXPENSES-START';
  const endMarker = '/* EXPENSES-END */';
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start === -1 || end === -1) throw new Error('kharcha.js में खर्चे की सूची नहीं मिली।');

  const years = Object.keys(kharchaDraft.expenses).map(Number).sort(function (a, b) { return b - a; })
    .filter(function (y) { return (kharchaDraft.expenses[y] || []).length; });

  const lines = ['/* EXPENSES-START — this block is rewritten by the admin panel */', 'const EXPENSES = {'];
  years.forEach(function (year) {
    lines.push('  ' + year + ': [');
    kharchaDraft.expenses[year].forEach(function (r) {
      lines.push('    { item: ' + JSON.stringify(r.item) + ', amount: ' + Number(r.amount) +
        ', note: ' + JSON.stringify(r.note || '') + ', show: ' + (isShown(r) ? 'true' : 'false') +
        (r.bill ? ', bill: ' + JSON.stringify(r.bill) : '') + ' },');
    });
    lines.push('  ],');
  });
  lines.push('};', '');
  lines.push('// hiddenAsOther: true  → hidden items are added up and shown as one line "अन्य खर्च",');
  lines.push('//                        so the village still sees the correct total and balance.');
  lines.push('// hiddenAsOther: false → hidden items are left out completely (no balance is shown).');
  lines.push('const EXPENSE_SETTINGS = {');
  years.forEach(function (year) {
    lines.push('  ' + year + ': { hiddenAsOther: ' + (hiddenAsOther(kharchaDraft.settings, year) ? 'true' : 'false') + ' },');
  });
  lines.push('};', '');

  const output = source.slice(0, start) + lines.join('\n') + source.slice(end);
  new Function(output);
  return output;
}

async function buildBillsJs() {
  if (typeof referencedBillIds !== 'function' || !kharchaDraft) return null;
  const ids = referencedBillIds();
  if (!ids.length) return null;
  const bills = {};
  for (const id of ids) {
    const data = await getBillData(id);
    if (!data) throw new Error('कुछ बिल फ़ोटो नहीं मिलीं। पेज रीफ़्रेश करके फिर कोशिश करें।');
    bills[id] = data;
  }
  const lines = [
    '/* Bill photos for kharcha.js — created by the admin panel.',
    '   Visitors download this file only when they tap "बिल देखें". */',
    'window.KHARCHA_BILLS = {'
  ];
  ids.forEach(function (id) { lines.push('  ' + JSON.stringify(id) + ': ' + JSON.stringify(bills[id]) + ','); });
  lines.push('};', '');
  return lines.join('\n');
}

/* --------------------------------------------------------------------------
   ADMIN UI: PUBLISH PANEL
   -------------------------------------------------------------------------- */
function injectGithubStyles() {
  if (document.getElementById('ghPublishStyles')) return;
  const style = document.createElement('style');
  style.id = 'ghPublishStyles';
  style.textContent = [
    '.gh-panel{margin-bottom:2rem;border:2px solid var(--marigold);background:linear-gradient(135deg,#fff8ea,#fff);}',
    '.gh-panel h2{font-size:var(--step-2);margin-bottom:.3rem;}',
    '.gh-row{display:flex;flex-wrap:wrap;align-items:center;gap:.75rem;margin-top:1rem;}',
    '.gh-publish-btn{min-height:56px;padding:.7rem 1.8rem;font-size:1.15rem;}',
    '.gh-status{margin:.75rem 0 0;font-size:var(--step--1);color:var(--ink-soft);}',
    '.gh-status.is-ok{color:var(--success);font-weight:600;}',
    '.gh-status.is-error{color:var(--sindoor);font-weight:600;}',
    '.gh-token-input{flex:1 1 260px;min-height:46px;padding:.5rem .8rem;border:2px solid var(--line);border-radius:var(--radius-small);font:inherit;}',
    '.gh-help{margin-top:.75rem;font-size:var(--step--1);color:var(--ink-soft);}',
    '.gh-help summary{cursor:pointer;font-weight:600;color:var(--sindoor);}',
    '.gh-help ol{padding-left:1.25rem;}',
    '.gh-connected{display:inline-flex;align-items:center;gap:.4rem;padding:.2rem .8rem;border-radius:999px;background:#eaf5e7;color:var(--success);font-weight:600;font-size:var(--step--1);}',
    '.gallery-admin{margin-top:2.5rem;}',
    '.gallery-admin-form{display:grid;grid-template-columns:1.3fr 1fr 1fr auto;gap:1rem;align-items:end;}',
    '.gallery-admin-form .field{margin:0;}',
    '.gallery-admin-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:1rem;margin-top:1.5rem;}',
    '.gallery-admin-item{margin:0;border:1px solid var(--line);border-radius:var(--radius-medium);overflow:hidden;background:var(--white);}',
    '.gallery-admin-item img{width:100%;height:120px;object-fit:cover;background:var(--paper-deep);}',
    '.gallery-admin-item figcaption{padding:.5rem .6rem;font-size:var(--step--1);}',
    '.gallery-admin-item .btn{margin:0 .6rem .6rem;}',
    '.gallery-admin-empty{color:var(--ink-soft);}',
    '.gal-editor{margin-top:1.25rem;padding:1.25rem;border:2px dashed var(--marigold);border-radius:var(--radius-medium);background:var(--paper);}',
    '.gal-editor-title{font-weight:600;color:var(--sindoor);margin:0 0 .75rem;}',
    '.gal-previews{display:flex;flex-wrap:wrap;gap:1.25rem;align-items:flex-end;margin-bottom:1rem;}',
    '.gal-previews figure{margin:0;}',
    '.gal-previews figcaption{font-size:var(--step--1);color:var(--ink-soft);margin-top:.35rem;text-align:center;}',
    '.gal-frame{position:relative;overflow:hidden;border-radius:12px;background:var(--paper-deep);cursor:grab;touch-action:none;box-shadow:0 0 0 2px var(--line);}',
    '.gal-frame img{width:100%;height:100%;display:block;pointer-events:none;user-select:none;}',
    '.gal-controls{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.75rem 1.25rem;margin-bottom:.5rem;}',
    '.gal-controls label{display:flex;flex-direction:column;gap:.3rem;font-weight:600;font-size:.95rem;}',
    '.gal-controls input{width:100%;accent-color:var(--sindoor);}',
    '@media (max-width:640px){.gal-controls{grid-template-columns:1fr;}}',
    '.gal-video{display:flex;flex-wrap:wrap;gap:1rem;align-items:flex-start;margin-bottom:1rem;}',
    '.gal-video video{width:260px;max-width:100%;max-height:260px;border-radius:12px;background:#000;}',
    '.gal-video-side{flex:1;min-width:200px;}',
    '.gal-video-info{font-weight:600;margin:0 0 .5rem;}',
    '.gal-progress{height:12px;border-radius:999px;background:var(--paper-deep);overflow:hidden;margin-bottom:.75rem;}',
    '.gal-progress span{display:block;height:100%;width:0;background:var(--sindoor);transition:width .2s;}',
    '.gal-cover-note{margin:.25rem 0 .75rem;}',
    '.gal-play-badge{position:absolute;left:8px;top:8px;z-index:1;padding:2px 10px;border-radius:999px;background:rgba(0,0,0,.65);color:#fff;font-size:.8rem;font-weight:600;}',
    '@media (max-width:960px){.gallery-admin-form{grid-template-columns:1fr 1fr;}}',
    '@media (max-width:640px){.gallery-admin-form{grid-template-columns:1fr;}}'
  ].join('\n');
  document.head.appendChild(style);
}

function setGhStatus(text, kind) {
  const status = document.getElementById('ghStatus');
  if (!status) return;
  status.textContent = text;
  status.className = 'gh-status' + (kind ? ' is-' + kind : '');
}

function renderGithubPanel() {
  const panel = document.getElementById('ghPanel');
  if (!panel) return;
  const token = getGithubToken();
  let last = '';
  try { last = localStorage.getItem(GH_LAST_PUBLISH_KEY) || ''; } catch (error) { /* ignore */ }

  if (!token) {
    panel.innerHTML =
      '<h2>🚀 वेबसाइट पर प्रकाशित करें</h2>' +
      '<p class="field-hint">एक बार GitHub टोकन जोड़ दें। उसके बाद बस एक बटन दबाकर दान, खर्चा और फ़ोटो सीधे वेबसाइट पर चले जाएँगे।</p>' +
      '<div class="gh-row">' +
        '<input class="gh-token-input" id="ghTokenInput" type="password" autocomplete="off" placeholder="github_pat_… (GitHub टोकन)" aria-label="GitHub टोकन">' +
        '<button class="btn btn-primary" id="ghTokenSave" type="button">टोकन जोड़ें</button>' +
      '</div>' +
      '<details class="gh-help"><summary>टोकन कैसे बनाएँ?</summary><ol>' +
        '<li>github.com पर लॉग इन करें → ऊपर दाईं ओर अपनी फ़ोटो → <strong>Settings</strong></li>' +
        '<li>सबसे नीचे बाईं ओर <strong>Developer settings</strong> → <strong>Personal access tokens</strong> → <strong>Fine-grained tokens</strong></li>' +
        '<li><strong>Generate new token</strong> → नाम: <code>chhath-admin</code>, Expiration: 90 days</li>' +
        '<li><strong>Repository access</strong>: Only select repositories → <code>chhath-puja-website</code></li>' +
        '<li><strong>Permissions → Repository permissions → Contents</strong>: <strong>Read and write</strong></li>' +
        '<li><strong>Generate token</strong> दबाएँ, टोकन कॉपी करके यहाँ पेस्ट करें</li>' +
      '</ol></details>' +
      '<p class="gh-status" id="ghStatus"></p>';
    document.getElementById('ghTokenSave').addEventListener('click', saveGithubToken);
    return;
  }

  panel.innerHTML =
    '<h2>🚀 वेबसाइट पर प्रकाशित करें</h2>' +
    '<p class="field-hint">दान या खर्चा जोड़ने/बदलने के बाद यह बटन दबाएँ। 1–3 मिनट में सबको वेबसाइट पर दिखेगा।</p>' +
    '<div class="gh-row">' +
      '<button class="btn btn-primary gh-publish-btn" id="ghPublishBtn" type="button">🚀 सब बदलाव प्रकाशित करें</button>' +
      '<span class="gh-connected">✓ GitHub से जुड़ा है</span>' +
      '<button class="btn btn-outline btn-small" id="ghTokenRemove" type="button">टोकन हटाएँ</button>' +
    '</div>' +
    '<p class="gh-status" id="ghStatus">' + (last ? 'पिछली बार प्रकाशित: ' + escapeHTML(last) : '') + '</p>';
  document.getElementById('ghPublishBtn').addEventListener('click', publishEverything);
  document.getElementById('ghTokenRemove').addEventListener('click', function () {
    if (!window.confirm('इस फ़ोन/कंप्यूटर से GitHub टोकन हटाएँ?')) return;
    try { localStorage.removeItem(GH_TOKEN_KEY); } catch (error) { /* ignore */ }
    renderGithubPanel();
    renderGalleryAdmin();
  });
}

async function saveGithubToken() {
  const input = document.getElementById('ghTokenInput');
  const token = input.value.trim();
  if (!token) { setGhStatus('टोकन पेस्ट करें।', 'error'); return; }
  try { localStorage.setItem(GH_TOKEN_KEY, token); } catch (error) {
    setGhStatus('ब्राउज़र में टोकन सेव नहीं हो पाया।', 'error');
    return;
  }
  setGhStatus('जाँच हो रही है…');
  try {
    const repo = await ghRequest('');
    if (repo.permissions && repo.permissions.push === false) {
      throw new Error('इस टोकन को बदलाव की अनुमति नहीं है। टोकन में “Contents: Read and write” चुनें।');
    }
    renderGithubPanel();
    renderGalleryAdmin();
    showToast('GitHub से जुड़ गया ✓', 'success');
  } catch (error) {
    try { localStorage.removeItem(GH_TOKEN_KEY); } catch (e) { /* ignore */ }
    setGhStatus(error.message, 'error');
  }
}

let ghBusy = false;

async function publishEverything() {
  if (ghBusy) return;
  const button = document.getElementById('ghPublishBtn');
  ghBusy = true;
  button.disabled = true;
  button.textContent = 'प्रकाशित हो रहा है…';
  setGhStatus('GitHub से नई फ़ाइलें पढ़ी जा रही हैं…');

  try {
    const changes = [];
    const labels = [];

    // Donations
    const mainSource = await ghReadText('js/main.js');
    if (!mainSource) throw new Error('GitHub पर js/main.js नहीं मिली।');
    const newMain = await buildMainJs(mainSource);
    if (newMain !== mainSource) { changes.push({ path: 'js/main.js', content: newMain }); labels.push('दान'); }

    // Kharcha
    const kharchaSource = await ghReadText('js/kharcha.js');
    if (kharchaSource) {
      const newKharcha = buildKharchaJs(kharchaSource);
      if (newKharcha && newKharcha !== kharchaSource) { changes.push({ path: 'js/kharcha.js', content: newKharcha }); labels.push('खर्चा'); }

      const newBills = await buildBillsJs();
      if (newBills) {
        const oldBills = await ghReadText('js/kharcha-bills.js');
        if (newBills !== oldBills) { changes.push({ path: 'js/kharcha-bills.js', content: newBills }); labels.push('बिल'); }
      }
    }

    if (!changes.length) {
      setGhStatus('कोई नया बदलाव नहीं है। वेबसाइट पहले से अपडेट है ✓', 'ok');
      showToast('कोई नया बदलाव नहीं');
      return;
    }

    setGhStatus('GitHub पर सेव हो रहा है…');
    await ghCommitFiles(changes, 'Admin panel: ' + labels.join(', ') + ' अपडेट');

    const time = new Date().toLocaleString('hi-IN', { dateStyle: 'medium', timeStyle: 'short' });
    try { localStorage.setItem(GH_LAST_PUBLISH_KEY, time + ' (' + labels.join(', ') + ')'); } catch (error) { /* ignore */ }
    setGhStatus('✓ प्रकाशित हो गया (' + labels.join(', ') + ')। 1–3 मिनट में वेबसाइट पर दिखेगा।', 'ok');
    showToast('प्रकाशित हो गया ✓ 1–3 मिनट में वेबसाइट पर दिखेगा', 'success');
  } catch (error) {
    console.error(error);
    setGhStatus(error.message || 'प्रकाशित नहीं हो पाया।', 'error');
    showToast(error.message || 'प्रकाशित नहीं हो पाया।', 'error');
  } finally {
    ghBusy = false;
    button.disabled = false;
    button.textContent = '🚀 सब बदलाव प्रकाशित करें';
  }
}

/** The old download boxes are now only a backup. */
function relabelOldPublishBoxes() {
  document.querySelectorAll('#toolsPanel .publish-box, #kharchaAdmin .publish-box').forEach(function (box) {
    const steps = box.querySelector('.publish-steps');
    if (steps && !box.querySelector('.gh-backup-note')) {
      // Keep the old list in the page (kharcha.js still uses it), just hide it
      steps.hidden = true;
      const note = document.createElement('p');
      note.className = 'field-hint gh-backup-note';
      note.innerHTML = 'अब प्रकाशित करने के लिए ऊपर वाला <strong>🚀 सब बदलाव प्रकाशित करें</strong> बटन दबाएँ। ' +
        'नीचे का बटन सिर्फ़ बैकअप के लिए है।';
      steps.insertAdjacentElement('beforebegin', note);
    }
    const title = box.querySelector('h2, h3');
    if (title) title.textContent = 'बैकअप फ़ाइल';
  });
}

/* --------------------------------------------------------------------------
   ADMIN UI: GALLERY PHOTOS
   -------------------------------------------------------------------------- */
function galleryImageURL(path) {
  // Shows new photos immediately, even before GitHub Pages has updated
  return 'https://raw.githubusercontent.com/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/' + GITHUB_BRANCH + '/' + path;
}

async function readGalleryList() {
  const text = await ghReadText(GALLERY_JSON_PATH);
  if (!text) return [];
  try {
    const list = JSON.parse(text);
    return Array.isArray(list) ? list : [];
  } catch (error) {
    return [];
  }
}

function buildGalleryAdminPanel() {
  const dashboard = document.getElementById('dashboard');
  if (!dashboard || document.getElementById('galleryAdmin')) return;
  const panel = document.createElement('section');
  panel.className = 'panel gallery-admin';
  panel.id = 'galleryAdmin';
  panel.setAttribute('lang', 'hi');
  const note = dashboard.querySelector('.storage-note');
  if (note) note.insertAdjacentElement('beforebegin', panel);
  else dashboard.querySelector('.container').appendChild(panel);
}

/* Tile shapes of the home-page gallery, so the preview matches the real page:
   [width, height] on a computer and on a phone, for each size choice. */
const GALLERY_SHAPES = {
  '':     { desk: [365, 220], phone: [180, 170] },
  'wide': { desk: [745, 220], phone: [372, 170] },
  'tall': { desk: [365, 452], phone: [180, 352] }
};

/** The same picture settings the home page uses (see gallery.js). */
function galleryImageStyle(fx, fy, zoom) {
  return 'object-fit:cover;object-position:' + fx + '% ' + fy + '%;transform:scale(' + zoom + ');transform-origin:' + fx + '% ' + fy + '%';
}

let galleryEdit = null;     // { mode: 'new' | 'edit', id, src, fx, fy, zoom }

async function renderGalleryAdmin() {
  const panel = document.getElementById('galleryAdmin');
  if (!panel) return;

  if (!getGithubToken()) {
    panel.innerHTML = '<h2>गैलरी फ़ोटो</h2><p class="gallery-admin-empty">फ़ोटो जोड़ने के लिए पहले ऊपर <strong>🚀 वेबसाइट पर प्रकाशित करें</strong> वाले हिस्से में GitHub टोकन जोड़ें।</p>';
    return;
  }

  panel.innerHTML =
    '<h2>गैलरी फ़ोटो</h2>' +
    '<p class="field-hint">यहाँ से जोड़ी गई फ़ोटो होम पेज की गैलरी में सबसे आख़िर में दिखेंगी (3–10 मिनट बाद)।</p>' +
    '<form class="gallery-admin-form" id="galleryForm" novalidate>' +
      '<div class="field"><label for="galleryFile">फ़ोटो या वीडियो चुनें</label><input id="galleryFile" type="file" accept="image/*,video/*"></div>' +
      '<div class="field"><label for="galleryCaption">फ़ोटो का नाम / विवरण</label><input id="galleryCaption" type="text" maxlength="80" placeholder="जैसे: संध्या अर्घ्य 2026"></div>' +
      '<div class="field"><label for="gallerySize">आकार</label><select id="gallerySize">' +
        '<option value="">सामान्य</option><option value="wide">चौड़ी (2 खाने)</option><option value="tall">लंबी (2 खाने ऊँची)</option>' +
      '</select></div>' +
      '<button class="btn btn-primary" id="galleryAddBtn" type="submit">फ़ोटो जोड़ें</button>' +
    '</form>' +
    '<div class="gal-editor" id="galEditor" hidden>' +
      '<p class="gal-editor-title" id="galEditorTitle">फ़ोटो ठीक से सेट करें</p>' +
      '<div class="gal-video" id="galVideo" hidden>' +
        '<video id="galVideoPreview" controls playsinline preload="metadata"></video>' +
        '<div class="gal-video-side"><p class="gal-video-info" id="galVideoInfo"></p>' +
        '<div class="gal-progress" id="galProgress" hidden><span id="galProgressBar"></span></div>' +
        '<button class="btn btn-primary btn-small" id="galCompressBtn" type="button" hidden>वीडियो छोटा करें</button>' +
        '<p class="field-hint" id="galVideoHint"></p></div>' +
      '</div>' +
      '<p class="field-hint gal-cover-note" id="galCoverNote" hidden>नीचे वीडियो की <strong>कवर फ़ोटो</strong> है, जो गैलरी में ▶ के साथ दिखेगी। इसे ज़ूम और सरका सकते हैं।</p>' +
      '<div class="gal-previews">' +
        '<figure><div class="gal-frame" id="galFrameDesk"><img alt="कंप्यूटर पर झलक" draggable="false"></div><figcaption>कंप्यूटर पर ऐसी दिखेगी</figcaption></figure>' +
        '<figure><div class="gal-frame" id="galFramePhone"><img alt="फ़ोन पर झलक" draggable="false"></div><figcaption>फ़ोन पर ऐसी दिखेगी</figcaption></figure>' +
      '</div>' +
      '<div class="gal-controls">' +
        '<label>ज़ूम 🔍 <input id="galZoom" type="range" min="1" max="2.5" step="0.05" value="1"></label>' +
        '<label>बाएँ ↔ दाएँ <input id="galX" type="range" min="0" max="100" step="1" value="50"></label>' +
        '<label>ऊपर ↕ नीचे <input id="galY" type="range" min="0" max="100" step="1" value="50"></label>' +
      '</div>' +
      '<p class="field-hint">झलक पर उँगली या माउस से <strong>खींचकर</strong> भी फ़ोटो सरका सकते हैं। चेहरे बीच में आ जाएँ, तो बढ़िया।</p>' +
      '<div class="form-actions"><button class="btn btn-outline btn-small" id="galReset" type="button">पहले जैसा</button>' +
      '<button class="btn btn-outline btn-small" id="galCancel" type="button">रद्द करें</button></div>' +
    '</div>' +
    '<p class="gh-status" id="galleryStatus"></p>' +
    '<div class="gallery-admin-list" id="galleryList"><p class="gallery-admin-empty">फ़ोटो लोड हो रही हैं…</p></div>';

  document.getElementById('galleryForm').addEventListener('submit', saveGalleryPhoto);
  document.getElementById('galleryFile').addEventListener('change', chooseGalleryFile);
  document.getElementById('gallerySize').addEventListener('change', drawGalleryPreview);
  ['galZoom', 'galX', 'galY'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', function () {
      if (!galleryEdit) return;
      galleryEdit.zoom = Number(document.getElementById('galZoom').value);
      galleryEdit.fx = Number(document.getElementById('galX').value);
      galleryEdit.fy = Number(document.getElementById('galY').value);
      drawGalleryPreview();
    });
  });
  document.getElementById('galReset').addEventListener('click', function () {
    if (!galleryEdit) return;
    Object.assign(galleryEdit, { fx: 50, fy: 50, zoom: 1 });
    syncGallerySliders();
    drawGalleryPreview();
  });
  document.getElementById('galCancel').addEventListener('click', closeGalleryEditor);
  document.getElementById('galCompressBtn').addEventListener('click', startVideoCompression);
  ['galFrameDesk', 'galFramePhone'].forEach(enableGalleryDrag);
  document.getElementById('galleryList').addEventListener('click', function (event) {
    const remove = event.target.closest('button[data-remove]');
    if (remove) removeGalleryPhoto(remove.getAttribute('data-remove'));
    const edit = event.target.closest('button[data-edit]');
    if (edit) openGalleryEdit(edit.getAttribute('data-edit'));
  });
  await refreshGalleryList();
}

function syncGallerySliders() {
  document.getElementById('galZoom').value = galleryEdit.zoom;
  document.getElementById('galX').value = galleryEdit.fx;
  document.getElementById('galY').value = galleryEdit.fy;
}

/** Draws both previews in the real tile shapes with the current settings. */
function drawGalleryPreview() {
  if (!galleryEdit) return;
  const shape = GALLERY_SHAPES[document.getElementById('gallerySize').value] || GALLERY_SHAPES[''];
  [['galFrameDesk', shape.desk, 300], ['galFramePhone', shape.phone, 150]].forEach(function (f) {
    const frame = document.getElementById(f[0]);
    const w = f[2], h = Math.round(f[2] * f[1][1] / f[1][0]);
    frame.style.width = w + 'px';
    frame.style.height = Math.min(h, 320) + 'px';
    if (h > 320) frame.style.width = Math.round(320 * f[1][0] / f[1][1]) + 'px';
    const img = frame.querySelector('img');
    if (img.getAttribute('src') !== galleryEdit.src) img.src = galleryEdit.src;
    img.setAttribute('style', galleryImageStyle(galleryEdit.fx, galleryEdit.fy, galleryEdit.zoom));
  });
}

/** Drag on a preview to move the picture inside its frame. */
function enableGalleryDrag(frameId) {
  const frame = document.getElementById(frameId);
  let start = null;
  frame.addEventListener('pointerdown', function (event) {
    if (!galleryEdit) return;
    start = { x: event.clientX, y: event.clientY, fx: galleryEdit.fx, fy: galleryEdit.fy };
    frame.setPointerCapture(event.pointerId);
  });
  frame.addEventListener('pointermove', function (event) {
    if (!start || !galleryEdit) return;
    const dx = (event.clientX - start.x) / frame.clientWidth * 100 / galleryEdit.zoom;
    const dy = (event.clientY - start.y) / frame.clientHeight * 100 / galleryEdit.zoom;
    galleryEdit.fx = Math.max(0, Math.min(100, Math.round(start.fx - dx)));
    galleryEdit.fy = Math.max(0, Math.min(100, Math.round(start.fy - dy)));
    syncGallerySliders();
    drawGalleryPreview();
  });
  ['pointerup', 'pointercancel'].forEach(function (type) {
    frame.addEventListener(type, function () { start = null; });
  });
}

async function chooseGalleryFile(event) {
  const file = event.target.files[0];
  if (!file) { closeGalleryEditor(); return; }
  if (/^video\//.test(file.type)) { chooseGalleryVideo(file, event.target); return; }
  setGalleryStatus('फ़ोटो तैयार हो रही है…');
  try {
    const dataURL = await compressBillImage(file);        // from kharcha.js
    galleryEdit = { mode: 'new', src: dataURL, fx: 50, fy: 50, zoom: 1 };
    openGalleryEditor('नई फ़ोटो: ठीक से सेट करें, फिर "फ़ोटो जोड़ें" दबाएँ', 'फ़ोटो जोड़ें');
    setGalleryStatus('');
  } catch (error) {
    event.target.value = '';
    setGalleryStatus(error.message, 'error');
  }
}

async function openGalleryEdit(id) {
  const list = await readGalleryList();
  const photo = list.find(function (p) { return p.id === id; });
  if (!photo) return;
  galleryEdit = {
    mode: 'edit', id: id, kind: photo.kind || 'photo', src: galleryImageURL(photo.src),
    fx: photo.fx === undefined ? 50 : photo.fx, fy: photo.fy === undefined ? 50 : photo.fy, zoom: photo.zoom || 1
  };
  document.getElementById('galleryCaption').value = photo.caption || '';
  document.getElementById('gallerySize').value = photo.size || '';
  document.getElementById('galleryFile').value = '';
  openGalleryEditor('फ़ोटो बदलें: "' + (photo.caption || 'फ़ोटो') + '"', 'बदलाव सेव करें');
  document.getElementById('galEditor').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function openGalleryEditor(title, buttonText) {
  const isVideo = !!(galleryEdit && galleryEdit.kind === 'video');
  document.getElementById('galVideo').hidden = !(isVideo && galleryEdit.mode === 'new');
  document.getElementById('galCoverNote').hidden = !isVideo;
  document.getElementById('galEditorTitle').textContent = title;
  document.getElementById('galleryAddBtn').textContent = buttonText;
  document.getElementById('galEditor').hidden = false;
  syncGallerySliders();
  drawGalleryPreview();
}

function closeGalleryEditor() {
  if (galleryEdit && galleryEdit.url) URL.revokeObjectURL(galleryEdit.url);
  const preview = document.getElementById('galVideoPreview');
  if (preview) { preview.pause(); preview.removeAttribute('src'); preview.load(); }
  galleryEdit = null;
  const form = document.getElementById('galleryForm');
  if (form) form.reset();
  document.getElementById('galEditor').hidden = true;
  document.getElementById('galleryAddBtn').textContent = 'फ़ोटो जोड़ें';
}

async function refreshGalleryList() {
  const listBox = document.getElementById('galleryList');
  if (!listBox) return;
  try {
    const list = await readGalleryList();
    listBox.innerHTML = list.length ? list.map(function (photo) {
      const fx = photo.fx === undefined ? 50 : photo.fx, fy = photo.fy === undefined ? 50 : photo.fy;
      return '<figure class="gallery-admin-item">' +
        '<div style="position:relative;height:120px;overflow:hidden;background:var(--paper-deep)">' + (photo.kind === 'video' ? '<span class="gal-play-badge">▶ वीडियो</span>' : '') + '<img src="' + escapeHTML(galleryImageURL(photo.src)) + '" alt="' + escapeHTML(photo.caption || 'फ़ोटो') + '" loading="lazy" style="width:100%;height:100%;' + galleryImageStyle(fx, fy, photo.zoom || 1) + '"></div>' +
        '<figcaption>' + escapeHTML(photo.caption || '–') + '</figcaption>' +
        '<div style="display:flex;gap:.4rem;padding:0 .6rem .6rem"><button class="btn btn-outline btn-small" type="button" data-edit="' + escapeHTML(photo.id) + '">बदलें</button>' +
        '<button class="btn btn-danger btn-small" type="button" data-remove="' + escapeHTML(photo.id) + '">हटाएँ</button></div>' +
      '</figure>';
    }).join('') : '<p class="gallery-admin-empty">अभी यहाँ से कोई फ़ोटो नहीं जोड़ी गई है। (पुरानी गैलरी फ़ोटो वैसी ही रहेंगी।)</p>';
  } catch (error) {
    listBox.innerHTML = '<p class="gh-status is-error">' + escapeHTML(error.message) + '</p>';
  }
}

function setGalleryStatus(text, kind) {
  const status = document.getElementById('galleryStatus');
  if (!status) return;
  status.textContent = text;
  status.className = 'gh-status' + (kind ? ' is-' + kind : '');
}

async function saveGalleryPhoto(event) {
  event.preventDefault();
  if (ghBusy) return;
  if (!galleryEdit) { setGalleryStatus('पहले फ़ोटो चुनें।', 'error'); return; }
  const caption = document.getElementById('galleryCaption').value.trim();
  const size = document.getElementById('gallerySize').value;
  const look = { fx: galleryEdit.fx, fy: galleryEdit.fy, zoom: galleryEdit.zoom };

  const button = document.getElementById('galleryAddBtn');
  ghBusy = true;
  button.disabled = true;
  try {
    setGalleryStatus('GitHub पर सेव हो रही है…');
    const list = await readGalleryList();
    if (galleryEdit.mode === 'edit') {
      const photo = list.find(function (p) { return p.id === galleryEdit.id; });
      if (!photo) throw new Error('यह फ़ोटो अब गैलरी में नहीं है।');
      Object.assign(photo, { caption: caption, size: size }, look);
      await ghCommitFiles([{ path: GALLERY_JSON_PATH, content: JSON.stringify(list, null, 2) + '\n' }],
        'Admin panel: गैलरी फ़ोटो बदली' + (caption ? ' — ' + caption : ''));
      setGalleryStatus('✓ बदलाव सेव हो गया। 3–10 मिनट में होम पेज पर दिखेगा।', 'ok');
    } else if (galleryEdit.kind === 'video') {
      if (!galleryEdit.videoBlob) throw new Error('पहले "वीडियो छोटा करें" दबाएँ।');
      const id = 'video-' + Date.now().toString(36);
      const posterPath = GALLERY_IMAGE_FOLDER + id + '.jpg';
      const videoPath = GALLERY_VIDEO_FOLDER + id + '.' + galleryEdit.videoExt;
      setGalleryStatus('वीडियो GitHub पर सेव हो रहा है… (1–2 मिनट लग सकते हैं)');
      const videoBase64 = await blobToBase64(galleryEdit.videoBlob);
      list.push(Object.assign({ id: id, kind: 'video', src: posterPath, video: videoPath, caption: caption, size: size, added: todayISO() }, look));
      await ghCommitFiles([
        { path: videoPath, content: videoBase64, encoding: 'base64' },
        { path: posterPath, content: galleryEdit.src.split(',')[1], encoding: 'base64' },
        { path: GALLERY_JSON_PATH, content: JSON.stringify(list, null, 2) + '\n' }
      ], 'Admin panel: गैलरी वीडियो जोड़ा' + (caption ? ' — ' + caption : ''));
      setGalleryStatus('✓ वीडियो जुड़ गया। 3–10 मिनट में होम पेज की गैलरी में दिखेगा।', 'ok');
    } else {
      const id = 'photo-' + Date.now().toString(36);
      const path = GALLERY_IMAGE_FOLDER + id + '.jpg';
      list.push(Object.assign({ id: id, src: path, caption: caption, size: size, added: todayISO() }, look));
      await ghCommitFiles([
        { path: path, content: galleryEdit.src.split(',')[1], encoding: 'base64' },
        { path: GALLERY_JSON_PATH, content: JSON.stringify(list, null, 2) + '\n' }
      ], 'Admin panel: गैलरी फ़ोटो जोड़ी' + (caption ? ' — ' + caption : ''));
      setGalleryStatus('✓ फ़ोटो जुड़ गई। 3–10 मिनट में होम पेज की गैलरी में दिखेगी।', 'ok');
    }
    showToast('सेव हो गया ✓', 'success');
    closeGalleryEditor();
    await refreshGalleryList();
  } catch (error) {
    console.error(error);
    setGalleryStatus(error.message || 'सेव नहीं हो पाया।', 'error');
  } finally {
    ghBusy = false;
    button.disabled = false;
  }
}

async function removeGalleryPhoto(id) {
  if (ghBusy) return;
  if (!window.confirm('यह फ़ोटो गैलरी से हटाएँ?')) return;
  ghBusy = true;
  try {
    setGalleryStatus('फ़ोटो हटाई जा रही है…');
    const list = await readGalleryList();
    const photo = list.find(function (p) { return p.id === id; });
    const remaining = list.filter(function (p) { return p.id !== id; });
    const files = [{ path: GALLERY_JSON_PATH, content: JSON.stringify(remaining, null, 2) + '\n' }];
    if (photo && photo.src && photo.src.indexOf(GALLERY_IMAGE_FOLDER) === 0) files.push({ path: photo.src, remove: true });
    if (photo && photo.video && photo.video.indexOf(GALLERY_VIDEO_FOLDER) === 0) files.push({ path: photo.video, remove: true });
    await ghCommitFiles(files, 'Admin panel: गैलरी फ़ोटो हटाई');
    setGalleryStatus('✓ फ़ोटो हटा दी गई। 3–10 मिनट में वेबसाइट से हट जाएगी।', 'ok');
    if (galleryEdit && galleryEdit.id === id) closeGalleryEditor();
    await refreshGalleryList();
  } catch (error) {
    console.error(error);
    setGalleryStatus(error.message || 'फ़ोटो नहीं हटा पाए।', 'error');
  } finally {
    ghBusy = false;
  }
}

/* --------------------------------------------------------------------------
   GALLERY VIDEOS (up to 1 minute). Bigger than 6 MB? Made smaller on the
   phone itself before uploading: the video is played into a smaller frame
   and recorded again at a lower quality.
   -------------------------------------------------------------------------- */
function formatMB(bytes) {
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function blobToBase64(blob) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onload = function () { resolve(String(reader.result).split(',')[1]); };
    reader.onerror = function () { reject(new Error('वीडियो पढ़ा नहीं जा सका।')); };
    reader.readAsDataURL(blob);
  });
}

/** Duration, size and a cover photo taken from the video. */
function readVideoInfo(file) {
  return new Promise(function (resolve, reject) {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    let done = false;
    v.preload = 'auto';
    v.muted = true;
    v.playsInline = true;
    v.onloadedmetadata = function () {
      v.currentTime = Math.min(1, (v.duration || 2) / 3);
    };
    v.onseeked = function () {
      if (done) return;
      done = true;
      const scale = Math.min(1, 1400 / Math.max(v.videoWidth, v.videoHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(v.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(v.videoHeight * scale));
      canvas.getContext('2d').drawImage(v, 0, 0, canvas.width, canvas.height);
      resolve({ url: url, duration: v.duration, width: v.videoWidth, height: v.videoHeight, poster: canvas.toDataURL('image/jpeg', 0.8) });
    };
    v.onerror = function () {
      URL.revokeObjectURL(url);
      reject(new Error('यह वीडियो इस ब्राउज़र में नहीं खुल रहा। फ़ोन के कैमरा से बना MP4 वीडियो चुनें।'));
    };
    v.src = url;
  });
}

function videoExtension(type) {
  return /mp4/.test(type) ? 'mp4' : 'webm';
}

/** The best recording format this phone supports (MP4 plays everywhere, WebM is the fallback). */
function recorderType() {
  const options = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm'];
  if (typeof MediaRecorder === 'undefined') return '';
  return options.find(function (t) { return MediaRecorder.isTypeSupported(t); }) || '';
}

async function chooseGalleryVideo(file, input) {
  setGalleryStatus('वीडियो जाँचा जा रहा है…');
  try {
    const info = await readVideoInfo(file);
    if (info.duration > VIDEO_MAX_SECONDS) {
      URL.revokeObjectURL(info.url);
      input.value = '';
      setGalleryStatus('यह वीडियो ' + Math.round(info.duration) + ' सेकंड का है। 1 मिनट तक का वीडियो चुनें (फ़ोन की Gallery → Edit → Trim से छोटा कर सकते हैं)।', 'error');
      return;
    }
    const small = file.size <= VIDEO_MAX_BYTES && /mp4|webm/.test(file.type);
    galleryEdit = {
      mode: 'new', kind: 'video', src: info.poster, fx: 50, fy: 50, zoom: 1,
      url: info.url, duration: info.duration, width: info.width, height: info.height,
      videoBlob: small ? file : null, videoExt: small ? videoExtension(file.type) : ''
    };
    const preview = document.getElementById('galVideoPreview');
    preview.src = info.url;
    openGalleryEditor('नया वीडियो: ठीक से सेट करें, फिर "वीडियो जोड़ें" दबाएँ', 'वीडियो जोड़ें');
    const infoText = document.getElementById('galVideoInfo');
    const button = document.getElementById('galCompressBtn');
    const hint = document.getElementById('galVideoHint');
    infoText.textContent = 'वीडियो: ' + Math.round(info.duration) + ' सेकंड, ' + formatMB(file.size);
    if (small) {
      button.hidden = true;
      hint.textContent = '✓ वीडियो 6 MB से छोटा है, सीधे जोड़ा जा सकता है।';
    } else if (!recorderType()) {
      button.hidden = true;
      galleryEdit.videoBlob = null;
      hint.textContent = 'यह ब्राउज़र वीडियो छोटा नहीं कर सकता। फ़ोन के Chrome में खोलें, या छोटा (6 MB से कम) वीडियो चुनें।';
    } else {
      button.hidden = false;
      hint.textContent = 'वीडियो 6 MB से बड़ा है। "वीडियो छोटा करें" दबाएँ। इसमें लगभग ' + Math.ceil(info.duration) + ' सेकंड लगेंगे; तब तक फ़ोन लॉक न करें और यही पेज खुला रखें।';
    }
    setGalleryStatus('');
  } catch (error) {
    input.value = '';
    setGalleryStatus(error.message, 'error');
  }
}

async function startVideoCompression() {
  if (!galleryEdit || galleryEdit.kind !== 'video') return;
  const button = document.getElementById('galCompressBtn');
  const hint = document.getElementById('galVideoHint');
  const progress = document.getElementById('galProgress');
  const bar = document.getElementById('galProgressBar');
  button.disabled = true;
  progress.hidden = false;
  hint.textContent = 'वीडियो छोटा हो रहा है… फ़ोन लॉक न करें।';
  try {
    const blob = await compressVideo(galleryEdit, function (p) {
      bar.style.width = Math.round(p * 100) + '%';
    });
    if (blob.size > VIDEO_MAX_BYTES) {
      throw new Error('छोटा करने के बाद भी वीडियो ' + formatMB(blob.size) + ' है। वीडियो को Trim करके छोटा करें और फिर कोशिश करें।');
    }
    galleryEdit.videoBlob = blob;
    galleryEdit.videoExt = videoExtension(blob.type);
    const preview = document.getElementById('galVideoPreview');
    preview.src = URL.createObjectURL(blob);
    bar.style.width = '100%';
    button.hidden = true;
    hint.textContent = '✓ तैयार: ' + formatMB(blob.size) + '। ऊपर चलाकर देख लें, फिर "वीडियो जोड़ें" दबाएँ।';
  } catch (error) {
    console.error(error);
    hint.textContent = error.message || 'वीडियो छोटा नहीं हो पाया।';
    button.disabled = false;
  }
}

/** Plays the video into a smaller frame and records it again at a bitrate that fits ~5.4 MB. */
async function compressVideo(edit, onProgress) {
  const type = recorderType();
  const v = document.createElement('video');
  v.playsInline = true;
  v.preload = 'auto';
  v.src = edit.url;
  await new Promise(function (resolve, reject) {
    v.onloadedmetadata = resolve;
    v.onerror = function () { reject(new Error('वीडियो खुल नहीं पाया।')); };
  });

  const scale = Math.min(1, 960 / Math.max(v.videoWidth, v.videoHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(2, Math.round(v.videoWidth * scale / 2) * 2);
  canvas.height = Math.max(2, Math.round(v.videoHeight * scale / 2) * 2);
  const ctx = canvas.getContext('2d');
  const stream = canvas.captureStream(30);

  // Sound: routed into the recording only (nothing plays from the speaker)
  let audio = null;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    audio = new AudioCtx();
    const source = audio.createMediaElementSource(v);
    const dest = audio.createMediaStreamDestination();
    source.connect(dest);
    dest.stream.getAudioTracks().forEach(function (track) { stream.addTrack(track); });
  } catch (error) {
    v.muted = true;
  }

  const audioBps = 64000;
  const videoBps = Math.max(250000, Math.min(2500000, Math.floor(VIDEO_TARGET_BYTES * 8 / Math.max(edit.duration, 1)) - audioBps));
  const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: videoBps, audioBitsPerSecond: audioBps });
  const chunks = [];
  recorder.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise(function (resolve) { recorder.onstop = resolve; });

  let running = true;
  const draw = function () {
    if (!running) return;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    onProgress(Math.min(1, v.currentTime / edit.duration));
    if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(draw);
    else requestAnimationFrame(draw);
  };

  recorder.start(1000);
  await v.play();
  draw();
  await new Promise(function (resolve) { v.onended = resolve; });
  running = false;
  recorder.stop();
  await stopped;
  stream.getTracks().forEach(function (track) { track.stop(); });
  if (audio) audio.close();
  return new Blob(chunks, { type: type.split(';')[0] });
}

/* --------------------------------------------------------------------------
   START-UP (admin page only)
   -------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', function () {
  const bar = document.querySelector('#dashboard .admin-bar');
  if (!bar || document.getElementById('ghPanel')) return;
  injectGithubStyles();

  const panel = document.createElement('section');
  panel.className = 'panel gh-panel';
  panel.id = 'ghPanel';
  panel.setAttribute('lang', 'hi');
  bar.insertAdjacentElement('afterend', panel);

  renderGithubPanel();
  relabelOldPublishBoxes();
  buildGalleryAdminPanel();
  renderGalleryAdmin();
});
