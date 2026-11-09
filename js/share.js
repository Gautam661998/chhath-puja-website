/* ==========================================================================
   share.js — "WhatsApp पर शेयर करें" button
   Load on index.html and donation.html after main.js.
   Opens WhatsApp with a ready message and the website link.
   ========================================================================== */

'use strict';

const SHARE_URL = 'https://shreepurparsa.github.io/';

const SHARE_TEXT =
  'जय छठी मईया 🙏\n' +
  'श्रीपुर परसा छठ पूजा की वेबसाइट देखें —\n' +
  'दान सूची, खर्चे का हिसाब और घाट की तस्वीरें:\n' +
  SHARE_URL;

function shareButtonHTML(extraStyle) {
  return '<a class="btn share-btn" lang="hi" href="https://wa.me/?text=' + encodeURIComponent(SHARE_TEXT) + '" target="_blank" rel="noopener"' +
    ' style="background:#1E8E4E;color:#FFFFFF;gap:.5rem;' + (extraStyle || '') + '">' +
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>' +
    'WhatsApp पर शेयर करें</a>';
}

document.addEventListener('DOMContentLoaded', function () {
  // Home page: next to the buttons in the top section
  const heroActions = document.querySelector('.hero-actions');
  if (heroActions && !heroActions.querySelector('.share-btn')) {
    heroActions.insertAdjacentHTML('beforeend', shareButtonHTML());
  }

  // Donations page: under the page heading
  const banner = document.querySelector('.page-banner .container');
  if (banner && !banner.querySelector('.share-btn')) {
    banner.insertAdjacentHTML('beforeend', '<div style="margin-top:1.25rem">' + shareButtonHTML() + '</div>');
  }
});
