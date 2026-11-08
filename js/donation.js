/* ==========================================================================
   donation.js — Donation Records page (donation.html)
   Read-only view for visitors: year filter, donor search, totals, CSV.
   Uses DonationStore and helpers from main.js.
   ========================================================================== */

'use strict';

/* --------------------------------------------------------------------------
   UPI DONATION SETTINGS — change these to your Samiti's details
   -------------------------------------------------------------------------- */
const UPI_CONFIG = {
  // Your UPI ID, exactly as shown in PhonePe / Google Pay (e.g. 'aniket123@ybl')
  upiId: '9608070623@yb',

  // Name shown to the donor (should match the bank account name)
  payeeName: 'Digambar',

  // Note that appears in the donor's payment history
  note: 'Chhath Puja Donation',

  // Quick amount buttons (₹). Leave [] for none.
  suggestedAmounts: [101, 201, 501, 1100],

  // WhatsApp number for payment screenshots: 91 + 10-digit number, no + or spaces.
  // Leave '' to hide the WhatsApp button.
  whatsappNumber: '9608070623'
};

document.addEventListener('DOMContentLoaded', setupUpiDonate);
document.addEventListener('DOMContentLoaded', initDonationPage);

async function initDonationPage() {
  const page = {
    yearSelect: document.getElementById('yearSelect'),
    searchInput: document.getElementById('searchInput'),
    exportBtn: document.getElementById('exportBtn'),
    body: document.getElementById('donationBody'),
    foot: document.getElementById('donationFoot'),
    statTotal: document.getElementById('statTotal'),
    statCount: document.getElementById('statCount'),
    statHighest: document.getElementById('statHighest'),
    statYearLabel: document.getElementById('statYearLabel'),
    tableTitle: document.getElementById('tableTitle'),
    resultCount: document.getElementById('resultCount')
  };

  // Year from the address bar, e.g. donation.html?year=2025
  const urlYear = Number(new URLSearchParams(window.location.search).get('year'));

  try {
    await fillYearOptions(page, urlYear);
    await renderDonations(page);
  } catch (error) {
    showLoadError(page, error);
    return;
  }

  page.yearSelect.addEventListener('change', function () {
    updateAddressBar(page.yearSelect.value);
    renderDonations(page).catch(function (error) { showLoadError(page, error); });
  });

  page.searchInput.addEventListener('input', function () {
    renderDonations(page).catch(function (error) { showLoadError(page, error); });
  });

  page.exportBtn.addEventListener('click', function () {
    exportYear(page).catch(function (error) { showToast(error.message, 'error'); });
  });

  // If the admin changes records in another tab of this browser, refresh automatically
  window.addEventListener('storage', function (event) {
    if (event.key !== STORAGE_KEY) return;
    const selected = Number(page.yearSelect.value);
    fillYearOptions(page, selected)
      .then(function () { return renderDonations(page); })
      .catch(function (error) { showLoadError(page, error); });
  });
}

/**
 * Builds the year dropdown. It always includes the current year and the
 * two years before it, plus any year that has records.
 */
async function fillYearOptions(page, preferredYear) {
  const recordYears = await DonationStore.getYears();
  const thisYear = new Date().getFullYear();
  const years = new Set(recordYears.concat([thisYear, thisYear - 1, thisYear - 2]));
  const sorted = Array.from(years).sort(function (a, b) { return b - a; });

  page.yearSelect.innerHTML = sorted.map(function (year) {
    return '<option value="' + year + '">' + year + '</option>';
  }).join('');

  // Choose: year from URL → current year if it has records → latest year with records → current year
  let selected = thisYear;
  if (preferredYear && sorted.includes(preferredYear)) {
    selected = preferredYear;
  } else if (!recordYears.includes(thisYear) && recordYears.length) {
    selected = recordYears[0];
  }
  page.yearSelect.value = String(selected);
}

