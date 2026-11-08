/* ==========================================================================
   admin.js — Admin Panel (admin.html)
   Login, add / edit / delete donations, year-wise summaries, CSV export.
   Uses DonationStore and helpers from main.js.

   ⚠ SECURITY NOTE
   This login check runs in the browser, so anyone who opens this file
   on the live website can read the names and passwords below. It keeps
   casual visitors out, but it is NOT real security. Never use a password
   here that you also use for email, bank or anything else.
   (Changes made in the admin panel only affect that person's own browser,
   so nobody can change what other visitors see.)
   ========================================================================== */

'use strict';

/* --------------------------------------------------------------------------
   AUTHORISED ADMINS
   Only these people can open the admin panel. Everyone else sees
   "You are not authorised".

   To add a person:    copy one line and change the login name, display
                       name and password.
   To remove a person: delete their line.
   Login names are typed in lowercase on the login page (Aniket = aniket).
   -------------------------------------------------------------------------- */
const ADMIN_USERS = {
  // login name     display name                password (change these!)
  aniket: { name: 'Aniket Yadav', password: 'aniket@chhath' },
  gautam: { name: 'Gautam Goswami', password: 'gautam@chhath' },
  digambar: { name: 'Digambar Yadav', password: 'digambar@chhath' },
  shivpujan: { name: 'Shivpujan Yadav', password: 'shivpujan@chhath' },
  kanhaiya: { name: 'Kanhaiya Kumar', password: 'kanhaiya@chhath' }
};

/* Login lasts until the browser tab is closed. Stores the login name. */
const SESSION_KEY = 'chhathPuja.adminUser';

const admin = {}; // references to page elements, filled in init

document.addEventListener('DOMContentLoaded', initAdminPage);

function initAdminPage() {
  admin.loginSection = document.getElementById('loginSection');
  admin.loginForm = document.getElementById('loginForm');
  admin.usernameInput = document.getElementById('usernameInput');
  admin.passwordInput = document.getElementById('passwordInput');
  admin.loginError = document.getElementById('loginError');
  admin.dashboard = document.getElementById('dashboard');
  admin.logoutBtn = document.getElementById('logoutBtn');

  admin.formPanel = document.getElementById('formPanel');
  admin.formTitle = document.getElementById('formTitle');
  admin.form = document.getElementById('donationForm');
  admin.editingId = document.getElementById('editingId');
  admin.nameInput = document.getElementById('donorName');
  admin.amountInput = document.getElementById('donationAmount');
  admin.dateInput = document.getElementById('donationDate');
  admin.yearSelect = document.getElementById('donationYear');
  admin.saveBtn = document.getElementById('saveBtn');
  admin.cancelEditBtn = document.getElementById('cancelEditBtn');

  admin.filterYear = document.getElementById('filterYear');
  admin.searchRecords = document.getElementById('searchRecords');
  admin.exportBtn = document.getElementById('exportBtn');
  admin.statScope = document.getElementById('statScope');
  admin.statTotal = document.getElementById('statTotal');
  admin.statCount = document.getElementById('statCount');
  admin.statHighest = document.getElementById('statHighest');
  admin.recordsTitle = document.getElementById('recordsTitle');
  admin.recordsCount = document.getElementById('recordsCount');
  admin.recordsBody = document.getElementById('recordsBody');
  admin.summaryBody = document.getElementById('summaryBody');
  admin.summaryFoot = document.getElementById('summaryFoot');
  admin.resetSampleBtn = document.getElementById('resetSampleBtn');
  admin.clearAllBtn = document.getElementById('clearAllBtn');

  // Field → error element map used by validation
  admin.fields = {
    name: { input: admin.nameInput, error: document.getElementById('nameError') },
    amount: { input: admin.amountInput, error: document.getElementById('amountError') },
    date: { input: admin.dateInput, error: document.getElementById('dateError') },
    year: { input: admin.yearSelect, error: document.getElementById('yearError') }
  };

  admin.loginForm.addEventListener('submit', handleLogin);
  admin.logoutBtn.addEventListener('click', handleLogout);

  if (isLoggedIn()) {
    showDashboard();
  } else {
    (admin.usernameInput || admin.passwordInput).focus();
  }
}

