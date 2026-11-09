/* ==========================================================================
   gallery.js — home page extras: admin gallery photos (data/gallery.json)
   and the donation box with year buttons (see the end of this file).
   Load on index.html after main.js.
   ========================================================================== */

'use strict';

document.addEventListener('DOMContentLoaded', async function () {
  const grid = document.querySelector('.gallery-grid');
  if (!grid) return;

  let list = [];
  try {
    const response = await fetch('data/gallery.json', { cache: 'no-store' });
    if (!response.ok) return;              // no admin photos yet
    list = await response.json();
  } catch (error) {
    return;
  }
  if (!Array.isArray(list)) return;

  list.forEach(function (photo) {
    if (!photo || !photo.src) return;
    const caption = String(photo.caption || '');
    const figure = document.createElement('figure');
    figure.className = 'gallery-item' + (photo.size === 'wide' ? ' is-wide' : photo.size === 'tall' ? ' is-tall' : '');
    figure.innerHTML =
      '<button class="gallery-open" type="button" aria-label="' + escapeHTML(caption || 'फ़ोटो') + ', बड़ा करके देखें">' +
        '<img src="' + escapeHTML(photo.src) + '" alt="' + escapeHTML(caption || 'छठ पूजा की फ़ोटो') + '" loading="lazy">' +
      '</button>' +
      (caption ? '<figcaption>' + escapeHTML(caption) + '</figcaption>' : '');
    grid.appendChild(figure);
  });
});

/* ==========================================================================
   HOME PAGE DONATION BOX (index.html) — smarter year
   • Chhath season (Sept–Dec): always shows THIS year, even before the first
     donation, with a "UPI से दान करें" button.
   • Rest of the year: shows the latest Chhath with donations.
   • Shows last year's total for comparison and buttons to switch years.
   Replaces renderHomeStats() from main.js, so main.js is not touched.
   ========================================================================== */
renderHomeStats = async function () {
  const box = document.getElementById('homeStats');
  if (!box) return;

  if (!document.getElementById('homeStatsStyles')) {
    const style = document.createElement('style');
    style.id = 'homeStatsStyles';
    style.textContent =
      '.year-chips{display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:1rem;}' +
      '.year-chip{min-height:34px;padding:.2rem .85rem;border-radius:999px;border:1px solid rgba(255,210,94,.5);' +
      'background:transparent;color:rgba(255,255,255,.85);font:inherit;font-size:.9rem;cursor:pointer;}' +
      '.year-chip[aria-pressed="true"]{background:var(--turmeric);border-color:var(--turmeric);color:var(--ink);font-weight:600;}' +
      '.callout-compare{margin:.25rem 0 1.25rem;padding-top:.75rem;border-top:1px solid rgba(255,255,255,.15);' +
      'color:rgba(255,255,255,.75);font-size:var(--step--1);}' +
      '.callout-actions{display:flex;flex-wrap:wrap;gap:.6rem;}' +
      '.callout-figure.callout-start{font-size:var(--step-2);line-height:1.3;}';
    document.head.appendChild(style);
  }

  let records = [];
  try {
    records = await DonationStore.getAll();
  } catch (error) {
    console.error(error);
    box.hidden = true;
    return;
  }

  const now = new Date();
  const thisYear = now.getFullYear();
  const inSeason = now.getMonth() >= 8;           // September to December
  const yearsWithData = Array.from(new Set(records.map(function (r) { return r.year; })))
    .sort(function (a, b) { return b - a; });
  const years = yearsWithData.slice();
  if (inSeason && years.indexOf(thisYear) === -1) years.unshift(thisYear);
  if (!years.length) { box.hidden = true; return; }

  function totalsFor(year) {
    return summarizeDonations(records.filter(function (r) { return r.year === year; }));
  }

  function render(year) {
    const summary = totalsFor(year);
    const previousYear = years.filter(function (y) { return y < year; })[0];
    const previous = previousYear ? totalsFor(previousYear) : null;
    const isCurrent = year === thisYear;

    const title = isCurrent && inSeason
      ? 'इस वर्ष छठ पूजा ' + year + ' के लिए चंदा'
      : 'छठ पूजा ' + year + ' में कुल चंदा';

    const figure = summary.count
      ? '<p class="callout-figure">' + formatINR(summary.total) + '</p>' +
        '<p class="callout-note">' + (summary.count === 1 ? '1 व्यक्ति ने' : formatCount(summary.count) + ' लोगों ने') +
        ' चंदा दिया' + (isCurrent && inSeason ? ' है (अब तक)' : '') + '</p>'
      : '<p class="callout-figure callout-start">चंदा अभी शुरू हुआ है 🙏</p>' +
        '<p class="callout-note">सबसे पहले दान करने वालों में अपना नाम जोड़ें।</p>';

    const compare = previous && previous.count
      ? '<p class="callout-compare">पिछले वर्ष ' + previousYear + ': ' + formatINR(previous.total) +
        ' · ' + formatCount(previous.count) + ' लोग</p>'
      : '';

    const chips = years.length > 1
      ? '<div class="year-chips" role="group" aria-label="वर्ष चुनें">' + years.map(function (y) {
          return '<button type="button" class="year-chip" data-year="' + y + '" aria-pressed="' + (y === year) + '">' + y + '</button>';
        }).join('') + '</div>'
      : '';

    const donateButton = isCurrent && inSeason
      ? '<a class="btn btn-gold" href="donation.html#donate">UPI से दान करें</a>'
      : '';

    box.setAttribute('lang', 'hi');
    box.innerHTML =
      chips +
      '<h3 id="callout-title">' + title + '</h3>' +
      figure +
      compare +
      '<div class="callout-actions">' +
        donateButton +
        '<a class="btn ' + (donateButton ? 'btn-light-outline' : 'btn-gold') + '" href="donation.html?year=' + year + '">चंदे का पूरा विवरण देखें</a>' +
      '</div>';
  }

  box.hidden = false;
  render(years[0]);

  box.addEventListener('click', function (event) {
    const chip = event.target.closest('.year-chip');
    if (chip) render(Number(chip.getAttribute('data-year')));
  });
};
