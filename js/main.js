/* ==========================================================================
   main.js — loaded on EVERY page, before donation.js / admin.js

   Contents
   1. Site settings (change your village name here)
   2. Donation data (edit the list here)
   3. DonationStore — the data layer (LocalStorage today, backend later)
   4. Validation
   5. Helpers (₹ formatting, dates, CSV, toast messages)
   6. Shared page behaviour (navigation, footer, gallery, home stats)
   ========================================================================== */

'use strict';

/* --------------------------------------------------------------------------
   1. SITE SETTINGS
   Change these values once and every page updates automatically.
   Any element with data-config="villageName" (etc.) is filled in on load.
   -------------------------------------------------------------------------- */
const SITE_CONFIG = {
  villageName: 'श्रीपुर परसा',
  samitiName: 'श्री छठ पूजा समिति, श्रीपुर परसा',
  ghatName: 'श्रीपुर परसा घाट',
  district: 'समस्तीपुर, बिहार'
};

/* --------------------------------------------------------------------------
   2. DONATION DATA — Shreepur Parsa Chhath Puja 2025

   HOW TO UPDATE: edit this list (names, amounts, dates), save the file and
   refresh the browser. The website picks up the changes automatically.
   Donations added through the Admin panel are kept.

   Each line is: ['Donor name', amount, date]
   Dates are written as YYYY-MM-DD and shown on the site as DD-MM-YYYY.
   The year is taken from the date (2025-10-27 → Chhath Puja 2025).
   -------------------------------------------------------------------------- */
const COLLECTION_DATE = '2025-10-27'; // change if collected on another day (YYYY-MM-DD)