/* --------------------------------------------------------------------------
   LOGIN / LOGOUT
   -------------------------------------------------------------------------- */
/** Returns the logged-in admin's login name, or null. */
function getLoggedInUser() {
  try {
    const user = sessionStorage.getItem(SESSION_KEY);
    return user && ADMIN_USERS[user] ? user : null;
  } catch (error) {
    return null;
  }
}

function isLoggedIn() {
  return getLoggedInUser() !== null;
}

let currentUser = null; // used if sessionStorage is blocked

function handleLogin(event) {
  event.preventDefault();

  if (!admin.usernameInput) {
    showLoginError('The login page is out of date. Update admin.html with the new login form.');
    return;
  }

  const username = admin.usernameInput.value.trim().toLowerCase();
  const password = admin.passwordInput.value;

  clearLoginErrors();

  if (!username) {
    showLoginError('Enter your name.', admin.usernameInput);
    return;
  }

  // Not in the list → not authorised
  if (!Object.prototype.hasOwnProperty.call(ADMIN_USERS, username)) {
    showLoginError('You are not authorised to open the admin panel. Only Samiti admins can log in.', admin.usernameInput);
    admin.passwordInput.value = '';
    return;
  }

  if (!password) {
    showLoginError('Enter your password.', admin.passwordInput);
    return;
  }

  if (password !== ADMIN_USERS[username].password) {
    showLoginError('That password is incorrect. Try again.', admin.passwordInput);
    admin.passwordInput.select();
    return;
  }

  currentUser = username;
  try {
    sessionStorage.setItem(SESSION_KEY, username);
  } catch (error) {
    // If sessionStorage is blocked, the admin stays logged in until refresh
  }
  admin.usernameInput.value = '';
  admin.passwordInput.value = '';
  showDashboard();
  showToast('Welcome, ' + ADMIN_USERS[username].name, 'success');
}

function showLoginError(message, field) {
  admin.loginError.textContent = message;
  admin.loginError.hidden = false;
  const target = field || admin.passwordInput;
  target.classList.add('is-invalid');
  target.focus();
}

function clearLoginErrors() {
  admin.loginError.hidden = true;
  admin.passwordInput.classList.remove('is-invalid');
  if (admin.usernameInput) admin.usernameInput.classList.remove('is-invalid');
}

function handleLogout() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch (error) {
    // ignore
  }
  currentUser = null;
  admin.dashboard.hidden = true;
  admin.loginSection.hidden = false;
  clearLoginErrors();
  (admin.usernameInput || admin.passwordInput).focus();
  showToast('Logged out');
}

/* --------------------------------------------------------------------------
   DASHBOARD SETUP
   -------------------------------------------------------------------------- */
let dashboardReady = false;

async function showDashboard() {
  admin.loginSection.hidden = true;
  admin.dashboard.hidden = false;

  // Show who is logged in
  const user = getLoggedInUser() || currentUser;
  const welcome = admin.dashboard.querySelector('.admin-bar p');
  if (welcome && user && ADMIN_USERS[user]) {
    welcome.textContent = 'Logged in as ' + ADMIN_USERS[user].name + '.';
  }

  if (!dashboardReady) {
    bindDashboardEvents();
    dashboardReady = true;
  }

  admin.dateInput.max = todayISO();
  resetForm();
  await refreshAll();
}