/** Shows totals and the donor list for the selected year. */
async function renderDonations(page) {
  const year = Number(page.yearSelect.value);
  const query = page.searchInput.value.trim().toLowerCase();

  const yearRecords = await DonationStore.getByYear(year);
  const summary = summarizeDonations(yearRecords);

  // Summary cards always show the full year, not just the search results
  page.statYearLabel.textContent = year;
  page.statTotal.textContent = formatINR(summary.total);
  page.statCount.textContent = formatCount(summary.count);
  page.statHighest.textContent = formatINR(summary.highest);
  page.tableTitle.textContent = 'Donor list ' + year;
  document.title = 'Donation Records ' + year + ' | Chhath Puja, ' + SITE_CONFIG.villageName;

  const visible = query
    ? yearRecords.filter(function (record) { return nameMatches(record.name, query); })
    : yearRecords;

  page.resultCount.textContent = query
    ? 'Showing ' + visible.length + ' of ' + yearRecords.length + ' donations'
    : yearRecords.length + (yearRecords.length === 1 ? ' donation' : ' donations');

  page.exportBtn.disabled = yearRecords.length === 0;

  // Empty states
  if (!yearRecords.length) {
    page.body.innerHTML = emptyRow('No donations have been recorded for ' + year + ' yet.');
    page.foot.innerHTML = '';
    return;
  }
  if (!visible.length) {
    page.body.innerHTML = emptyRow('No donor named “' + escapeHTML(page.searchInput.value.trim()) + '” in ' + year + '.');
    page.foot.innerHTML = '';
    return;
  }

  page.body.innerHTML = visible.map(function (record, index) {
    return (
      '<tr>' +
      '<td data-label="#">' + (index + 1) + '</td>' +
      '<td data-label="Donor name">' + escapeHTML(record.name) + '</td>' +
      '<td data-label="Amount" class="num">' + formatINR(record.amount) + '</td>' +
      '<td data-label="Date">' + formatDate(record.date) + '</td>' +
      '</tr>'
    );
  }).join('');

  const shownSummary = summarizeDonations(visible);
  page.foot.innerHTML =
    '<tr>' +
    '<td data-label="">' + '</td>' +
    '<td data-label="Total">' + (query ? 'Total (search results)' : 'Total collection ' + year) + '</td>' +
    '<td data-label="Amount" class="num">' + formatINR(shownSummary.total) + '</td>' +
    '<td data-label="Donors">' + formatCount(shownSummary.count) + ' donors</td>' +
    '</tr>';
}

/** Downloads the selected year's records as CSV. */
async function exportYear(page) {
  const year = Number(page.yearSelect.value);
  const records = await DonationStore.getByYear(year);
  if (!records.length) {
    showToast('There are no records for ' + year + ' to download.', 'error');
    return;
  }
  downloadCSV('chhath-puja-donations-' + year + '.csv', donationsToCSV(records));
  showToast('Downloaded ' + records.length + ' records for ' + year + '.', 'success');
}

function emptyRow(message) {
  return '<tr class="empty-row"><td colspan="4">' + message + '</td></tr>';
}

function updateAddressBar(year) {
  const url = new URL(window.location.href);
  url.searchParams.set('year', year);
  try {
    window.history.replaceState(null, '', url);
  } catch (error) {
    // Some browsers block this for files opened directly from disk; safe to ignore
  }
}

function showLoadError(page, error) {
  console.error(error);
  page.body.innerHTML = emptyRow(escapeHTML(error.message || 'Donation records could not be loaded.'));
  page.foot.innerHTML = '';
}

/* --------------------------------------------------------------------------
   DONATE WITH UPI
   The website only shows the QR code and UPI ID. The money goes directly
   from the donor's app to the Samiti's bank account. The website cannot
   see payments, so admins add each donor to the list after checking.
   -------------------------------------------------------------------------- */
