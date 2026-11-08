/* ==========================================================================
   gallery.js — shows photos added from the admin panel (data/gallery.json)
   in the home page gallery, after the existing photos.
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
