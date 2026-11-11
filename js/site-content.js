/* ==========================================================================
   site-content.js — home page: main poster and founders from the admin panel
   Load on index.html after main.js.

   Reads data/site.json (written by "वेबसाइट की फ़ोटो" in the admin panel).
   Until that file exists, the poster and founders in index.html stay as they are.
   ========================================================================== */

'use strict';

(function () {
  function esc(text) {
    return String(text == null ? '' : text).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function founderCard(f) {
    const fx = f.fx === undefined ? 50 : Number(f.fx);
    const fy = f.fy === undefined ? 25 : Number(f.fy);
    const z = Number(f.zoom) || 1;
    const src = f.src || 'images/avatar.svg';
    return '<figure class="founder-card' + (f.lead ? ' is-founder' : '') + '">' +
      '<div class="founder-photo"><span style="display:block;width:100%;height:100%;border-radius:50%;overflow:hidden;border:4px solid #FFFFFF;background:#FFFFFF">' +
        '<img src="' + esc(src) + '" alt="' + esc(f.name) + '" loading="lazy" width="200" height="200" style="width:100%;height:100%;border:0;border-radius:0;display:block;' +
        'object-fit:cover;object-position:' + fx + '% ' + fy + '%;transform:scale(' + z + ');transform-origin:' + fx + '% ' + fy + '%">' +
      '</span></div>' +
      '<figcaption>' + (f.role ? '<span class="founder-role">' + esc(f.role) + '</span>' : '') +
      '<strong class="founder-name">' + esc(f.name) + '</strong></figcaption>' +
    '</figure>';
  }

  document.addEventListener('DOMContentLoaded', async function () {
    let data = null;
    try {
      const response = await fetch('data/site.json', { cache: 'no-store' });
      if (!response.ok) return;                  // not set up from the admin panel yet
      data = await response.json();
    } catch (error) {
      return;
    }

    // Main poster
    if (data.hero && data.hero.src) {
      const hero = document.querySelector('.hero-image');
      if (hero && hero.getAttribute('src') !== data.hero.src) {
        hero.removeAttribute('srcset');
        hero.src = data.hero.src;
      }
    }

    // Founders and co-founders
    if (Array.isArray(data.founders) && data.founders.length) {
      const grid = document.querySelector('.founder-grid');
      if (grid) grid.innerHTML = data.founders.map(founderCard).join('');
    }
  });
})();