function setupUpiDonate() {
  const section = document.getElementById('donate');
  if (!section) return;

  const upiId = UPI_CONFIG.upiId.trim();
  const hasUpiId = upiId && upiId !== 'yourname@upi';
  const isPhone = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  let selectedAmount = null;

  const idRow = document.getElementById('upiIdRow');
  const idText = document.getElementById('upiIdText');
  const nameText = document.getElementById('upiNameText');
  const copyBtn = document.getElementById('copyUpiBtn');
  const mobilePay = document.getElementById('mobilePay');
  const amountsBox = document.getElementById('donateAmounts');
  const payLink = document.getElementById('upiPayLink');
  const desktopHint = document.getElementById('desktopHint');
  const whatsappLink = document.getElementById('whatsappLink');

  nameText.textContent = UPI_CONFIG.payeeName;

  // Without a real UPI ID, only the QR code is shown
  if (!hasUpiId) {
    idRow.hidden = true;
    mobilePay.hidden = true;
  } else {
    idText.textContent = upiId;
    // "Pay with UPI app" only works on phones; computers use the QR code
    mobilePay.hidden = !isPhone;
    desktopHint.hidden = isPhone;
  }

  // Quick amount buttons
  amountsBox.innerHTML = UPI_CONFIG.suggestedAmounts.map(function (amount) {
    return '<button class="amount-chip" type="button" aria-pressed="false" data-amount="' + amount + '">' +
      formatINR(amount) + '</button>';
  }).join('');
  if (!UPI_CONFIG.suggestedAmounts.length) {
    document.getElementById('amountLabel').hidden = true;
  }

  amountsBox.addEventListener('click', function (event) {
    const chip = event.target.closest('.amount-chip');
    if (!chip) return;
    const amount = Number(chip.getAttribute('data-amount'));
    // Tapping the selected amount again clears it
    selectedAmount = selectedAmount === amount ? null : amount;
    amountsBox.querySelectorAll('.amount-chip').forEach(function (button) {
      button.setAttribute('aria-pressed', String(Number(button.getAttribute('data-amount')) === selectedAmount));
    });
    updateLinks();
  });

  copyBtn.addEventListener('click', function () {
    copyText(upiId).then(function () {
      showToast('UPI ID copied: ' + upiId, 'success');
    }).catch(function () {
      showToast('Copy did not work. Please note the UPI ID: ' + upiId, 'error');
    });
  });

  function updateLinks() {
    // Standard UPI payment link understood by PhonePe, Google Pay, Paytm, BHIM
    const params = [
      'pa=' + encodeURIComponent(upiId),
      'pn=' + encodeURIComponent(UPI_CONFIG.payeeName),
      'cu=INR',
      'tn=' + encodeURIComponent(UPI_CONFIG.note)
    ];
    if (selectedAmount) params.push('am=' + selectedAmount.toFixed(2));
    payLink.href = 'upi://pay?' + params.join('&');
    payLink.textContent = selectedAmount ? 'Pay ' + formatINR(selectedAmount) + ' with UPI app' : 'Pay with UPI app';

    const number = String(UPI_CONFIG.whatsappNumber || '').replace(/\D/g, '');
    if (number) {
      const message = 'Namaste! I have donated' + (selectedAmount ? ' ' + formatINR(selectedAmount) : '') +
        ' for Chhath Puja (' + SITE_CONFIG.villageName + '). My name: ';
      whatsappLink.href = 'https://wa.me/' + number + '?text=' + encodeURIComponent(message);
      whatsappLink.hidden = false;
    } else {
      whatsappLink.hidden = true;
    }
  }

  updateLinks();
}

/** Copies text to the clipboard, with a fallback for older phones. */
function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise(function (resolve, reject) {
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'absolute';
    field.style.left = '-9999px';
    document.body.appendChild(field);
    field.select();
    const ok = document.execCommand('copy');
    field.remove();
    ok ? resolve() : reject(new Error('Copy failed'));
  });
}