const SAMPLE_DONATIONS = [
  // ---------- Chhath Puja 2026 — 4 donations, total ₹1,217 ----------
  ["ओम प्रकाश", 234, "2026-11-09"],
  ["मुकेश कुमार", 407, "2026-11-09"],
  ["मोहन मिश्रा", 255, "2026-11-09"],
  ["राम", 321, "2026-11-09"],

  // ---------- Chhath Puja 2025 — 74 donations, total ₹13,677 ----------
  ["दिनेश मंडल", 200, "2025-10-27"],
  ["संतोष मंडल", 200, "2025-10-27"],
  ["दयानंद मंडल", 200, "2025-10-27"],
  ["राजा राम मंडल", 100, "2025-10-27"],
  ["गुले मंडल", 200, "2025-10-27"],
  ["मानिक (सुशील) मंडल", 251, "2025-10-27"],
  ["शंकर मंडल", 202, "2025-10-27"],
  ["राम बाबु (मसरायी वाले)", 200, "2025-10-27"],
  ["शिवनंदन मंडल", 200, "2025-10-27"],
  ["शिवजी मंडल", 200, "2025-10-27"],
  ["मुकेश (मुसो) मंडल", 150, "2025-10-27"],
  ["राजो मंडल", 200, "2025-10-27"],
  ["पाँचू मंडल", 100, "2025-10-27"],
  ["कैलाश मंडल", 200, "2025-10-27"],
  ["शिव कुमार", 200, "2025-10-27"],
  ["कन्हैया कुमार", 200, "2025-10-27"],
  ["गौतम गोस्वामी", 200, "2025-10-27"],
  ["सीता राम यादव", 200, "2025-10-27"],
  ["सियाराम यादव", 200, "2025-10-27"],
  ["नवीन यादव", 200, "2025-10-27"],
  ["चलितर यादव", 200, "2025-10-27"],
  ["राजा यादव", 200, "2025-10-27"],
  ["अनिकेत यादव", 200, "2025-10-27"],
  ["शिवपूजन यादव", 200, "2025-10-27"],
  ["दिगम्बर यादव", 200, "2025-10-27"],
  ["प्रदीप यादव", 200, "2025-10-27"],
  ["मणिशंकर यादव", 400, "2025-10-27"],
  ["राज कुमार (हैलू) यादव", 200, "2025-10-27"],
  ["कल्याण सिंह", 200, "2025-10-27"],
  ["M. सिंह", 100, "2025-10-27"],
  ["शंकर मंडल", 201, "2025-10-27"],
  ["विनोद मंडल", 200, "2025-10-27"],
  ["दिलीप यादव", 200, "2025-10-27"],
  ["गंगा यादव", 200, "2025-10-27"],
  ["सुरेश यादव", 200, "2025-10-27"],
  ["उमेश यादव", 200, "2025-10-27"],
  ["हर किशन सिंह", 200, "2025-10-27"],
  ["हरि किशुन (रोहित)", 200, "2025-10-27"],
  ["देवनारायण मंडल", 200, "2025-10-27"],
  ["राजिन्दर मंडल", 200, "2025-10-27"],
  ["अंकुश (रंजीत) कुमार", 100, "2025-10-27"],
  ["दुर्गा मंडल", 100, "2025-10-27"],
  ["बिट्टू मंडल", 200, "2025-10-27"],
  ["अरविंद मंडल", 221, "2025-10-27"],
  ["विरेन्द्र मंडल", 205, "2025-10-27"],
  ["नेता जी", 200, "2025-10-27"],
  ["ननवीर मंडल", 200, "2025-10-27"],
  ["मिथिलेश मंडल", 50, "2025-10-27"],
  ["अशोक (बनचूहा) मंडल", 200, "2025-10-27"],
  ["ललन मंडल", 200, "2025-10-27"],
  ["दीपक कुमार", 151, "2025-10-27"],
  ["राम नरायण मंडल", 100, "2025-10-27"],
  ["सीता राम मंडल", 100, "2025-10-27"],
  ["राम चंदर (मुकेश)", 200, "2025-10-27"],
  ["गोपाल मंडल (जगदीश)", 201, "2025-10-27"],
  ["नटवर मंडल", 200, "2025-10-27"],
  ["दिनेश मंडल", 200, "2025-10-27"],
  ["राम बहादुर मंडल", 200, "2025-10-27"],
  ["त्रिवेणी मंडल", 200, "2025-10-27"],
  ["भोला मंडल", 200, "2025-10-27"],
  ["राम नारायण मंडल", 200, "2025-10-27"],
  ["महेश मंडल (बिट्टू जी)", 200, "2025-10-27"],
  ["अर्जुन मंडल", 200, "2025-10-27"],
  ["मुन्ना मंडल", 90, "2025-10-27"],
  ["लालो मंडल", 200, "2025-10-27"],
  ["राम वचन मंडल", 150, "2025-10-27"],
  ["पुनीत मंडल", 200, "2025-10-27"],
  ["बैजनाथ मंडल", 200, "2025-10-27"],
  ["गोपाल मंडल", 200, "2025-10-27"],
  ["देवू मंडल (गौरीशंकर)", 200, "2025-10-27"],
  ["नागेन्द्र मंडल", 200, "2025-10-27"],
  ["अरुण मंडल", 150, "2025-10-27"],
  ["राम पुनित", 100, "2025-10-27"],
  ["राजदीप मंडल", 55, "2025-10-27"],

  // ---------- Chhath Puja 2024 — 54 donations, total ₹10,181 ----------
  ["गौतम गोस्वामी", 200, "2024-10-22"],
  ["दिनेश मंडल", 200, "2024-10-12"],
  ["पोश्रम मंडल", 200, "2024-10-12"],
  ["संतोष मंडल", 200, "2024-10-12"],
  ["गुले मंडल", 200, "2024-10-12"],
  ["राजा राम मंडल", 100, "2024-10-12"],
  ["सुशील मंडल", 251, "2024-10-12"],
  ["मजरहिया वली", 202, "2024-10-12"],
  ["शंकर मंडल", 200, "2024-10-12"],
  ["गजो मंडल", 200, "2024-10-12"],
  ["मुसो मंडल", 150, "2024-10-12"],
  ["शिवजी मंडल", 200, "2024-10-12"],
  ["शिवनंदन मंडल", 200, "2024-10-12"],
  ["कन्हैया कुमार", 200, "2024-10-12"],
  ["कैलाश मंडल", 200, "2024-10-12"],
  ["पाँचू मंडल", 100, "2024-10-12"],
  ["शिव कुमार", 200, "2024-10-12"],
  ["गौतम गोस्वामी", 200, "2024-10-12"],
  ["सीता राम यादव", 200, "2024-10-12"],
  ["चलितर यादव", 200, "2024-10-12"],
  ["नवीन यादव", 200, "2024-10-12"],
  ["राजा यादव", 200, "2024-10-12"],
  ["सिया राम यादव", 200, "2024-10-12"],
  ["अनिकेत यादव", 200, "2024-10-12"],
  ["दिगंबेर यादव", 200, "2024-10-12"],
  ["प्रदीप यादव", 200, "2024-10-12"],
  ["मणिशंकर यादव", 400, "2024-10-12"],
  ["शिवपूजन यादव", 200, "2024-10-12"],
  ["M सिंह", 100, "2024-10-12"],
  ["कल्याण यादव", 200, "2024-10-12"],
  ["कैलू यादव", 200, "2024-10-12"],
  ["बिनोद मंडल", 200, "2024-10-12"],
  ["शंकर मंडल", 201, "2024-10-12"],
  ["उमेश यादव", 200, "2024-10-12"],
  ["गंगा यादव", 200, "2024-10-12"],
  ["दिलीप यादव", 200, "2024-10-12"],
  ["सुरेश यादव", 200, "2024-10-12"],
  ["हर किशन सिंह", 200, "2024-10-12"],
  ["हरि किशुन मंडल", 200, "2024-10-12"],
  ["अंकुश कुमार", 100, "2024-10-12"],
  ["दुर्गा मंडल", 100, "2024-10-12"],
  ["देव नरायण मंडल", 200, "2024-10-12"],
  ["राजिन्दर मंडल", 200, "2024-10-12"],
  ["अरविंद मंडल", 221, "2024-10-12"],
  ["बिट्टू मंडल", 200, "2024-10-12"],
  ["विरेंद्र मंडल", 205, "2024-10-12"],
  ["अशोक मंडल", 200, "2024-10-12"],
  ["ननवीर मंडल", 200, "2024-10-12"],
  ["नेता जी", 200, "2024-10-12"],
  ["मिथ्लेश मंडल", 50, "2024-10-12"],
  ["दीपक कुमार", 201, "2024-10-12"],
  ["ललन मंडल", 200, "2024-10-12"],
  ["राम नरायण मंडल", 100, "2024-10-12"],
  ["सीता राम मंडल", 100, "2024-10-12"],

  // ---------- Chhath Puja 2023 — 65 donations, total ₹10,051 ----------
  ["पोशराम मंडल", 100, "2023-11-17"],
  ["कार्तिक (मजरहिया वली)", 200, "2023-11-17"],
  ["कैलाश प्रसाद सिंह", 120, "2023-11-17"],
  ["शंकर मंडल", 200, "2023-11-17"],
  ["राजो मंडल", 100, "2023-11-17"],
  ["सियाराम यादव", 150, "2023-11-17"],
  ["शिवजी मंडल", 200, "2023-11-17"],
  ["संजीत मंडल", 100, "2023-11-17"],
  ["संतोष जी", 1000, "2023-11-17"],
  ["हरि किशुन (रोहित)", 150, "2023-11-17"],
  ["गोपाल जी", 100, "2023-11-17"],
  ["गणेशी मंडल", 200, "2023-11-17"],
  ["देवु मंडल (भांडीवाले)", 150, "2023-11-17"],
  ["राम नरायण मंडल (मुंशी)", 200, "2023-11-17"],
  ["राम भजन मंडल", 50, "2023-11-17"],
  ["शिवनाथ (अक्लू मंडल)", 200, "2023-11-17"],
  ["गंगा यादव", 150, "2023-11-17"],
  ["झखोरी मंडल", 200, "2023-11-17"],
  ["पलटन मंडल", 150, "2023-11-17"],
  ["प्रियंका (लाल)", 111, "2023-11-17"],
  ["दिलीप यादव", 200, "2023-11-17"],
  ["पक यादव", 200, "2023-11-17"],
  ["राजकुमार यादव", 100, "2023-11-17"],
  ["कन्हैया कुमार", 150, "2023-11-17"],
  ["कल्याण यादव", 200, "2023-11-17"],
  ["नवीन यादव", 150, "2023-11-17"],
  ["बच्चू यादव", 200, "2023-11-17"],
  ["अर्जुन (बुढ़ा मंडल)", 150, "2023-11-17"],
  ["दिगम्बर यादव", 200, "2023-11-17"],
  ["मनोज यादव", 150, "2023-11-17"],
  ["सीता राम यादव", 150, "2023-11-17"],
  ["राम चरित यादव", 50, "2023-11-17"],
  ["लक्ष्मी यादव", 100, "2023-11-17"],
  ["उमेश यादव", 50, "2023-11-17"],
  ["दिपक कुमार (अरुण)", 100, "2023-11-17"],
  ["मानिक लाल", 200, "2023-11-17"],
  ["सुरेश यादव", 100, "2023-11-17"],
  ["दिपक कुमार (पागल बस)", 25, "2023-11-17"],
  ["नटवर मंडल", 100, "2023-11-17"],
  ["रणवीर कुमार (नंदन)", 150, "2023-11-17"],
  ["सीता राम मंडल (वार्ड)", 200, "2023-11-17"],
  ["त्रिवेणी मंडल", 100, "2023-11-17"],
  ["मुन्ना (हरिहर)", 301, "2023-11-17"],
  ["राम बच्चन", 100, "2023-11-17"],
  ["शंभू मंडल", 125, "2023-11-17"],
  ["पाँचू मंडल (जीवछ)", 105, "2023-11-17"],
  ["मारीच मंडल", 121, "2023-11-17"],
  ["मुसो मंडल", 150, "2023-11-17"],
  ["राजाराम यादव", 100, "2023-11-17"],
  ["शिव कुमार", 200, "2023-11-17"],
  ["गौतम गोस्वामी", 101, "2023-11-17"],
  ["पलटन यादव", 100, "2023-11-17"],
  ["प्रमोद यादव", 100, "2023-11-17"],
  ["बिट्टू मंडल", 200, "2023-11-17"],
  ["लालबुन यादव", 100, "2023-11-17"],
  ["कैलाश (लालो मंडल)", 150, "2023-11-17"],
  ["दिनेश मंडल", 100, "2023-11-17"],
  ["नरेश (भोला मंडल)", 101, "2023-11-17"],
  ["नेता जी", 100, "2023-11-17"],
  ["अरविन्द मंडल", 150, "2023-11-17"],
  ["अशोक (नागदेव मंडल)", 100, "2023-11-17"],
  ["लुटन मंडल", 140, "2023-11-17"],
  ["विनोद मंडल (रामविलास)", 200, "2023-11-17"],
  ["शिवनंदन मंडल", 100, "2023-11-17"],
  ["राधेश्याम (राजेन्दर मंडल)", 251, "2023-11-17"]
].map(function ([name, amount, date], index) {
  return {
    id: 'sample-' + (index + 1),
    name: name,
    amount: amount,
    date: date,
    year: Number(date.slice(0, 4)),
    createdAt: date + 'T09:00:00.000Z'
  };
});