function bindDashboardEvents() {
  admin.form.addEventListener('submit', handleSave);
  admin.cancelEditBtn.addEventListener('click', function () {
    resetForm();
    showToast('Editing cancelled');
  });

  // Picking a date also picks the matching Chhath year (can still be changed)
  admin.dateInput.addEventListener('change', function () {
    const year = Number(admin.dateInput.value.slice(0, 4));
    if (year) {
      ensureYearOption(admin.yearSelect, year);
      admin.yearSelect.value = String(year);
    }
  });

  // Clear a field's error as soon as the admin starts fixing it
  Object.keys(admin.fields).forEach(function (key) {
    const field = admin.fields[key];
    const eventName = field.input.tagName === 'SELECT' || field.input.type === 'date' ? 'change' : 'input';
    field.input.addEventListener(eventName, function () { setFieldError(key, ''); });
  });

  admin.filterYear.addEventListener('change', renderRecords);
  admin.searchRecords.addEventListener('input', renderRecords);
  admin.exportBtn.addEventListener('click', handleExport);

  // Edit / delete buttons inside the table (event delegation)
  admin.recordsBody.addEventListener('click', function (event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const id = button.getAttribute('data-id');
    if (button.getAttribute('data-action') === 'edit') startEdit(id);
    if (button.getAttribute('data-action') === 'delete') handleDelete(id);
  });

  admin.resetSampleBtn.addEventListener('click', handleResetSample);
  admin.clearAllBtn.addEventListener('click', handleClearAll);

  // Keep in sync if records change in another tab
  window.addEventListener('storage', function (event) {
    if (event.key === STORAGE_KEY) refreshAll();
  });
}

/** Re-draws everything that depends on the data. */
async function refreshAll() {
  try {
    await fillYearSelects();
    await renderRecords();
    await renderSummary();
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Records could not be loaded.', 'error');
  }
}

/** Fills the form's year list and the filter's year list. */
async function fillYearSelects() {
  const recordYears = await DonationStore.getYears();
  const thisYear = new Date().getFullYear();

  // Form: next year, this year, and the previous 3 years, plus any year with records
  const formYears = new Set(recordYears.concat([thisYear + 1, thisYear, thisYear - 1, thisYear - 2, thisYear - 3]));
  const formSelected = admin.yearSelect.value || String(thisYear);
  admin.yearSelect.innerHTML = '<option value="">Select year</option>' + sortDesc(formYears).map(yearOption).join('');
  admin.yearSelect.value = formSelected;

  // Filter: "All years" + years that have records (and this year)
  const filterYears = new Set(recordYears.concat([thisYear]));
  const filterSelected = admin.filterYear.value || String(recordYears.includes(thisYear) || !recordYears.length ? thisYear : recordYears[0]);
  admin.filterYear.innerHTML = '<option value="all">All years</option>' + sortDesc(filterYears).map(yearOption).join('');
  admin.filterYear.value = Array.from(admin.filterYear.options).some(function (o) { return o.value === filterSelected; })
    ? filterSelected
    : 'all';
}

function yearOption(year) {
  return '<option value="' + year + '">' + year + '</option>';
}

function sortDesc(set) {
  return Array.from(set).sort(function (a, b) { return b - a; });
}

function ensureYearOption(select, year) {
  const exists = Array.from(select.options).some(function (option) { return option.value === String(year); });
  if (!exists) {
    select.insertAdjacentHTML('beforeend', yearOption(year));
    const options = Array.from(select.options).filter(function (o) { return o.value; });
    options.sort(function (a, b) { return Number(b.value) - Number(a.value); });
    options.forEach(function (option) { select.appendChild(option); });
  }
}

/* --------------------------------------------------------------------------
   RECORDS TABLE + STATS
   -------------------------------------------------------------------------- */
async function getFilteredRecords() {
  const year = admin.filterYear.value;
  return year === 'all' ? DonationStore.getAll() : DonationStore.getByYear(year);
}

