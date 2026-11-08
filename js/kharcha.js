/* ==========================================================================
   kharcha.js — खर्चा (expenses)
   Load AFTER main.js on donation.html AND admin.html.

   • Admin panel: sees ALL expenses, adds / edits / deletes them, and
     chooses for each one whether the village can see it.
   • Donations page: shows only the expenses the admin allowed.

   How changes reach the website (same as donations):
   Admin panel → "नई kharcha.js डाउनलोड करें" → put the file in the js
   folder → zip → upload to Netlify.

   Bill photos (optional) are kept in a separate file, js/kharcha-bills.js,
   which visitors only download when they tap "बिल देखें".

   Note: hidden expenses are not shown on the page, but they are still
   inside this file, so a person who knows how to read website code
   could find them. Do not put anything secret here.
   ========================================================================== */

'use strict';

/* EXPENSES-START — this block is rewritten by the admin panel */
const EXPENSES = {
  2023: [
    { item: "डी.जे. (DJ)", amount: 5100, note: "₹4,600 जमा + ₹500 बाकी", show: false },
    { item: "कपड़ा", amount: 1800, note: "₹1,300 + ₹500", show: false },
    { item: "झंडी (2 किलो)", amount: 360, note: "", show: true },
    { item: "ठेला", amount: 200, note: "₹100 + ₹100", show: true },
    { item: "बैलून", amount: 200, note: "", show: true },
    { item: "पेट्रोल", amount: 100, note: "दिगम्बर", show: true },
    { item: "लाल झंडी", amount: 75, note: "", show: true },
    { item: "काँटी + सुतली", amount: 75, note: "", show: true },
    { item: "पेट्रोल", amount: 25, note: "अनिल", show: true },
    { item: "अन्य खर्च", amount: 500, note: "विवरण पर्ची में नहीं लिखा", show: true },
    { item: "अन्य खर्च", amount: 20, note: "विवरण पर्ची में नहीं लिखा", show: true },
  ],
};

// hiddenAsOther: true  → hidden items are added up and shown as one line "अन्य खर्च",
//                        so the village still sees the correct total and balance.
// hiddenAsOther: false → hidden items are left out completely (no balance is shown).
const EXPENSE_SETTINGS = {
  2023: { hiddenAsOther: true },
};
/* EXPENSES-END */

const KHARCHA_DRAFT_KEY = 'chhathPuja.kharchaDraft.v1';
const KHARCHA_BILLS_KEY = 'chhathPuja.kharchaBills.v1';
const KHARCHA_BILLS_FILE = 'js/kharcha-bills.js';

/* --------------------------------------------------------------------------
   SHARED HELPERS
   -------------------------------------------------------------------------- */
function kharchaSum(items) {
  return items.reduce(function (sum, row) { return sum + Number(row.amount || 0); }, 0);
}

function isShown(row) {
  return row.show !== false;
}

function hiddenAsOther(settings, year) {
  return !(settings[year] && settings[year].hiddenAsOther === false);
}

/** What the village sees for one year. */
function publicKharcha(items, settings, year) {
  const visible = items.filter(isShown);
  const hidden = items.filter(function (row) { return !isShown(row); });
  const asOther = hiddenAsOther(settings, year);
  const rows = visible.slice();
  if (asOther && hidden.length) {
    rows.push({ item: 'अन्य खर्च (कुल)', amount: kharchaSum(hidden), note: '' });
  }
  return { rows: rows, total: kharchaSum(rows), showBalance: asOther || !hidden.length };
}

function kharchaFingerprint(expenses, settings) {
  // Only years that have expenses count, so empty years do not look like a change
  const clean = {};
  Object.keys(expenses).sort().forEach(function (year) {
    const list = expenses[year] || [];
    if (!list.length) return;
    clean[year] = {
      other: hiddenAsOther(settings, year),
      rows: list.map(function (r) { return [r.item, Number(r.amount), r.note || '', isShown(r), r.bill || '']; })
    };
  });
  const text = JSON.stringify(clean);
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
  return String(hash);
}

/* --------------------------------------------------------------------------
   BILL PHOTOS
   -------------------------------------------------------------------------- */
let localBills = null;          // bills added in this browser (admin), not yet published
let billsFilePromise = null;

function getLocalBills() {
  if (localBills) return localBills;
  try {
    localBills = JSON.parse(localStorage.getItem(KHARCHA_BILLS_KEY) || '{}') || {};
  } catch (error) {
    localBills = {};
  }
  return localBills;
}

function saveLocalBills() {
  try {
    localStorage.setItem(KHARCHA_BILLS_KEY, JSON.stringify(getLocalBills()));
    return true;
  } catch (error) {
    return false;
  }
}