/* --------------------------------------------------------------------------
   3. DONATION STORE — the data layer

   Every page talks to donations ONLY through these functions.
   They are "async" on purpose: today they read LocalStorage instantly,
   but later you can replace the inside of each function with a fetch()
   call to your server (PHP, Node.js, Firebase, Supabase …) without
   changing donation.js or admin.js.

   IMPORTANT: LocalStorage lives inside ONE browser on ONE device.
   Donations added on the admin's phone will NOT appear on a visitor's
   phone until a backend database is connected.
   -------------------------------------------------------------------------- */
const STORAGE_KEY = 'chhathPuja.donations.v1';
const CODE_DATA_KEY = 'chhathPuja.codeDataFingerprint';

/**
 * A short "signature" of the list in SAMPLE_DONATIONS (section 2).
 * It changes whenever you edit a name, amount or date in that list,
 * which tells the site to load the new list from the code.
 */
function codeDataFingerprint() {
  const text = JSON.stringify(SAMPLE_DONATIONS.map(function (r) { return [r.name, r.amount, r.date]; }));
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
  }
  return String(hash) + '-' + SAMPLE_DONATIONS.length;
}

const DonationStore = {
  /**
   * Reads the donation list.
   * If the list in the code (SAMPLE_DONATIONS) has changed since last time,
   * the new code list is loaded automatically. Donations added through the
   * admin panel are kept.
   */
  _load: function () {
    let raw;
    let savedFingerprint;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
      savedFingerprint = localStorage.getItem(CODE_DATA_KEY);
    } catch (error) {
      throw new Error('This browser is blocking storage, so donation records cannot be loaded.');
    }

    let saved = [];
    if (raw !== null) {
      try {
        const parsed = JSON.parse(raw);
        saved = Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        console.error('Saved donation data is damaged and could not be read.', error);
      }
    }

    const fingerprint = codeDataFingerprint();
    if (raw === null || savedFingerprint !== fingerprint) {
      // The code list changed: use the new code list + keep admin-panel additions
      // Keep records added in the admin panel, except the ones that are now
      // part of the code list (they were published with "नई main.js डाउनलोड करें").
      const publishedNow = {};
      SAMPLE_DONATIONS.forEach(function (record) {
        const key = record.name + '|' + record.amount + '|' + record.date;
        publishedNow[key] = (publishedNow[key] || 0) + 1;
      });
      saved.forEach(function (record) {
        if (String(record.id).indexOf('sample-') !== 0) return;
        const key = record.name + '|' + record.amount + '|' + record.date;
        if (publishedNow[key]) publishedNow[key]--;
      });
      const addedInAdmin = saved.filter(function (record) {
        if (String(record.id).indexOf('sample-') === 0) return false;
        const key = record.name + '|' + record.amount + '|' + record.date;
        if (publishedNow[key] > 0) { publishedNow[key]--; return false; }
        return true;
      });
      const merged = cloneRecords(SAMPLE_DONATIONS).concat(addedInAdmin);
      this._save(merged);
      try {
        localStorage.setItem(CODE_DATA_KEY, fingerprint);
      } catch (error) {
        // ignore: the list still loads, it just checks again next time
      }
      return merged;
    }

    return saved;
  },

  /** Writes the full list back to LocalStorage. */
  _save: function (list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (error) {
      throw new Error('The record could not be saved. Browser storage may be full or turned off.');
    }
  },

  /** All donations, newest first. */
  getAll: async function () {
    return this._load().sort(sortByDateDesc);
  },

  /** Donations for one year, newest first. */
  getByYear: async function (year) {
    const target = Number(year);
    return this._load()
      .filter(function (record) { return record.year === target; })
      .sort(sortByDateDesc);
  },

  /** List of years that have donations, latest year first. */
  getYears: async function () {
    const years = new Set(this._load().map(function (record) { return record.year; }));
    return Array.from(years).sort(function (a, b) { return b - a; });
  },

  /** Adds a donation. Throws ValidationError if any field is wrong. */
  add: async function (input) {
    const result = validateDonation(input);
    if (!result.valid) throw new ValidationError(result.errors);

    const list = this._load();
    const record = Object.assign({ id: makeId(), createdAt: new Date().toISOString() }, result.value);
    list.push(record);
    this._save(list);
    return record;
  },

  /** Updates an existing donation by id. */
  update: async function (id, input) {
    const result = validateDonation(input);
    if (!result.valid) throw new ValidationError(result.errors);

    const list = this._load();
    const index = list.findIndex(function (record) { return record.id === id; });
    if (index === -1) throw new Error('This donation no longer exists. It may have been deleted in another tab.');

    list[index] = Object.assign({}, list[index], result.value, { updatedAt: new Date().toISOString() });
    this._save(list);
    return list[index];
  },

  /** Deletes a donation by id. */
  remove: async function (id) {
    const list = this._load();
    const remaining = list.filter(function (record) { return record.id !== id; });
    if (remaining.length === list.length) throw new Error('This donation was already deleted.');
    this._save(remaining);
  },

  /** Replaces everything with the sample data (useful while testing). */
  resetToSample: async function () {
    this._save(cloneRecords(SAMPLE_DONATIONS));
  },

  /** Removes every record. */
  clearAll: async function () {
    this._save([]);
  }
};

