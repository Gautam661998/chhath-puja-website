/* ==========================================================================
   safe-publish.js — makes 🚀 publishing safe when several admins publish.
   Load on admin.html LAST (after admin.js, hindi.js, kharcha.js and
   github-publish.js).

   When an admin presses 🚀, this reads the newest donations from GitHub
   and adds only this phone's own changes (added, edited, deleted), so
   nobody's donations are lost and nobody has to wait or refresh.
   The GitHub history also records who published and what changed.
   Nothing on the page looks different.
   ========================================================================== */

'use strict';

function currentAdminName() {
  const user = typeof getLoggedInUser === 'function' ? getLoggedInUser() : null;
  return user && typeof ADMIN_USERS !== 'undefined' && ADMIN_USERS[user] ? ADMIN_USERS[user].name : 'Admin';
}

/* --------------------------------------------------------------------------
   WHAT THIS BROWSER CHANGED (compared with the website version it loaded)
   -------------------------------------------------------------------------- */
function donationKey(r) {
  return String(r.name).trim() + '|' + Number(r.amount) + '|' + r.date;
}

/** Counts how many times each donation occurs. */
function countKeys(list) {
  const counts = {};
  list.forEach(function (r) { const k = donationKey(r); counts[k] = (counts[k] || 0) + 1; });
  return counts;
}

/* What this browser last published (until the website itself shows it), so that a second
   publish in the same few minutes does not send the same donations again. */
const PUBLISH_BASE_KEY = 'chhathPuja.publishBase.v1';

function websiteVersion() {
  return typeof codeDataFingerprint === 'function' ? codeDataFingerprint() : '';
}

function publishBase() {
  try {
    const saved = JSON.parse(localStorage.getItem(PUBLISH_BASE_KEY) || 'null');
    if (saved && saved.code === websiteVersion() && Array.isArray(saved.list)) return saved.list;
  } catch (error) { /* ignore */ }
  return SAMPLE_DONATIONS;                       // the website as it was when this page opened
}

function rememberPublished(list) {
  try {
    localStorage.setItem(PUBLISH_BASE_KEY, JSON.stringify({
      code: websiteVersion(),
      list: list.map(function (r) { return { name: r.name, amount: Number(r.amount), date: r.date, year: Number(r.year) }; })
    }));
  } catch (error) { /* ignore */ }
  // This browser now holds exactly what was published (other admins' new donations too)
  const pool = DonationStore._load().slice();
  const synced = list.map(function (r) {
    const i = pool.findIndex(function (c) { return donationKey(c) === donationKey(r); });
    if (i !== -1) return pool.splice(i, 1)[0];
    return { id: 'sample-pub-' + makeId(), name: r.name, amount: Number(r.amount), date: r.date, year: Number(r.year), createdAt: new Date().toISOString() };
  });
  DonationStore._save(synced);
}

/** Donations added here (and new versions of edited ones) and the ones removed or replaced. */
function localDonationChanges() {
  const base = publishBase();
  const current = DonationStore._load();
  const baseLeft = countKeys(base);
  const added = [];
  current.forEach(function (r) {
    const k = donationKey(r);
    if (baseLeft[k] > 0) baseLeft[k]--;
    else added.push(r);
  });
  const currentLeft = countKeys(current);
  const removed = [];
  base.forEach(function (r) {
    const k = donationKey(r);
    if (currentLeft[k] > 0) currentLeft[k]--;
    else removed.push(r);
  });
  return { added: added, removed: removed };
}

/* --------------------------------------------------------------------------
   SAFE PUBLISHING FOR SUPER ADMINS
   Replaces buildMainJs() from github-publish.js with a merging version.
   -------------------------------------------------------------------------- */
let lastPublishSummary = '';
let pendingMerged = null;

/** Reads the donation list from the newest main.js on GitHub (data only, nothing else runs). */
function donationsInSource(source) {
  const end = source.indexOf('].map(function ([name, amount, date], index) {');
  if (end === -1) throw new Error('main.js में दान सूची नहीं मिली।');
  const head = source.slice(0, end).replace(/^\s*'use strict';?/m, '');
  const rows = new Function(head + ']; return SAMPLE_DONATIONS;')();
  return rows.map(function (row) {
    return { name: row[0], amount: Number(row[1]), date: row[2], year: Number(String(row[2]).slice(0, 4)) };
  });
}

