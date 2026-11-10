/* ==========================================================================
   share.js — WhatsApp, Facebook and Instagram story buttons
   Load on index.html and donation.html after main.js.

   WhatsApp: opens WhatsApp with a ready message and the website link.
   Facebook: opens Facebook's share box with the website link; Facebook
   shows the preview card (images/og-image.jpg) by itself.
   Instagram: makes a tall story picture (1080x1920) from the home-page
   poster, copies the website link, and opens the phone's share menu,
   where Instagram → Story can be chosen. The picture always uses the
   current poster (images/hero-ghat.jpg), so nothing changes each year.
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

function facebookButtonHTML() {
  return '<a class="btn fb-btn" lang="hi" href="https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(SHARE_URL) + '" target="_blank" rel="noopener"' +
    ' style="background:#1877F2;color:#FFFFFF;gap:.5rem">' +
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 8h3V4h-3c-2.8 0-4.5 1.8-4.5 4.6V11H7v4h2.5v9h4v-9h3l.5-4h-3.5V8.8c0-.5.3-.8.5-.8z"/></svg>' +
    'Facebook पर शेयर करें</a>';
}

function storyButtonHTML() {
  return '<button type="button" class="btn story-btn" lang="hi" style="background:linear-gradient(45deg,#F58529,#DD2A7B,#8134AF);color:#FFFFFF;gap:.5rem;border:0">' +
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>' +
    '<span>Instagram स्टोरी लगाएँ</span></button>';
}

document.addEventListener('DOMContentLoaded', function () {
  // Home page: next to the buttons in the top section
  const heroActions = document.querySelector('.hero-actions');
  if (heroActions && !heroActions.querySelector('.share-btn')) {
    heroActions.insertAdjacentHTML('beforeend', shareButtonHTML() + facebookButtonHTML() + storyButtonHTML());
  }

  // Donations page: under the page heading
  const banner = document.querySelector('.page-banner .container');
  if (banner && !banner.querySelector('.share-btn')) {
    banner.insertAdjacentHTML('beforeend', '<div style="margin-top:1.25rem;display:flex;flex-wrap:wrap;gap:.75rem">' + shareButtonHTML() + facebookButtonHTML() + storyButtonHTML() + '</div>');
  }

  document.querySelectorAll('.story-btn').forEach(function (button) {
    button.addEventListener('click', shareStory);
  });
  // Prepare the story picture in advance, so the share menu opens at once on tap
  setTimeout(function () { makeStoryFile().catch(function () { /* made again on tap */ }); }, 1500);
});

/* --------------------------------------------------------------------------
   INSTAGRAM STORY PICTURE
   -------------------------------------------------------------------------- */
let storyFilePromise = null;