/** Totals for a list of donations. "Donors" = number of donation entries. */
function summarizeDonations(records) {
  const total = records.reduce(function (sum, record) { return sum + Number(record.amount || 0); }, 0);
  const highest = records.reduce(function (max, record) { return Math.max(max, Number(record.amount || 0)); }, 0);
  return {
    total: Math.round(total * 100) / 100,
    count: records.length,
    highest: highest,
    average: records.length ? total / records.length : 0
  };
}

function sortByDateDesc(a, b) {
  return b.date.localeCompare(a.date) || a.name.localeCompare(b.name);
}

function cloneRecords(records) {
  return JSON.parse(JSON.stringify(records));
}

function makeId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

/* --------------------------------------------------------------------------
   4. VALIDATION
   Returns { valid, errors: { field: message }, value: cleanedRecord }
   -------------------------------------------------------------------------- */
const MAX_DONATION = 10000000; // ₹1,00,00,000 upper safety limit

function ValidationError(errors) {
  this.name = 'ValidationError';
  this.errors = errors;
  this.message = 'Please correct the highlighted fields.';
}
ValidationError.prototype = Object.create(Error.prototype);

function validateDonation(input) {
  const errors = {};

  // Donor name
  const name = String(input.name || '').trim().replace(/\s+/g, ' ');
  if (!name) {
    errors.name = 'Enter the donor’s name.';
  } else if (name.length < 2) {
    errors.name = 'The name must have at least 2 letters.';
  } else if (name.length > 80) {
    errors.name = 'Keep the name under 80 characters.';
  }

  // Amount (commas allowed, e.g. "1,100")
  const amountText = String(input.amount === undefined ? '' : input.amount).replace(/,/g, '').trim();
  const amount = Number(amountText);
  if (!amountText) {
    errors.amount = 'Enter the donation amount.';
  } else if (!Number.isFinite(amount)) {
    errors.amount = 'Use numbers only, for example 1100.';
  } else if (amount <= 0) {
    errors.amount = 'The amount must be more than ₹0.';
  } else if (amount > MAX_DONATION) {
    errors.amount = 'The amount looks too large. Check the number.';
  } else if (!/^\d+(\.\d{1,2})?$/.test(amountText)) {
    errors.amount = 'Use up to 2 decimal places, for example 501 or 250.50.';
  }

  // Date (YYYY-MM-DD from <input type="date">)
  const date = String(input.date || '').trim();
  if (!date) {
    errors.date = 'Select the donation date.';
  } else if (!isValidISODate(date)) {
    errors.date = 'Select a valid date.';
  } else if (date > todayISO()) {
    errors.date = 'The date can’t be in the future.';
  }

  // Year
  const year = Number(input.year);
  if (!input.year) {
    errors.year = 'Select the Chhath Puja year.';
  } else if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    errors.year = 'Select a year between 2000 and 2100.';
  }

  const valid = Object.keys(errors).length === 0;
  return {
    valid: valid,
    errors: errors,
    value: valid ? { name: name, amount: Math.round(amount * 100) / 100, date: date, year: year } : null
  };
}