if (typeof buildMainJs === 'function') {
  buildMainJs = async function (source) {
    const startMarker = 'const SAMPLE_DONATIONS = [';
    const endMarker = '].map(function ([name, amount, date], index) {';
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start);
    if (start === -1 || end === -1) throw new Error('main.js में दान सूची नहीं मिली।');

    const latest = donationsInSource(source);
    const changes = localDonationChanges();

    // newest list − what this browser removed or replaced + what it added
    const removeLeft = countKeys(changes.removed);
    const merged = latest.filter(function (r) {
      const k = donationKey(r);
      if (removeLeft[k] > 0) { removeLeft[k]--; return false; }
      return true;
    }).concat(changes.added.map(function (r) {
      return { name: r.name, amount: Number(r.amount), date: r.date, year: Number(r.year) };
    }));

    const editedCount = Math.min(changes.added.length, changes.removed.length);
    const parts = [];
    if (changes.added.length - editedCount) parts.push((changes.added.length - editedCount) + ' दान जोड़े');
    if (editedCount) parts.push(editedCount + ' बदले');
    if (changes.removed.length - editedCount) parts.push((changes.removed.length - editedCount) + ' हटाए');
    lastPublishSummary = parts.join(', ');
    pendingMerged = merged;

    const years = Array.from(new Set(merged.map(function (r) { return r.year; }))).sort(function (a, b) { return b - a; });
    const lines = [startMarker];
    years.forEach(function (year) {
      const list = merged.filter(function (r) { return r.year === year; });
      lines.push('  // ---------- Chhath Puja ' + year + ' — ' + list.length + ' donations, total ' + formatINR(summarizeDonations(list).total) + ' ----------');
      list.forEach(function (r) {
        lines.push('  [' + JSON.stringify(r.name) + ', ' + Number(r.amount) + ', ' + JSON.stringify(r.date) + '],');
      });
      lines.push('');
    });
    for (let i = lines.length - 1; i >= 0; i--) {
      if (/,$/.test(lines[i])) { lines[i] = lines[i].replace(/,$/, ''); break; }
    }
    if (!merged.length) lines.push('  // No donations yet');

    let output = source.slice(0, start) + lines.join('\n').replace(/\n+$/, '') + '\n' + source.slice(end);
    if (typeof OLD_MERGE_BLOCK === 'string' && output.indexOf('const publishedNow = {};') === -1 &&
        output.indexOf(OLD_MERGE_BLOCK) !== -1) {
      output = output.replace(OLD_MERGE_BLOCK, NEW_MERGE_BLOCK);
    }
    new Function(output);
    return output;
  };
}

/* Expenses: never overwrite another admin's newer expenses. */
if (typeof buildKharchaJs === 'function') {
  const originalBuildKharchaJs = buildKharchaJs;
  buildKharchaJs = function (source) {
    if (typeof kharchaDraft === 'undefined' || !kharchaDraft) return null;
    if (!draftHasChanges()) return source;                 // nothing changed here: leave GitHub as it is
    const s = source.indexOf('/* EXPENSES-START');
    const e = source.indexOf('/* EXPENSES-END */', s);
    if (s !== -1 && e !== -1) {
      const block = source.slice(s, e);
      const latest = new Function(block + '; return { EXPENSES: EXPENSES, EXPENSE_SETTINGS: EXPENSE_SETTINGS };')();
      if (kharchaFingerprint(latest.EXPENSES, latest.EXPENSE_SETTINGS) !== kharchaDraft.base) {
        throw new Error('किसी और admin ने अभी-अभी खर्चा बदला है। 10 मिनट बाद पेज रीफ़्रेश करें, अपना बदलाव फिर से करें, और प्रकाशित करें।');
      }
    }
    return originalBuildKharchaJs(source);
  };
}

if (typeof buildBillsJs === 'function') {
  const originalBuildBillsJs = buildBillsJs;
  buildBillsJs = async function () {
    if (typeof kharchaDraft === 'undefined' || !kharchaDraft || !draftHasChanges()) return null;
    return originalBuildBillsJs();
  };
}

/* The GitHub history says who published and what changed. */
if (typeof ghCommitFiles === 'function') {
  const originalCommit = ghCommitFiles;
  ghCommitFiles = function (files, message) {
    const who = currentAdminName();
    const what = lastPublishSummary && /दान/.test(message) ? ' (' + lastPublishSummary + ')' : '';
    lastPublishSummary = '';
    const merged = files.some(function (f) { return f.path === 'js/main.js'; }) ? pendingMerged : null;
    pendingMerged = null;
    return originalCommit(files, who + ': ' + message.replace(/^Admin panel: /, '') + what).then(function (result) {
      if (merged) {
        rememberPublished(merged);
        if (typeof refreshAll === 'function') refreshAll();
      }
      return result;
    });
  };
}