function loadPoster() {
  return new Promise(function (resolve, reject) {
    const tryLoad = function (sources) {
      if (!sources.length) { reject(new Error('पोस्टर नहीं मिला।')); return; }
      const img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { tryLoad(sources.slice(1)); };
      img.src = sources[0];
    };
    const hero = document.querySelector('.hero-image');
    const first = hero && hero.currentSrc ? [hero.currentSrc] : [];
    tryLoad(first.concat(['images/hero-ghat.jpg', 'images/hero-ghat.svg']));
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draws the 1080x1920 story: poster in the middle, village name above, website below. */
async function makeStoryImage() {
  const W = 1080, H = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  try {
    await Promise.all([
      document.fonts.load('400 90px "Yatra One"'),
      document.fonts.load('700 44px "Mukta"'),
      document.fonts.load('400 40px "Mukta"')
    ]);
  } catch (error) { /* system fonts are fine */ }
  const display = '"Yatra One", "Noto Sans Devanagari", serif';
  const sans = '"Mukta", "Noto Sans Devanagari", sans-serif';

  // Evening river background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#2A2452');
  bg.addColorStop(0.55, '#1E2A4A');
  bg.addColorStop(1, '#151D36');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 900, 60, W / 2, 900, 760);
  glow.addColorStop(0, 'rgba(245,166,35,0.35)');
  glow.addColorStop(1, 'rgba(245,166,35,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Marigold toran along the top
  for (let x = 20, i = 0; x < W; x += 44, i++) {
    ctx.fillStyle = i % 2 ? '#E8731A' : '#F5A623';
    ctx.beginPath();
    ctx.arc(x, 24, 16, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Village and Samiti name
  ctx.fillStyle = '#FFD25E';
  ctx.font = '700 46px ' + sans;
  ctx.fillText((typeof SITE_CONFIG !== 'undefined' && SITE_CONFIG.samitiName) || 'श्री छठ पूजा समिति', W / 2, 380);

  // The poster, as large as fits
  const poster = await loadPoster();
  const maxW = 980, maxH = 1000;
  const pw = poster.naturalWidth || 1600, ph = poster.naturalHeight || 900;
  const scale = Math.min(maxW / pw, maxH / ph);
  const dw = Math.round(pw * scale), dh = Math.round(ph * scale);
  const px = Math.round((W - dw) / 2), py = Math.round(450 + (maxH - dh) / 2 * 0.25);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 18;
  roundRect(ctx, px, py, dw, dh, 28);
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundRect(ctx, px, py, dw, dh, 28);
  ctx.clip();
  ctx.drawImage(poster, px, py, dw, dh);
  ctx.restore();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#F5A623';
  roundRect(ctx, px, py, dw, dh, 28);
  ctx.stroke();

  // Below the poster
  let y = py + dh + 140;
  ctx.fillStyle = '#FFE7A8';
  ctx.font = '400 96px ' + display;
  ctx.fillText('जय छठी मईया', W / 2, y);
  y += 90;
  ctx.fillStyle = '#FFF4DF';
  ctx.font = '400 42px ' + sans;
  ctx.fillText('दान सूची · खर्चे का हिसाब · घाट की तस्वीरें', W / 2, y);
  y += 100;
  ctx.font = '700 44px ' + sans;
  const url = SHARE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const tw = ctx.measureText(url).width + 80;
  roundRect(ctx, (W - tw) / 2, y - 58, tw, 84, 42);
  ctx.fillStyle = '#F5A623';
  ctx.fill();
  ctx.fillStyle = '#3A1C0C';
  ctx.fillText(url, W / 2, y);

  return new Promise(function (resolve) { canvas.toBlob(resolve, 'image/jpeg', 0.88); });
}

function makeStoryFile() {
  if (!storyFilePromise) {
    storyFilePromise = makeStoryImage().then(function (blob) {
      return new File([blob], 'chhath-puja-story.jpg', { type: 'image/jpeg' });
    }).catch(function (error) {
      storyFilePromise = null;
      throw error;
    });
  }
  return storyFilePromise;
}

async function shareStory(event) {
  const button = event.currentTarget;
  const label = button.querySelector('span');
  const original = label.textContent;
  // Copy the link first, so it can be pasted into Instagram's "Link" sticker
  try { await navigator.clipboard.writeText(SHARE_URL); } catch (error) { /* not essential */ }

  let file;
  try {
    label.textContent = 'स्टोरी बन रही है…';
    file = await makeStoryFile();
  } catch (error) {
    label.textContent = original;
    alert('स्टोरी की फ़ोटो नहीं बन पाई। पेज रीफ़्रेश करके फिर कोशिश करें।');
    return;
  }
  label.textContent = original;

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      showStoryTip();
      return;
    } catch (error) {
      if (error && error.name === 'AbortError') return;
    }
  }
  // Computer or older phone: download the picture
  const link = document.createElement('a');
  link.href = URL.createObjectURL(file);
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  showStoryTip(true);
}

function showStoryTip(downloaded) {
  const text = (downloaded ? 'स्टोरी की फ़ोटो डाउनलोड हो गई। Instagram खोलकर स्टोरी में लगाएँ। ' : '') +
    'वेबसाइट का लिंक कॉपी हो गया है, स्टोरी में "Link" स्टिकर लगाकर पेस्ट करें।';
  if (typeof showToast === 'function') showToast(text, 'success');
  else alert(text);
}