function isValidISODate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parts = value.split('-').map(Number);
  const check = new Date(parts[0], parts[1] - 1, parts[2]);
  return check.getFullYear() === parts[0] && check.getMonth() === parts[1] - 1 && check.getDate() === parts[2];
}

/* --------------------------------------------------------------------------
   5. HELPERS
   -------------------------------------------------------------------------- */
const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

/** 125000 → "₹1,25,000" (Indian grouping) */
function formatINR(amount) {
  return inrFormatter.format(Number(amount) || 0);
}

/** 125 → "125" with Indian grouping (no ₹) */
function formatCount(number) {
  return new Intl.NumberFormat('en-IN').format(number);
}

/** "2026-11-10" → "10-11-2026" */
function formatDate(isoDate) {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  return parts[2] + '-' + parts[1] + '-' + parts[0];
}

/** Today's date as YYYY-MM-DD in the visitor's local time zone. */
function todayISO() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return now.getFullYear() + '-' + month + '-' + day;
}

/** Makes text safe to put inside innerHTML. */
function escapeHTML(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Builds CSV text from donation records. */
function donationsToCSV(records) {
  const header = ['Donor Name', 'Amount (INR)', 'Donation Date (DD-MM-YYYY)', 'Year'];
  const rows = records.map(function (record) {
    return [record.name, record.amount, formatDate(record.date), record.year];
  });
  const summary = summarizeDonations(records);
  rows.push([]);
  rows.push(['Total Collection', summary.total, '', '']);
  rows.push(['Total Donors', summary.count, '', '']);

  return [header].concat(rows).map(function (row) {
    return row.map(csvCell).join(',');
  }).join('\r\n');
}

/** Quotes a CSV cell and blocks spreadsheet formula injection. */
function csvCell(value) {
  let text = value === undefined || value === null ? '' : String(value);
  if (/^[=+\-@]/.test(text)) text = "'" + text;
  if (/[",\r\n]/.test(text)) text = '"' + text.replace(/"/g, '""') + '"';
  return text;
}

/** Downloads text as a .csv file (with BOM so Excel shows Hindi names correctly). */
function downloadCSV(filename, csvText) {
  const blob = new Blob(['\uFEFF' + csvText], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}

/** Small message at the bottom of the screen. type: 'success' | 'error' | '' */
let toastTimer = null;
function showToast(message, type) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = 'toast is-visible' + (type ? ' is-' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () {
    toast.classList.remove('is-visible');
  }, 3200);
}

/* --------------------------------------------------------------------------
   6. SHARED PAGE BEHAVIOUR
   -------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', function () {
  applySiteConfig();
  setupNavigation();
  setFooterYear();
  setupImageFallbacks();
  setupGalleryLightbox();
  renderHomeStats();
});

/** Fills village / samiti names into elements marked with data-config. */
function applySiteConfig() {
  document.querySelectorAll('[data-config]').forEach(function (element) {
    const key = element.getAttribute('data-config');
    if (SITE_CONFIG[key]) element.textContent = SITE_CONFIG[key];
  });
}

/** Mobile menu toggle + highlight the current page link. */
function setupNavigation() {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('site-nav');
  const currentPage = document.body.getAttribute('data-page');

  document.querySelectorAll('[data-nav]').forEach(function (link) {
    if (link.getAttribute('data-nav') === currentPage) {
      link.setAttribute('aria-current', 'page');
    }
  });

  if (!toggle || !nav) return;

  function setOpen(open) {
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  }

  toggle.addEventListener('click', function () {
    setOpen(toggle.getAttribute('aria-expanded') !== 'true');
  });

  nav.addEventListener('click', function (event) {
    if (event.target.closest('a')) setOpen(false);
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && nav.classList.contains('is-open')) {
      setOpen(false);
      toggle.focus();
    }
  });
}

function setFooterYear() {
  document.querySelectorAll('[data-current-year]').forEach(function (element) {
    element.textContent = new Date().getFullYear();
  });
}

/**
 * If an image file is missing:
 *  - images with data-fallback-src switch to that file (used by the hero)
 *  - images with data-placeholder are replaced by a box that tells you
 *    exactly which file to add (used by the gallery)
 */
function setupImageFallbacks() {
  document.querySelectorAll('img[data-fallback-src], img[data-placeholder]').forEach(function (img) {
    const originalSrc = img.getAttribute('src');

    function handleError() {
      const fallback = img.getAttribute('data-fallback-src');
      if (fallback && img.getAttribute('src') !== fallback) {
        img.setAttribute('src', fallback);
        return;
      }
      if (img.hasAttribute('data-placeholder')) {
        replaceWithPlaceholder(img, originalSrc);
      }
    }

    img.addEventListener('error', handleError);
    // The image may have failed before this script ran
    if (img.complete && img.naturalWidth === 0) handleError();
  });
}

function replaceWithPlaceholder(img, filePath) {
  const figure = img.closest('.gallery-item');
  const button = img.closest('.gallery-open');
  const placeholder = document.createElement('div');
  placeholder.className = 'photo-placeholder';
  placeholder.innerHTML =
    '<strong>' + escapeHTML(img.alt || 'Photo') + '</strong>' +
    '<span>Add your photo as</span>' +
    '<code>' + escapeHTML(filePath) + '</code>';

  if (figure) figure.classList.add('is-empty');
  if (button) {
    button.replaceWith(placeholder);
  } else {
    img.replaceWith(placeholder);
  }
}

/** Opens gallery photos in a larger view. */
function setupGalleryLightbox() {
  const dialog = document.getElementById('lightbox');
  if (!dialog || typeof dialog.showModal !== 'function') return;

  const dialogImage = dialog.querySelector('img');
  const dialogCaption = dialog.querySelector('.lightbox-caption');
  const closeButton = dialog.querySelector('.lightbox-close');

  document.addEventListener('click', function (event) {
    const opener = event.target.closest('.gallery-open');
    if (!opener) return;
    const img = opener.querySelector('img');
    if (!img) return;
    const caption = opener.closest('.gallery-item').querySelector('figcaption');
    dialogImage.src = img.currentSrc || img.src;
    dialogImage.alt = img.alt;
    dialogCaption.textContent = caption ? caption.textContent : img.alt;
    dialog.showModal();
  });

  closeButton.addEventListener('click', function () { dialog.close(); });

  // Click outside the picture closes it
  dialog.addEventListener('click', function (event) {
    if (event.target === dialog) dialog.close();
  });
}

/** Home page: shows this year's (or the latest year's) collection. */
async function renderHomeStats() {
  const box = document.getElementById('homeStats');
  if (!box) return;

  try {
    const years = await DonationStore.getYears();
    if (!years.length) {
      box.hidden = true;
      return;
    }
    const thisYear = new Date().getFullYear();
    const year = years.includes(thisYear) ? thisYear : years[0];
    const summary = summarizeDonations(await DonationStore.getByYear(year));

    box.querySelector('[data-stat="year"]').textContent = year;
    box.querySelector('[data-stat="total"]').textContent = formatINR(summary.total);
    box.querySelector('[data-stat="count"]').textContent = formatCount(summary.count);
    box.querySelector('[data-stat-link]').href = 'donation.html?year=' + year;
  } catch (error) {
    console.error(error);
    box.hidden = true;
  }
}