async function renderRecords() {
  const year = admin.filterYear.value;
  const query = admin.searchRecords.value.trim().toLowerCase();
  const records = await getFilteredRecords();
  const summary = summarizeDonations(records);

  const scope = year === 'all' ? '(all years)' : year;
  admin.statScope.textContent = scope;
  admin.statTotal.textContent = formatINR(summary.total);
  admin.statCount.textContent = formatCount(summary.count);
  admin.statHighest.textContent = formatINR(summary.highest);
  admin.recordsTitle.textContent = year === 'all' ? 'All donation records' : 'Donation records ' + year;
  admin.exportBtn.disabled = records.length === 0;

  const visible = query
    ? records.filter(function (record) { return nameMatches(record.name, query); })
    : records;

  admin.recordsCount.textContent = query
    ? 'Showing ' + visible.length + ' of ' + records.length
    : records.length + (records.length === 1 ? ' record' : ' records');

  if (!records.length) {
    admin.recordsBody.innerHTML = emptyAdminRow(
      year === 'all' ? 'No records yet. Add the first donation using the form.' : 'No donations recorded for ' + year + ' yet. Add one using the form.'
    );
    return;
  }
  if (!visible.length) {
    admin.recordsBody.innerHTML = emptyAdminRow('No donor named “' + escapeHTML(admin.searchRecords.value.trim()) + '”.');
    return;
  }

  const editingId = admin.editingId.value;
  admin.recordsBody.innerHTML = visible.map(function (record) {
    const id = escapeHTML(record.id);
    const name = escapeHTML(record.name);
    return (
      '<tr' + (record.id === editingId ? ' style="background:#fde7c0"' : '') + '>' +
      '<td data-label="Donor name">' + name + '</td>' +
      '<td data-label="Amount" class="num">' + formatINR(record.amount) + '</td>' +
      '<td data-label="Date">' + formatDate(record.date) + '</td>' +
      '<td data-label="Year">' + record.year + '</td>' +
      '<td data-label="Actions">' +
      '<div class="row-actions">' +
      '<button class="btn btn-outline btn-small" type="button" data-action="edit" data-id="' + id + '" aria-label="Edit donation from ' + name + '">Edit</button>' +
      '<button class="btn btn-danger btn-small" type="button" data-action="delete" data-id="' + id + '" aria-label="Delete donation from ' + name + '">Delete</button>' +
      '</div>' +
      '</td>' +
      '</tr>'
    );
  }).join('');
}

function emptyAdminRow(message) {
  return '<tr class="empty-row"><td colspan="5">' + message + '</td></tr>';
}

/** Year-wise summary table: one row per year with records. */
async function renderSummary() {
  const all = await DonationStore.getAll();
  const years = await DonationStore.getYears();

  if (!years.length) {
    admin.summaryBody.innerHTML = '<tr class="empty-row"><td colspan="4">No records yet.</td></tr>';
    admin.summaryFoot.innerHTML = '';
    return;
  }

  admin.summaryBody.innerHTML = years.map(function (year) {
    const summary = summarizeDonations(all.filter(function (record) { return record.year === year; }));
    return (
      '<tr>' +
      '<td data-label="Year"><a href="donation.html?year=' + year + '">' + year + '</a></td>' +
      '<td data-label="Donors" class="num">' + formatCount(summary.count) + '</td>' +
      '<td data-label="Total collection" class="num">' + formatINR(summary.total) + '</td>' +
      '<td data-label="Highest" class="num">' + formatINR(summary.highest) + '</td>' +
      '</tr>'
    );
  }).join('');

  const overall = summarizeDonations(all);
  admin.summaryFoot.innerHTML =
    '<tr>' +
    '<td data-label="Year">All years</td>' +
    '<td data-label="Donors" class="num">' + formatCount(overall.count) + '</td>' +
    '<td data-label="Total collection" class="num">' + formatINR(overall.total) + '</td>' +
    '<td data-label="Highest" class="num">' + formatINR(overall.highest) + '</td>' +
    '</tr>';
}

/* --------------------------------------------------------------------------
   ADD / EDIT
   -------------------------------------------------------------------------- */
async function handleSave(event) {
  event.preventDefault();

  const input = {
    name: admin.nameInput.value,
    amount: admin.amountInput.value,
    date: admin.dateInput.value,
    year: admin.yearSelect.value
  };

  // Validate here first so errors appear next to the fields
  const check = validateDonation(input);
  clearFieldErrors();
  if (!check.valid) {
    showFieldErrors(check.errors);
    return;
  }

  const editingId = admin.editingId.value;
  admin.saveBtn.disabled = true;

  try {
    if (editingId) {
      await DonationStore.update(editingId, input);
      showToast('Donation updated', 'success');
    } else {
      await DonationStore.add(input);
      showToast('Donation added: ' + formatINR(check.value.amount) + ' from ' + check.value.name, 'success');
    }

    // Show the year the record was saved in
    const savedYear = String(check.value.year);
    resetForm();
    await fillYearSelects();
    if (admin.filterYear.value !== 'all') {
      admin.filterYear.value = savedYear;
    }
    await renderRecords();
    await renderSummary();
    admin.nameInput.focus();
  } catch (error) {
    if (error instanceof ValidationError) {
      showFieldErrors(error.errors);
    } else {
      console.error(error);
      showToast(error.message || 'The donation could not be saved.', 'error');
    }
  } finally {
    admin.saveBtn.disabled = false;
  }
}

