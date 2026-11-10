/* ==========================================================================
   pwa.js — turns on the app (sw.js) and shows an "ऐप इंस्टॉल करें" button.
   Load on index.html, donation.html and admin.html after main.js.
   ========================================================================== */

'use strict';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function (error) { console.warn('App setup failed', error); });
  });
}

(function () {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (standalone) return;                       // already opened as the app

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let installEvent = null;

  function buttonHTML() {
    return '<button type="button" class="btn install-btn" lang="hi" style="background:var(--white, #fff);color:var(--sindoor, #B3261E);border:2px solid var(--sindoor, #B3261E);gap:.5rem">' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M12 7v7M9 11l3 3 3-3"/></svg>ऐप इंस्टॉल करें</button>';
  }

  function addButtons() {
    if (document.querySelector('.install-btn')) return;
    const heroActions = document.querySelector('.hero-actions');
    if (heroActions) heroActions.insertAdjacentHTML('beforeend', buttonHTML());
    const bannerButtons = document.querySelector('.page-banner .container > div:last-child');
    if (bannerButtons && bannerButtons.querySelector('.share-btn')) bannerButtons.insertAdjacentHTML('beforeend', buttonHTML());
    const footer = document.querySelector('.footer-links');
    if (footer) footer.insertAdjacentHTML('beforeend', '<li><a href="#" class="install-link" lang="hi">📲 ऐप इंस्टॉल करें</a></li>');
    document.querySelectorAll('.install-btn, .install-link').forEach(function (el) {
      el.addEventListener('click', function (event) { event.preventDefault(); install(); });
    });
  }

  async function install() {
    if (installEvent) {
      installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice && choice.outcome === 'accepted') removeButtons();
      installEvent = null;
      return;
    }
    showHelp();
  }

  function removeButtons() {
    document.querySelectorAll('.install-btn').forEach(function (el) { el.remove(); });
    document.querySelectorAll('.install-link').forEach(function (el) { el.closest('li').remove(); });
  }

  /** iPhone (and phones without the install box): how to add it by hand. */
  function showHelp() {
    let dialog = document.getElementById('installHelp');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'installHelp';
      dialog.setAttribute('lang', 'hi');
      dialog.style.cssText = 'max-width:min(92vw,420px);border:0;border-radius:20px;padding:1.5rem;background:var(--paper,#FFF4DF);color:var(--ink,#3A1C0C)';
      dialog.innerHTML = isIOS
        ? '<h3 style="margin-top:0">iPhone पर ऐप ऐसे लगाएँ</h3><ol style="padding-left:1.2rem;line-height:1.7">' +
          '<li>नीचे Safari में <strong>शेयर बटन (⬆️ वाला चौकोर)</strong> दबाएँ।</li>' +
          '<li>नीचे खिसकाकर <strong>"Add to Home Screen"</strong> चुनें।</li>' +
          '<li>ऊपर दाईं ओर <strong>"Add"</strong> दबाएँ।</li></ol><p>होम स्क्रीन पर सूरज वाला <strong>छठ पूजा</strong> आइकन आ जाएगा।</p>' +
          '<button type="button" class="btn btn-primary">ठीक है</button>'
        : '<h3 style="margin-top:0">ऐप ऐसे लगाएँ</h3><ol style="padding-left:1.2rem;line-height:1.7">' +
          '<li>Chrome में ऊपर दाईं ओर <strong>⋮</strong> दबाएँ।</li>' +
          '<li><strong>"Install app"</strong> या <strong>"Add to Home screen"</strong> चुनें।</li>' +
          '<li><strong>"Install"</strong> दबाएँ।</li></ol><p>होम स्क्रीन पर सूरज वाला <strong>छठ पूजा</strong> आइकन आ जाएगा।</p>' +
          '<button type="button" class="btn btn-primary">ठीक है</button>';
      document.body.appendChild(dialog);
      dialog.querySelector('button').addEventListener('click', function () { dialog.close(); });
    }
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else alert(dialog.textContent);
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    installEvent = event;
    addButtons();
  });
  window.addEventListener('appinstalled', removeButtons);

  document.addEventListener('DOMContentLoaded', function () {
    // iPhone and Android phones: show the button (Android gets the real install box when ready)
    const phone = isIOS || /android/i.test(navigator.userAgent);
    if (phone) setTimeout(addButtons, 300);
  });
})();
