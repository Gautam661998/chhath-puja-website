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
const GITHUB_OWNER = 'Gautam661998';
const GITHUB_REPO = 'chhath-puja-website';
const GITHUB_BRANCH = 'main';

const GH_TOKEN_KEY = 'chhathPuja.githubToken';
const GH_LAST_PUBLISH_KEY = 'chhathPuja.lastPublish';
const GALLERY_JSON_PATH = 'data/gallery.json';
const GALLERY_IMAGE_FOLDER = 'images/gallery/';

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

async function renderGalleryAdmin() {
  const panel = document.getElementById('galleryAdmin');
  if (!panel) return;

  if (!getGithubToken()) {
    panel.innerHTML = '<h2>गैलरी फ़ोटो</h2><p class="gallery-admin-empty">फ़ोटो जोड़ने के लिए पहले ऊपर <strong>🚀 वेबसाइट पर प्रकाशित करें</strong> वाले हिस्से में GitHub टोकन जोड़ें।</p>';
    return;
  }

  panel.innerHTML =
    '<h2>गैलरी फ़ोटो</h2>' +
    '<p class="field-hint">यहाँ से जोड़ी गई फ़ोटो होम पेज की गैलरी में सबसे आख़िर में दिखेंगी (1–3 मिनट बाद)।</p>' +
    '<form class="gallery-admin-form" id="galleryForm" novalidate>' +
      '<div class="field"><label for="galleryFile">फ़ोटो चुनें</label><input id="galleryFile" type="file" accept="image/*"></div>' +
      '<div class="field"><label for="galleryCaption">फ़ोटो का नाम / विवरण</label><input id="galleryCaption" type="text" maxlength="80" placeholder="जैसे: संध्या अर्घ्य 2026"></div>' +
      '<div class="field"><label for="gallerySize">आकार</label><select id="gallerySize">' +
        '<option value="">सामान्य</option><option value="wide">चौड़ी (2 खाने)</option><option value="tall">लंबी (2 खाने ऊँची)</option>' +
      '</select></div>' +
      '<button class="btn btn-primary" id="galleryAddBtn" type="submit">फ़ोटो जोड़ें</button>' +
    '</form>' +
    '<p class="gh-status" id="galleryStatus"></p>' +
    '<div class="gallery-admin-list" id="galleryList"><p class="gallery-admin-empty">फ़ोटो लोड हो रही हैं…</p></div>';

  document.getElementById('galleryForm').addEventListener('submit', addGalleryPhoto);
  document.getElementById('galleryList').addEventListener('click', function (event) {
    const button = event.target.closest('button[data-remove]');
    if (button) removeGalleryPhoto(button.getAttribute('data-remove'));
  });
  await refreshGalleryList();
}

async function refreshGalleryList() {
  const listBox = document.getElementById('galleryList');
  if (!listBox) return;
  try {
    const list = await readGalleryList();
    listBox.innerHTML = list.length ? list.map(function (photo) {
      return '<figure class="gallery-admin-item">' +
        '<img src="' + escapeHTML(galleryImageURL(photo.src)) + '" alt="' + escapeHTML(photo.caption || 'फ़ोटो') + '" loading="lazy">' +
        '<figcaption>' + escapeHTML(photo.caption || '–') + '</figcaption>' +
        '<button class="btn btn-danger btn-small" type="button" data-remove="' + escapeHTML(photo.id) + '">हटाएँ</button>' +
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

async function addGalleryPhoto(event) {
  event.preventDefault();
  if (ghBusy) return;
  const fileInput = document.getElementById('galleryFile');
  const caption = document.getElementById('galleryCaption').value.trim();
  const size = document.getElementById('gallerySize').value;
  const file = fileInput.files[0];
  if (!file) { setGalleryStatus('पहले फ़ोटो चुनें।', 'error'); return; }

  const button = document.getElementById('galleryAddBtn');
  ghBusy = true;
  button.disabled = true;
  try {
    setGalleryStatus('फ़ोटो छोटी की जा रही है…');
    const dataURL = await compressBillImage(file);       // from kharcha.js
    const base64 = dataURL.split(',')[1];
    const id = 'photo-' + Date.now().toString(36);
    const path = GALLERY_IMAGE_FOLDER + id + '.jpg';

    setGalleryStatus('GitHub पर सेव हो रही है…');
    const list = await readGalleryList();
    list.push({ id: id, src: path, caption: caption, size: size, added: todayISO() });

    await ghCommitFiles([
      { path: path, content: base64, encoding: 'base64' },
      { path: GALLERY_JSON_PATH, content: JSON.stringify(list, null, 2) + '\n' }
    ], 'Admin panel: गैलरी फ़ोटो जोड़ी' + (caption ? ' — ' + caption : ''));

    document.getElementById('galleryForm').reset();
    setGalleryStatus('✓ फ़ोटो जुड़ गई। 1–3 मिनट में होम पेज की गैलरी में दिखेगी।', 'ok');
    showToast('फ़ोटो जुड़ गई ✓', 'success');
    await refreshGalleryList();
  } catch (error) {
    console.error(error);
    setGalleryStatus(error.message || 'फ़ोटो नहीं जुड़ पाई।', 'error');
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
    await ghCommitFiles(files, 'Admin panel: गैलरी फ़ोटो हटाई');
    setGalleryStatus('✓ फ़ोटो हटा दी गई। 1–3 मिनट में वेबसाइट से हट जाएगी।', 'ok');
    await refreshGalleryList();
  } catch (error) {
    console.error(error);
    setGalleryStatus(error.message || 'फ़ोटो नहीं हटा पाए।', 'error');
  } finally {
    ghBusy = false;
  }
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