/** Loads js/kharcha-bills.js (published bills) once, only when needed. */
function loadBillsFile() {
  if (window.KHARCHA_BILLS) return Promise.resolve(window.KHARCHA_BILLS);
  if (!billsFilePromise) {
    billsFilePromise = new Promise(function (resolve) {
      const script = document.createElement('script');
      script.src = KHARCHA_BILLS_FILE + '?v=' + Date.now();
      script.onload = function () { resolve(window.KHARCHA_BILLS || {}); };
      script.onerror = function () { resolve({}); };
      document.head.appendChild(script);
    });
  }
  return billsFilePromise;
}

async function getBillData(id) {
  if (!id) return '';
  const local = getLocalBills()[id];
  if (local) return local;
  const published = await loadBillsFile();
  return published[id] || '';
}

/** Shrinks a photo so it loads fast on mobile data (about 100–400 KB). */
function compressBillImage(file) {
  return new Promise(function (resolve, reject) {
    if (!file || !/^image\//.test(file.type)) {
      reject(new Error('सिर्फ़ फ़ोटो (JPG या PNG) चुनें।'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = function () { reject(new Error('फ़ोटो पढ़ी नहीं जा सकी।')); };
    reader.onload = function () {
      const img = new Image();
      img.onerror = function () { reject(new Error('यह फ़ोटो खुल नहीं रही। JPG या PNG फ़ोटो चुनें।')); };
      img.onload = function () {
        let result = '';
        [[1400, 0.72], [1100, 0.6], [900, 0.5]].some(function (setting) {
          const scale = Math.min(1, setting[0] / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          result = canvas.toDataURL('image/jpeg', setting[1]);
          return result.length < 450000;
        });
        resolve(result);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function getBillDialog() {
  let dialog = document.getElementById('billDialog');
  if (dialog) return dialog;
  dialog = document.createElement('dialog');
  dialog.className = 'bill-dialog';
  dialog.id = 'billDialog';
  dialog.setAttribute('lang', 'hi');
  dialog.setAttribute('aria-labelledby', 'billDialogTitle');
  dialog.innerHTML =
    '<div class="bill-dialog-bar">' +
    '<h3 id="billDialogTitle">बिल</h3>' +
    '<button class="btn btn-small btn-gold" type="button" id="billDialogClose">बंद करें</button>' +
    '</div>' +
    '<img id="billDialogImage" alt="">' +
    '<a class="btn btn-outline btn-small bill-download" id="billDialogDownload" href="#" download="bill.jpg">बिल डाउनलोड करें</a>';
  document.body.appendChild(dialog);
  dialog.querySelector('#billDialogClose').addEventListener('click', function () { dialog.close(); });
  dialog.addEventListener('click', function (event) { if (event.target === dialog) dialog.close(); });
  return dialog;
}

async function openBill(id, title) {
  const data = await getBillData(id);
  if (!data) {
    showToast('इस खर्च का बिल अभी वेबसाइट पर नहीं है।', 'error');
    return;
  }
  const dialog = getBillDialog();
  dialog.querySelector('#billDialogTitle').textContent = 'बिल: ' + title;
  const image = dialog.querySelector('#billDialogImage');
  image.src = data;
  image.alt = title + ' का बिल';
  const download = dialog.querySelector('#billDialogDownload');
  download.href = data;
  download.download = 'bill-' + String(title).replace(/[^\w\u0900-\u097F]+/g, '-') + '.jpg';
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

/* --------------------------------------------------------------------------
   PUBLIC: "खर्चा कितना हुआ" on donation.html
   -------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', function () {
  setupPublicKharcha();
  setupAdminKharcha();
});

function setupPublicKharcha() {
  const tableBody = document.getElementById('donationBody');
  const yearSelect = document.getElementById('yearSelect');
  if (!tableBody || !yearSelect || document.getElementById('kharcha')) return;

  const section = document.createElement('section');
  section.className = 'section kharcha-section';
  section.id = 'kharcha';
  section.setAttribute('lang', 'hi');
  section.setAttribute('aria-labelledby', 'kharchaTitle');
  section.innerHTML =
    '<div class="container">' +
    '<h2 id="kharchaTitle">खर्चा कितना हुआ</h2>' +
    '<p class="section-intro" id="kharchaIntro"></p>' +
    '<div class="kharcha-stats" id="kharchaStats"></div>' +
    '<div id="kharchaDetails"></div>' +
    '</div>';
  tableBody.closest('section').insertAdjacentElement('afterend', section);

  function render() {
    renderPublicKharcha(Number(yearSelect.value)).catch(function (error) { console.error(error); });
  }
  yearSelect.addEventListener('change', render);
  window.addEventListener('storage', function (event) {
    if (event.key === STORAGE_KEY) setTimeout(render, 50);
  });
  section.addEventListener('click', function (event) {
    const button = event.target.closest('.bill-btn');
    if (button) openBill(button.getAttribute('data-bill'), button.getAttribute('data-title'));
  });
  (function waitForYear(tries) {
    if (yearSelect.value || tries > 20) render();
    else setTimeout(function () { waitForYear(tries + 1); }, 50);
  })(0);
}

async function renderPublicKharcha(year) {
  const intro = document.getElementById('kharchaIntro');
  const stats = document.getElementById('kharchaStats');
  const details = document.getElementById('kharchaDetails');
  if (!year) return;

  const items = EXPENSES[year] || [];
  const view = publicKharcha(items, EXPENSE_SETTINGS, year);
  const collection = summarizeDonations(await DonationStore.getByYear(year)).total;
  const balance = collection - view.total;
  // Without donation records for this year, a balance would be misleading
  const showBalance = view.showBalance && collection > 0;

  intro.textContent = 'छठ पूजा ' + year + ' में मिले चंदे से समिति ने कहाँ-कहाँ कितना खर्च किया, इसका हिसाब।';

  if (!view.rows.length) {
    stats.innerHTML = '';
    details.innerHTML = '<p class="kharcha-empty">छठ पूजा ' + year + ' का खर्चा अभी जोड़ा नहीं गया है।</p>';
    return;
  }

  stats.innerHTML = kharchaStatCards([
    collection > 0 ? { label: 'कुल चंदा', value: collection } : null,
    { label: 'कुल खर्चा', value: view.total, className: 'is-spent' },
    showBalance ? { label: balance >= 0 ? 'बचा हुआ' : 'घाटा', value: Math.abs(balance), className: balance >= 0 ? 'is-left' : 'is-loss' } : null
  ]);

  details.innerHTML = kharchaTableHTML(view.rows, view.total,
    showBalance ? (balance >= 0 ? 'बचा: ' : 'घाटा: ') + formatINR(Math.abs(balance)) : '');
}

function kharchaStatCards(cards) {
  return cards.filter(Boolean).map(function (card) {
    return '<div class="kharcha-stat ' + (card.className || '') + '">' +
      '<span class="stat-label">' + card.label + '</span>' +
      '<span class="stat-value">' + formatINR(card.value) + '</span>' +
      '</div>';
  }).join('');
}

function kharchaTableHTML(rows, total, footNote) {
  const sorted = rows.slice().sort(function (a, b) { return b.amount - a.amount; });
  const biggest = (sorted[0] && sorted[0].amount) || 1;
  return '<div class="table-caption-row">' +
    '<h3 class="kharcha-subtitle">खर्च का विवरण</h3>' +
    '<span class="result-count">' + rows.length + ' खर्च</span>' +
    '</div>' +
    '<div class="table-wrap"><table class="data-table kharcha-table">' +
    '<thead><tr><th scope="col">#</th><th scope="col">किस चीज़ पर</th><th scope="col" class="num">राशि</th>' +
    '<th scope="col" class="kharcha-share-col">हिस्सा</th><th scope="col">टिप्पणी</th><th scope="col">बिल</th></tr></thead>' +
    '<tbody>' + sorted.map(function (row, index) {
      const percent = total ? Math.round((row.amount / total) * 100) : 0;
      const width = Math.max(2, Math.round((row.amount / biggest) * 100));
      return '<tr>' +
        '<td data-label="#">' + (index + 1) + '</td>' +
        '<td data-label="किस चीज़ पर">' + escapeHTML(row.item) + '</td>' +
        '<td data-label="राशि" class="num">' + formatINR(row.amount) + '</td>' +
        '<td data-label="हिस्सा" class="kharcha-share-col"><span class="kharcha-bar" aria-hidden="true"><span style="width:' + width + '%"></span></span>' +
        '<span class="kharcha-percent">' + percent + '%</span></td>' +
        '<td data-label="टिप्पणी">' + escapeHTML(row.note || '–') + '</td>' +
        '<td data-label="बिल">' + (row.bill
          ? '<button type="button" class="bill-btn" data-bill="' + escapeHTML(row.bill) + '" data-title="' + escapeHTML(row.item) + '">🧾 बिल देखें</button>'
          : '–') + '</td>' +
        '</tr>';
    }).join('') + '</tbody>' +
    '<tfoot><tr><td data-label=""></td><td data-label="कुल">कुल खर्चा</td>' +
    '<td data-label="राशि" class="num">' + formatINR(total) + '</td>' +
    '<td data-label="" class="kharcha-share-col"></td><td data-label="" colspan="2">' + footNote + '</td></tr></tfoot>' +
    '</table></div>';
}

/* --------------------------------------------------------------------------
   ADMIN: manage expenses (admin.html)
   Changes are kept in this browser until published.
   -------------------------------------------------------------------------- */
let kharchaDraft = null;

function loadKharchaDraft() {
  const codePrint = kharchaFingerprint(EXPENSES, EXPENSE_SETTINGS);
  try {
    const saved = JSON.parse(localStorage.getItem(KHARCHA_DRAFT_KEY) || 'null');
    // Use the saved draft only if it was made from the current website version
    if (saved && saved.base === codePrint && saved.expenses) return saved;
  } catch (error) {
    console.error(error);
  }
  const draft = { base: codePrint, expenses: {}, settings: JSON.parse(JSON.stringify(EXPENSE_SETTINGS)) };
  Object.keys(EXPENSES).forEach(function (year) {
    draft.expenses[year] = EXPENSES[year].map(function (row) {
      const copy = { id: makeId(), item: row.item, amount: Number(row.amount), note: row.note || '', show: isShown(row) };
      if (row.bill) copy.bill = row.bill;
      return copy;
    });
  });
  return draft;
}

function saveKharchaDraft() {
  try {
    localStorage.setItem(KHARCHA_DRAFT_KEY, JSON.stringify(kharchaDraft));
  } catch (error) {
    showToast('खर्चा सेव नहीं हो पाया। ब्राउज़र स्टोरेज भरा या बंद है।', 'error');
  }
}

function draftHasChanges() {
  return kharchaFingerprint(kharchaDraft.expenses, kharchaDraft.settings) !== kharchaDraft.base;
}

function setupAdminKharcha() {
  const dashboard = document.getElementById('dashboard');
  if (!dashboard || document.getElementById('kharchaAdmin')) return;

  kharchaDraft = loadKharchaDraft();

  const panel = document.createElement('section');
  panel.className = 'panel kharcha-admin';
  panel.id = 'kharchaAdmin';
  panel.setAttribute('lang', 'hi');
  panel.innerHTML =
    '<div class="kharcha-admin-head">' +
    '<div><h2>खर्चा (Kharcha)</h2>' +
    '<p class="field-hint">यहाँ सारे खर्च दिखते हैं। “गाँव वालों को” वाले बटन से चुनें कि कौन-सा खर्च वेबसाइट पर दिखे।</p></div>' +
    '<div class="field"><label for="kaYear">वर्ष</label><select id="kaYear"></select></div>' +
    '</div>' +
    '<div class="kharcha-stats kharcha-stats-4" id="kaStats"></div>' +
    '<div class="kharcha-admin-grid">' +
    '<form class="kharcha-form" id="kaForm" novalidate>' +
    '<h3 id="kaFormTitle">नया खर्च जोड़ें</h3>' +
    '<input type="hidden" id="kaEditId">' +
    '<div class="field"><label for="kaItem">किस चीज़ पर</label>' +
    '<input id="kaItem" type="text" maxlength="60" placeholder="जैसे: डी.जे., कपड़ा, पेट्रोल" autocomplete="off">' +
    '<span class="field-error" id="kaItemError"></span></div>' +
    '<div class="field-row">' +
    '<div class="field"><label for="kaAmount">राशि (₹)</label>' +
    '<input id="kaAmount" type="text" inputmode="decimal" placeholder="जैसे: 500">' +
    '<span class="field-error" id="kaAmountError"></span></div>' +
    '<div class="field"><label for="kaNote">टिप्पणी (वैकल्पिक)</label>' +
    '<input id="kaNote" type="text" maxlength="80" placeholder="जैसे: ₹500 बाकी"></div>' +
    '</div>' +
    '<div class="field">' +
    '<label for="kaBill">बिल / रसीद / भुगतान का फ़ोटो (वैकल्पिक)</label>' +
    '<input id="kaBill" type="file" accept="image/*">' +
    '<div class="bill-preview" id="kaBillPreview" hidden>' +
    '<img id="kaBillPreviewImg" alt="चुना गया बिल">' +
    '<button class="btn btn-danger btn-small" id="kaBillRemove" type="button">बिल हटाएँ</button>' +
    '</div>' +
    '<span class="field-hint">फ़ोटो अपने-आप छोटी कर दी जाएगी, ताकि वेबसाइट तेज़ चले।</span>' +
    '<span class="field-error" id="kaBillError"></span>' +
    '</div>' +
    '<div class="field check-field"><label><input id="kaShow" type="checkbox" checked> गाँव वालों को दिखाएँ (बिल भी)</label></div>' +
    '<div class="form-actions">' +
    '<button class="btn btn-primary" id="kaSaveBtn" type="submit">खर्च जोड़ें</button>' +
    '<button class="btn btn-outline" id="kaCancelBtn" type="button" hidden>रद्द करें</button>' +
    '</div>' +
    '</form>' +
    '<div class="publish-box">' +
    '<h3>गाँव वालों को दिखाने के लिए प्रकाशित करें</h3>' +
    '<p class="kharcha-unpublished" id="kaUnpublished" hidden>⚠ आपके कुछ बदलाव अभी वेबसाइट पर नहीं गए हैं।</p>' +
    '<ol class="publish-steps">' +
    '<li>“नई kharcha.js डाउनलोड करें” दबाएँ।</li>' +
    '<li id="kaBillsStep" hidden>बिल जोड़े हैं तो “बिल फ़ाइल डाउनलोड करें” भी दबाएँ (<code>kharcha-bills.js</code>)।</li>' +
    '<li>दोनों फ़ाइलें <code>js</code> फ़ोल्डर में पुरानी फ़ाइलों की जगह रखें।</li>' +
    '<li>zip बनाकर Netlify पर अपलोड करें।</li>' +
    '</ol>' +
    '<div class="form-actions">' +
    '<button class="btn btn-primary" id="kaPublishBtn" type="button">नई kharcha.js डाउनलोड करें</button>' +
    '<button class="btn btn-gold" id="kaPublishBillsBtn" type="button" hidden>बिल फ़ाइल डाउनलोड करें</button>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '<div class="field check-field kharcha-other-option">' +
    '<label><input id="kaHiddenAsOther" type="checkbox" checked> छुपे हुए खर्चों की कुल राशि गाँव वालों को एक लाइन “अन्य खर्च (कुल)” में दिखाएँ (इससे कुल खर्चा और बचा हुआ सही दिखेगा)</label>' +
    '</div>' +
    '<div class="table-wrap"><table class="data-table kharcha-table">' +
    '<thead><tr><th scope="col">#</th><th scope="col">किस चीज़ पर</th><th scope="col" class="num">राशि</th>' +
    '<th scope="col">टिप्पणी</th><th scope="col">बिल</th><th scope="col">गाँव वालों को</th><th scope="col"><span class="visually-hidden">बदलें</span></th></tr></thead>' +
    '<tbody id="kaBody"></tbody><tfoot id="kaFoot"></tfoot>' +
    '</table></div>' +
    '<p class="kharcha-village-view" id="kaVillageView"></p>';

  const storageNote = dashboard.querySelector('.storage-note');
  if (storageNote) storageNote.insertAdjacentElement('beforebegin', panel);
  else dashboard.querySelector('.container').appendChild(panel);

  document.getElementById('kaYear').addEventListener('change', function () { resetKharchaForm(); renderAdminKharcha(); });
  document.getElementById('kaForm').addEventListener('submit', saveKharchaItem);
  document.getElementById('kaCancelBtn').addEventListener('click', resetKharchaForm);
  document.getElementById('kaPublishBtn').addEventListener('click', publishKharcha);
  document.getElementById('kaPublishBillsBtn').addEventListener('click', publishBills);
  document.getElementById('kaBill').addEventListener('change', handleBillChosen);
  document.getElementById('kaBillRemove').addEventListener('click', function () {
    pendingBill = null;
    billRemoved = true;
    document.getElementById('kaBill').value = '';
    document.getElementById('kaBillPreview').hidden = true;
  });
  document.getElementById('kaHiddenAsOther').addEventListener('change', function (event) {
    const year = currentKharchaYear();
    kharchaDraft.settings[year] = { hiddenAsOther: event.target.checked };
    saveKharchaDraft();
    renderAdminKharcha();
  });
  document.getElementById('kaBody').addEventListener('click', function (event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const id = button.getAttribute('data-id');
    const action = button.getAttribute('data-action');
    if (action === 'toggle') toggleKharchaItem(id);
    if (action === 'edit') editKharchaItem(id);
    if (action === 'delete') deleteKharchaItem(id);
    if (action === 'bill') openBill(button.getAttribute('data-bill'), button.getAttribute('data-title'));
  });

  fillKharchaYears();
  renderAdminKharcha();

  // Keep "कुल चंदा" up to date when donations change
  const recordsBody = document.getElementById('recordsBody');
  if (recordsBody && 'MutationObserver' in window) {
    new MutationObserver(function () { renderAdminKharcha(); }).observe(recordsBody, { childList: true });
  }
}

function currentKharchaYear() {
  return Number(document.getElementById('kaYear').value) || new Date().getFullYear();
}

async function fillKharchaYears() {
  const select = document.getElementById('kaYear');
  const thisYear = new Date().getFullYear();
  const donationYears = await DonationStore.getYears();
  const expenseYears = Object.keys(kharchaDraft.expenses).map(Number);
  const years = Array.from(new Set(donationYears.concat(expenseYears, [thisYear, thisYear + 1])))
    .sort(function (a, b) { return b - a; });
  const previous = select.value;
  select.innerHTML = years.map(function (y) { return '<option value="' + y + '">' + y + '</option>'; }).join('');
  const withExpenses = expenseYears.sort(function (a, b) { return b - a; })[0];
  select.value = previous || String(withExpenses || thisYear);
  renderAdminKharcha();
}

async function renderAdminKharcha() {
  if (!kharchaDraft || !document.getElementById('kaYear').value) return;
  const year = currentKharchaYear();
  const items = kharchaDraft.expenses[year] || [];
  const collection = summarizeDonations(await DonationStore.getByYear(year)).total;
  const allTotal = kharchaSum(items);
  const view = publicKharcha(items, kharchaDraft.settings, year);
  const hidden = items.filter(function (r) { return !isShown(r); });

  document.getElementById('kaHiddenAsOther').checked = hiddenAsOther(kharchaDraft.settings, year);
  document.getElementById('kaUnpublished').hidden = !draftHasChanges();
  const anyBills = referencedBillIds().length > 0;
  document.getElementById('kaPublishBillsBtn').hidden = !anyBills;
  document.getElementById('kaBillsStep').hidden = !anyBills;

  document.getElementById('kaStats').innerHTML = kharchaStatCards([
    { label: 'कुल चंदा', value: collection },
    { label: 'कुल खर्चा (सब)', value: allTotal, className: 'is-spent' },
    { label: collection - allTotal >= 0 ? 'बचा हुआ' : 'घाटा', value: Math.abs(collection - allTotal), className: collection - allTotal >= 0 ? 'is-left' : 'is-loss' },
    { label: 'गाँव वालों को दिख रहा खर्चा', value: view.total }
  ]);

  const body = document.getElementById('kaBody');
  body.innerHTML = items.length ? items.map(function (row, index) {
    const shown = isShown(row);
    const name = escapeHTML(row.item);
    return '<tr class="' + (shown ? '' : 'is-hidden-item') + '">' +
      '<td data-label="#">' + (index + 1) + '</td>' +
      '<td data-label="किस चीज़ पर">' + name + '</td>' +
      '<td data-label="राशि" class="num">' + formatINR(row.amount) + '</td>' +
      '<td data-label="टिप्पणी">' + escapeHTML(row.note || '–') + '</td>' +
      '<td data-label="बिल">' + (row.bill
        ? '<button type="button" class="bill-btn" data-action="bill" data-bill="' + escapeHTML(row.bill) + '" data-title="' + name + '">🧾 देखें</button>'
        : '–') + '</td>' +
      '<td data-label="गाँव वालों को">' +
      '<button type="button" class="visibility-toggle ' + (shown ? 'is-on' : 'is-off') + '" data-action="toggle" data-id="' + row.id + '" aria-pressed="' + shown + '" aria-label="' + name + ': ' + (shown ? 'दिख रहा है, छुपाने के लिए दबाएँ' : 'छुपा है, दिखाने के लिए दबाएँ') + '">' +
      (shown ? '👁 दिख रहा है' : '🚫 छुपा है') +
      '</button>' +
      '</td>' +
      '<td data-label="बदलें"><div class="row-actions">' +
      '<button class="btn btn-outline btn-small" type="button" data-action="edit" data-id="' + row.id + '">बदलें</button>' +
      '<button class="btn btn-danger btn-small" type="button" data-action="delete" data-id="' + row.id + '">हटाएँ</button>' +
      '</div></td>' +
      '</tr>';
  }).join('') : '<tr class="empty-row"><td colspan="7">' + year + ' का कोई खर्च नहीं है। ऊपर के फ़ॉर्म से जोड़ें।</td></tr>';

  document.getElementById('kaFoot').innerHTML = items.length
    ? '<tr><td data-label=""></td><td data-label="कुल">कुल खर्चा</td><td data-label="राशि" class="num">' + formatINR(allTotal) + '</td>' +
    '<td data-label="" colspan="4">' + hidden.length + ' छुपे हुए (' + formatINR(kharchaSum(hidden)) + ')</td></tr>'
    : '';

  let villageText = '';
  if (items.length) {
    villageText = 'गाँव वालों को दिखेगा: कुल खर्चा ' + formatINR(view.total) +
      (view.showBalance ? ' · बचा हुआ ' + formatINR(Math.max(collection - view.total, 0)) : ' · बचा हुआ नहीं दिखेगा') +
      (hidden.length ? (hiddenAsOther(kharchaDraft.settings, year)
        ? ' · छुपे ' + hidden.length + ' खर्च एक लाइन “अन्य खर्च (कुल)” (' + formatINR(kharchaSum(hidden)) + ') में'
        : ' · छुपे ' + hidden.length + ' खर्च बिल्कुल नहीं दिखेंगे') : '');
  }
  document.getElementById('kaVillageView').textContent = villageText;
}

function findKharchaItem(id) {
  const year = currentKharchaYear();
  const list = kharchaDraft.expenses[year] || [];
  return { list: list, index: list.findIndex(function (r) { return r.id === id; }) };
}

function toggleKharchaItem(id) {
  const found = findKharchaItem(id);
  if (found.index === -1) return;
  const row = found.list[found.index];
  row.show = !isShown(row);
  saveKharchaDraft();
  renderAdminKharcha();
  showToast(row.item + (row.show ? ': अब गाँव वालों को दिखेगा' : ': अब गाँव वालों से छुपा है'), 'success');
}

function editKharchaItem(id) {
  const found = findKharchaItem(id);
  if (found.index === -1) return;
  const row = found.list[found.index];
  document.getElementById('kaEditId').value = row.id;
  document.getElementById('kaItem').value = row.item;
  document.getElementById('kaAmount').value = String(row.amount);
  document.getElementById('kaNote').value = row.note || '';
  document.getElementById('kaShow').checked = isShown(row);
  pendingBill = null;
  billRemoved = false;
  document.getElementById('kaBill').value = '';
  document.getElementById('kaBillPreview').hidden = true;
  if (row.bill) {
    getBillData(row.bill).then(function (data) {
      if (!data || document.getElementById('kaEditId').value !== row.id) return;
      document.getElementById('kaBillPreviewImg').src = data;
      document.getElementById('kaBillPreview').hidden = false;
    });
  }
  document.getElementById('kaFormTitle').textContent = 'खर्च बदलें';
  document.getElementById('kaSaveBtn').textContent = 'बदलाव सेव करें';
  document.getElementById('kaCancelBtn').hidden = false;
  document.getElementById('kaForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
  document.getElementById('kaItem').focus({ preventScroll: true });
}

function deleteKharchaItem(id) {
  const found = findKharchaItem(id);
  if (found.index === -1) return;
  const row = found.list[found.index];
  if (!window.confirm('यह खर्च हटाएँ?\n\n' + row.item + ' – ' + formatINR(row.amount))) return;
  found.list.splice(found.index, 1);
  saveKharchaDraft();
  resetKharchaForm();
  renderAdminKharcha();
  showToast('खर्च हटा दिया गया', 'success');
}

function resetKharchaForm() {
  document.getElementById('kaForm').reset();
  document.getElementById('kaEditId').value = '';
  document.getElementById('kaShow').checked = true;
  document.getElementById('kaFormTitle').textContent = 'नया खर्च जोड़ें';
  document.getElementById('kaSaveBtn').textContent = 'खर्च जोड़ें';
  document.getElementById('kaCancelBtn').hidden = true;
  document.getElementById('kaItemError').textContent = '';
  document.getElementById('kaAmountError').textContent = '';
  document.getElementById('kaBillError').textContent = '';
  document.getElementById('kaBillPreview').hidden = true;
  pendingBill = null;
  billRemoved = false;
}

let pendingBill = null;   // { id, data } of a newly chosen photo
let billRemoved = false;

async function handleBillChosen(event) {
  const file = event.target.files[0];
  const error = document.getElementById('kaBillError');
  error.textContent = '';
  if (!file) return;
  error.textContent = 'फ़ोटो तैयार हो रही है…';
  try {
    const data = await compressBillImage(file);
    pendingBill = { id: 'bill-' + makeId().replace(/[^a-z0-9]/gi, '').slice(0, 10), data: data };
    billRemoved = false;
    document.getElementById('kaBillPreviewImg').src = data;
    document.getElementById('kaBillPreview').hidden = false;
    error.textContent = '';
  } catch (problem) {
    pendingBill = null;
    event.target.value = '';
    error.textContent = problem.message;
  }
}

function referencedBillIds() {
  const ids = [];
  Object.keys(kharchaDraft.expenses).forEach(function (year) {
    (kharchaDraft.expenses[year] || []).forEach(function (row) {
      if (row.bill && ids.indexOf(row.bill) === -1) ids.push(row.bill);
    });
  });
  return ids;
}

function saveKharchaItem(event) {
  event.preventDefault();
  const item = document.getElementById('kaItem').value.trim().replace(/\s+/g, ' ');
  const amountText = document.getElementById('kaAmount').value.replace(/,|₹|\/-/g, '').trim();
  const amount = Number(amountText);
  const note = document.getElementById('kaNote').value.trim();
  const show = document.getElementById('kaShow').checked;

  let ok = true;
  document.getElementById('kaItemError').textContent = '';
  document.getElementById('kaAmountError').textContent = '';
  if (item.length < 2) {
    document.getElementById('kaItemError').textContent = 'खर्च का नाम लिखें।';
    ok = false;
  }
  if (!amountText || !/^\d+(\.\d{1,2})?$/.test(amountText) || amount <= 0 || amount > MAX_DONATION) {
    document.getElementById('kaAmountError').textContent = 'राशि सही लिखें, जैसे 500।';
    ok = false;
  }
  if (!ok) return;

  // Store a newly chosen bill photo in this browser
  if (pendingBill) {
    getLocalBills()[pendingBill.id] = pendingBill.data;
    if (!saveLocalBills()) {
      delete getLocalBills()[pendingBill.id];
      document.getElementById('kaBillError').textContent =
        'ब्राउज़र में जगह कम है। पहले “बिल फ़ाइल डाउनलोड करें” से बिल प्रकाशित करें, फिर दोबारा कोशिश करें।';
      return;
    }
  }

  const year = currentKharchaYear();
  kharchaDraft.expenses[year] = kharchaDraft.expenses[year] || [];
  const editId = document.getElementById('kaEditId').value;
  let row;
  if (editId) {
    const found = findKharchaItem(editId);
    if (found.index !== -1) {
      row = found.list[found.index];
      Object.assign(row, { item: item, amount: amount, note: note, show: show });
    }
    showToast('खर्च बदल दिया गया', 'success');
  } else {
    row = { id: makeId(), item: item, amount: amount, note: note, show: show };
    kharchaDraft.expenses[year].push(row);
    showToast(item + ' (' + formatINR(amount) + ') जोड़ दिया गया', 'success');
  }
  if (row && pendingBill) row.bill = pendingBill.id;
  if (row && billRemoved && !pendingBill) delete row.bill;
  saveKharchaDraft();
  resetKharchaForm();
  renderAdminKharcha();
  document.getElementById('kaItem').focus();
}

/** Downloads a new kharcha.js with the admin's changes. */
async function publishKharcha() {
  let source;
  try {
    const response = await fetch('js/kharcha.js', { cache: 'no-store' });
    if (!response.ok) throw new Error('not found');
    source = await response.text();
  } catch (error) {
    showToast('kharcha.js नहीं पढ़ी जा सकी। वेबसाइट Live Server या Netlify से खोलें।', 'error');
    return;
  }

  const startMarker = '/* EXPENSES-START';
  const endMarker = '/* EXPENSES-END */';
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start === -1 || end === -1) {
    showToast('kharcha.js में खर्चे की सूची नहीं मिली।', 'error');
    return;
  }

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

  try {
    new Function(output); // checks the code without running it
  } catch (error) {
    console.error(error);
    showToast('नई kharcha.js बनाने में गड़बड़ी हुई। कुछ नहीं बदला गया।', 'error');
    return;
  }

  const blob = new Blob([output], { type: 'text/javascript;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'kharcha.js';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  showToast('kharcha.js डाउनलोड हो गई। इसे js फ़ोल्डर में रखें और Netlify पर अपलोड करें।', 'success');
}

/** Downloads kharcha-bills.js with every bill photo used in the expenses. */
async function publishBills() {
  const ids = referencedBillIds();
  if (!ids.length) {
    showToast('कोई बिल नहीं जोड़ा गया है।', 'error');
    return;
  }
  const bills = {};
  const missing = [];
  for (const id of ids) {
    const data = await getBillData(id);
    if (data) bills[id] = data;
    else missing.push(id);
  }
  if (missing.length) {
    showToast(missing.length + ' बिल नहीं मिले। वेबसाइट Live Server या Netlify से खोलें और पुरानी kharcha-bills.js js फ़ोल्डर में होनी चाहिए।', 'error');
    return;
  }

  const lines = [
    '/* Bill photos for kharcha.js — created by the admin panel.',
    '   Visitors download this file only when they tap "बिल देखें". */',
    'window.KHARCHA_BILLS = {'
  ];
  ids.forEach(function (id) { lines.push('  ' + JSON.stringify(id) + ': ' + JSON.stringify(bills[id]) + ','); });
  lines.push('};', '');

  const blob = new Blob([lines.join('\n')], { type: 'text/javascript;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'kharcha-bills.js';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);

  // Bills no longer used by any expense can be removed from this browser
  const local = getLocalBills();
  Object.keys(local).forEach(function (id) { if (ids.indexOf(id) === -1) delete local[id]; });
  saveLocalBills();

  const sizeKB = Math.round(lines.join('').length / 1024);
  showToast('kharcha-bills.js डाउनलोड हो गई (' + ids.length + ' बिल, ' + sizeKB + ' KB)। इसे js फ़ोल्डर में रखें।', 'success');
}