async function startEdit(id) {
  const records = await DonationStore.getAll();
  const record = records.find(function (item) { return item.id === id; });
  if (!record) {
    showToast('This donation no longer exists.', 'error');
    refreshAll();
    return;
  }

  clearFieldErrors();
  admin.editingId.value = record.id;
  admin.nameInput.value = record.name;
  admin.amountInput.value = String(record.amount);
  admin.dateInput.value = record.date;
  ensureYearOption(admin.yearSelect, record.year);
  admin.yearSelect.value = String(record.year);

  admin.formTitle.textContent = 'Edit donation';
  admin.saveBtn.textContent = 'Update donation';
  admin.cancelEditBtn.hidden = false;
  admin.formPanel.classList.add('is-editing');

  await renderRecords(); // highlights the row being edited
  admin.formPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  admin.nameInput.focus({ preventScroll: true });
}

function resetForm() {
  admin.form.reset();
  admin.editingId.value = '';
  admin.formTitle.textContent = 'Add donation';
  admin.saveBtn.textContent = 'Add donation';
  admin.cancelEditBtn.hidden = true;
  admin.formPanel.classList.remove('is-editing');
  admin.dateInput.value = todayISO();
  ensureYearOption(admin.yearSelect, new Date().getFullYear());
  admin.yearSelect.value = String(new Date().getFullYear());
  clearFieldErrors();
}

/* --------------------------------------------------------------------------
   DELETE, RESET, EXPORT
   -------------------------------------------------------------------------- */
async function handleDelete(id) {
  const records = await DonationStore.getAll();
  const record = records.find(function (item) { return item.id === id; });
  if (!record) {
    refreshAll();
    return;
  }

  const ok = window.confirm(
    'Delete this donation?\n\n' + record.name + ' – ' + formatINR(record.amount) + ' on ' + formatDate(record.date) +
    '\n\nThis cannot be undone.'
  );
  if (!ok) return;

  try {
    await DonationStore.remove(id);
    if (admin.editingId.value === id) resetForm();
    showToast('Donation deleted', 'success');
    await refreshAll();
  } catch (error) {
    showToast(error.message, 'error');
    refreshAll();
  }
}

async function handleResetSample() {
  if (!window.confirm('Replace ALL current records with the sample data? Your own records will be lost.')) return;
  try {
    await DonationStore.resetToSample();
    admin.filterYear.value = '';
    resetForm();
    await refreshAll();
    showToast('Sample data loaded', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleClearAll() {
  if (!window.confirm('Delete ALL donation records from this browser? This cannot be undone.')) return;
  try {
    await DonationStore.clearAll();
    resetForm();
    await refreshAll();
    showToast('All records deleted', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleExport() {
  try {
    const records = await getFilteredRecords();
    if (!records.length) {
      showToast('There are no records to download.', 'error');
      return;
    }
    const year = admin.filterYear.value;
    const filename = 'chhath-puja-donations-' + (year === 'all' ? 'all-years' : year) + '.csv';
    downloadCSV(filename, donationsToCSV(records));
    showToast('Downloaded ' + records.length + ' records', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

/* --------------------------------------------------------------------------
   FIELD ERROR HELPERS
   -------------------------------------------------------------------------- */
function setFieldError(key, message) {
  const field = admin.fields[key];
  if (!field) return;
  field.error.textContent = message;
  field.input.classList.toggle('is-invalid', Boolean(message));
  field.input.setAttribute('aria-invalid', message ? 'true' : 'false');
}

function showFieldErrors(errors) {
  let first = null;
  Object.keys(errors).forEach(function (key) {
    setFieldError(key, errors[key]);
    if (!first && admin.fields[key]) first = admin.fields[key].input;
  });
  if (first) first.focus();
}

function clearFieldErrors() {
  Object.keys(admin.fields).forEach(function (key) { setFieldError(key, ''); });
}
