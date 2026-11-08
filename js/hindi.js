/* ==========================================================================
   hindi.js — Hindi helpers. Load AFTER main.js on donation.html and admin.html

   Contents
   1. Settings
   2. Hindi ⇄ English matching (search works in both scripts)
   3. English → Hindi name conversion
   4. Admin: "type in English, save in Hindi" name box
   5. Admin: import donations from CSV / Excel
   6. Admin: publish for everyone (download an updated main.js)
   7. Start-up
   ========================================================================== */

'use strict';

/* --------------------------------------------------------------------------
   1. SETTINGS
   -------------------------------------------------------------------------- */

// Also ask Google's free Hindi typing service for name suggestions.
// If it is unavailable, the built-in conversion is still used.
const ONLINE_HINDI_SUGGESTIONS = true;

// Excel reader, loaded only when an .xlsx file is chosen
const SHEETJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

/* --------------------------------------------------------------------------
   2. HINDI ⇄ ENGLISH MATCHING
   Both Hindi and English names are turned into a simple sound "key",
   so "dinesh", "Dinesh" and "दिनेश" all match each other.
   -------------------------------------------------------------------------- */
const DEV_CONSONANTS = {
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'n',
  'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'n',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
  'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
  'य': 'y', 'र': 'r', 'ल': 'l', 'ळ': 'l', 'व': 'v',
  'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
  'क़': 'k', 'ख़': 'kh', 'ग़': 'g', 'ज़': 'z', 'ड़': 'r', 'ढ़': 'rh', 'फ़': 'f', 'य़': 'y'
};
const DEV_NUKTA_FORMS = { 'क': 'k', 'ख': 'kh', 'ग': 'g', 'ज': 'z', 'ड': 'r', 'ढ': 'rh', 'फ': 'f', 'य': 'y' };
const DEV_VOWELS = {
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ii', 'उ': 'u', 'ऊ': 'uu', 'ऋ': 'ri',
  'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'ऑ': 'o'
};
const DEV_MATRAS = {
  'ा': 'aa', 'ि': 'i', 'ी': 'ii', 'ु': 'u', 'ू': 'uu', 'ृ': 'ri',
  'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॉ': 'o'
};
const HALANT = '्';
const NUKTA = '़';

function isDevanagari(ch) {
  return ch >= '\u0900' && ch <= '\u097F' && ch !== '।' && ch !== '॥';
}

/** "दिनेश मंडल" → "dinesh mandal" (rough, for matching only) */
function devanagariToLatin(text) {
  const chars = Array.from(String(text || ''));
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];

    if (DEV_CONSONANTS[ch] !== undefined) {
      let latin = DEV_CONSONANTS[ch];
      if (chars[i + 1] === NUKTA) {
        latin = DEV_NUKTA_FORMS[ch] || latin;
        i++;
      }
      out += latin;
      const next = chars[i + 1];
      if (next === HALANT) { i++; continue; }
      if (next !== undefined && DEV_MATRAS[next] !== undefined) { out += DEV_MATRAS[next]; i++; continue; }
      // The hidden "a" sound is not spoken at the end of a word
      if (next !== undefined && isDevanagari(next)) out += 'a';
      continue;
    }
    if (DEV_VOWELS[ch] !== undefined) { out += DEV_VOWELS[ch]; continue; }
    if (ch === 'ं' || ch === 'ँ') { out += 'n'; continue; }
    if (ch === 'ः') { out += 'h'; continue; }
    if (ch === HALANT || ch === NUKTA) continue;
    out += isDevanagari(ch) ? '' : ch.toLowerCase();
  }
  return out;
}

/**
 * Sound key used for matching. Removes differences that do not matter
 * when people type names in English: aa/a, ee/i, sh/s, w/v, double letters…
 */
function soundKey(word, keepFinalA) {
  let s = /[\u0900-\u097F]/.test(word) ? devanagariToLatin(word) : String(word || '');
  s = s.toLowerCase().replace(/[^a-z]/g, '');
  s = s.replace(/x/g, 'ks').replace(/q/g, 'k').replace(/w/g, 'v').replace(/z/g, 'j').replace(/ph/g, 'f')
    .replace(/ee/g, 'i').replace(/ii/g, 'i').replace(/oo/g, 'u').replace(/uu/g, 'u').replace(/aa/g, 'a')
    .replace(/ng/g, 'n');
  // bh→b, dh→d, sh→s, chh→c … (run twice for chh)
  s = s.replace(/([bcdgjklmnprstvy])h/g, '$1').replace(/([bcdgjklmnprstvy])h/g, '$1');
  s = s.replace(/(.)\1+/g, '$1');
  return keepFinalA ? s.replace(/a(?!$)/g, '') : s.replace(/a/g, '');
}

function splitWords(text) {
  return String(text || '').split(/[\s().,\-\/]+/).filter(Boolean);
}

/**
 * Does this donor name match what was typed in the search box?
 * Works for Hindi and English: "dinesh", "दिनेश", "mandal", "din man" …
 */
function nameMatches(name, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  const fullName = String(name || '');
  if (fullName.toLowerCase().includes(q)) return true;

  const nameKeys = splitWords(fullName).map(function (w) { return soundKey(w, false); });
  const joinedKey = soundKey(fullName, false);

  return splitWords(q).every(function (word) {
    const key = soundKey(word, false);
    if (!key) return true;
    return nameKeys.some(function (nk) { return nk.indexOf(key) === 0; }) ||
      (key.length >= 3 && joinedKey.indexOf(key) !== -1);
  });
}

/* --------------------------------------------------------------------------
   3. ENGLISH → HINDI NAME CONVERSION
   Order of preference for each word:
   a) the spelling already used in your donation records
   b) the built-in list of common names below
   c) letter-by-letter conversion
   -------------------------------------------------------------------------- */
const COMMON_HINDI_WORDS = {
  // titles
  dr: 'डॉ', shri: 'श्री', sri: 'श्री', shree: 'श्री', smt: 'श्रीमती', ji: 'जी', babu: 'बाबू', jee: 'जी',
  // surnames
  mandal: 'मंडल', yadav: 'यादव', singh: 'सिंह', kumar: 'कुमार', kumari: 'कुमारी', devi: 'देवी',
  prasad: 'प्रसाद', sharma: 'शर्मा', mishra: 'मिश्रा', gupta: 'गुप्ता', paswan: 'पासवान', sah: 'साह',
  shah: 'शाह', thakur: 'ठाकुर', chaudhary: 'चौधरी', choudhary: 'चौधरी', tiwari: 'तिवारी', pandey: 'पांडेय',
  jha: 'झा', verma: 'वर्मा', sinha: 'सिन्हा', rai: 'राय', ray: 'राय', das: 'दास', mahto: 'महतो',
  manjhi: 'मांझी', goswami: 'गोस्वामी', rajak: 'रजक', lal: 'लाल', nath: 'नाथ', ram: 'राम', raj: 'राज',
  mehta: 'मेहता', pathak: 'पाठक', dubey: 'दुबे', ojha: 'ओझा', kushwaha: 'कुशवाहा', mahato: 'महतो',
  // first names
  shyam: 'श्याम', sita: 'सीता', geeta: 'गीता', gita: 'गीता', sunita: 'सुनीता', anita: 'अनीता',
  rekha: 'रेखा', pooja: 'पूजा', puja: 'पूजा', neha: 'नेहा', kavita: 'कविता', lalita: 'ललिता',
  anjali: 'अंजलि', arvind: 'अरविंद', ashok: 'अशोक', dinesh: 'दिनेश', suresh: 'सुरेश', ramesh: 'रमेश',
  mahesh: 'महेश', mukesh: 'मुकेश', rajesh: 'राजेश', umesh: 'उमेश', ganesh: 'गणेश', naresh: 'नरेश',
  santosh: 'संतोष', sanjay: 'संजय', ajay: 'अजय', vijay: 'विजय', manoj: 'मनोज', pankaj: 'पंकज',
  deepak: 'दीपक', dipak: 'दीपक', pradeep: 'प्रदीप', pradip: 'प्रदीप', sandeep: 'संदीप', kuldeep: 'कुलदीप',
  rakesh: 'राकेश', raju: 'राजू', bittu: 'बिट्टू', munna: 'मुन्ना', pappu: 'पप्पू', guddu: 'गुड्डू',
  sonu: 'सोनू', monu: 'मोनू', golu: 'गोलू', aniket: 'अनिकेत', gautam: 'गौतम', digambar: 'दिगंबर',
  shivpujan: 'शिवपूजन', kanhaiya: 'कन्हैया', shiv: 'शिव', shankar: 'शंकर', krishna: 'कृष्ण',
  mohan: 'मोहन', sohan: 'सोहन', rohit: 'रोहित', mohit: 'मोहित', amit: 'अमित', sumit: 'सुमित',
  rahul: 'राहुल', ravi: 'रवि', rajan: 'राजन', rajendra: 'राजेंद्र', rajendar: 'राजेंदर',
  virendra: 'विरेंद्र', birendra: 'बिरेंद्र', surendra: 'सुरेंद्र', narendra: 'नरेंद्र', devendra: 'देवेंद्र',
  nagendra: 'नागेंद्र', upendra: 'उपेंद्र', jitendra: 'जितेंद्र', dharmendra: 'धर्मेंद्र', yogendra: 'योगेंद्र',
  gopal: 'गोपाल', natwar: 'नटवर', kailash: 'कैलाश', triveni: 'त्रिवेणी', bhola: 'भोला', arjun: 'अर्जुन',
  baijnath: 'बैजनाथ', punit: 'पुनीत', sunil: 'सुनील', arun: 'अरुण', rajdeep: 'राजदीप', pramod: 'प्रमोद',
  vinod: 'विनोद', dilip: 'दिलीप', ganga: 'गंगा', mithilesh: 'मिथिलेश', lalan: 'ललन', kalyan: 'कल्याण',
  devnarayan: 'देवनारायण', narayan: 'नारायण', durga: 'दुर्गा', neta: 'नेता', naveen: 'नवीन', navin: 'नवीन',
  siyaram: 'सियाराम', sitaram: 'सीताराम', dayanand: 'दयानंद', rajaram: 'राजाराम', manik: 'मानिक',
  shivnandan: 'शिवनंदन', shivji: 'शिवजी', panchu: 'पाँचू', raja: 'राजा', rajkumar: 'राजकुमार',
  ramchandra: 'रामचंद्र', bahadur: 'बहादुर', ramnarayan: 'रामनारायण', vachan: 'वचन', bachan: 'बचन',
  ankush: 'अंकुश', ranjit: 'रंजीत', sushil: 'सुशील', gaurishankar: 'गौरीशंकर', manishankar: 'मणिशंकर',
  sikandar: 'सिकंदर', lakshmi: 'लक्ष्मी', laxmi: 'लक्ष्मी', saraswati: 'सरस्वती', parvati: 'पार्वती',
  radha: 'राधा', usha: 'उषा', asha: 'आशा', nisha: 'निशा', priya: 'प्रिया', priyanka: 'प्रियंका',
  vikas: 'विकास', vikash: 'विकाश', akash: 'आकाश', prakash: 'प्रकाश', subhash: 'सुभाष', anil: 'अनिल',
  sudhir: 'सुधीर', satish: 'सतीश', manish: 'मनीष', nitish: 'नीतीश', ashish: 'आशीष', abhishek: 'अभिषेक',
  aditya: 'आदित्य', ankit: 'अंकित', rohan: 'रोहन', sachin: 'सचिन', saurabh: 'सौरभ', gaurav: 'गौरव',
  vishal: 'विशाल', vivek: 'विवेक', ritesh: 'रितेश', hitesh: 'हितेश', kamlesh: 'कमलेश', brajesh: 'ब्रजेश',
  awadhesh: 'अवधेश', shailesh: 'शैलेश', yogesh: 'योगेश', kundan: 'कुंदन', chandan: 'चंदन', nandan: 'नंदन',
  mantu: 'मंटू', pintu: 'पिंटू', chhotu: 'छोटू', lallu: 'लल्लू', ramu: 'रामू', shambhu: 'शंभू',
  bhagwan: 'भगवान', bhagwati: 'भगवती', jagdish: 'जगदीश', harendra: 'हरेंद्र', mithun: 'मिथुन',
  kishore: 'किशोर', kishor: 'किशोर', nand: 'नंद', kishun: 'किशुन', hari: 'हरि', mukund: 'मुकुंद',
  deo: 'देव', dev: 'देव', chandra: 'चंद्र', prem: 'प्रेम', om: 'ओम', jai: 'जय', jay: 'जय',
  rambabu: 'रामबाबू', harish: 'हरीश', girish: 'गिरीश', ramji: 'रामजी', ramdev: 'रामदेव', shivshankar: 'शिवशंकर'
};

const ROMAN_CONSONANTS = [
  ['ksh', 'क्ष'], ['chh', 'छ'],
  ['kh', 'ख'], ['gh', 'घ'], ['ch', 'च'], ['jh', 'झ'], ['th', 'थ'], ['dh', 'ध'], ['ph', 'फ'], ['bh', 'भ'], ['sh', 'श'],
  ['k', 'क'], ['g', 'ग'], ['c', 'क'], ['j', 'ज'], ['t', 'त'], ['d', 'द'], ['n', 'न'], ['p', 'प'], ['f', 'फ़'],
  ['b', 'ब'], ['m', 'म'], ['y', 'य'], ['r', 'र'], ['l', 'ल'], ['v', 'व'], ['w', 'व'], ['s', 'स'], ['h', 'ह'],
  ['z', 'ज़'], ['q', 'क'], ['x', 'क्स']
];
const ROMAN_VOWELS = [
  // [english, as a separate letter, as a matra]
  ['aa', 'आ', 'ा'], ['ai', 'ऐ', 'ै'], ['au', 'औ', 'ौ'], ['ee', 'ई', 'ी'], ['ii', 'ई', 'ी'],
  ['oo', 'ऊ', 'ू'], ['uu', 'ऊ', 'ू'], ['a', 'अ', ''], ['i', 'इ', 'ि'], ['u', 'उ', 'ु'], ['e', 'ए', 'े'], ['o', 'ओ', 'ो']
];
const FINAL_MATRA = { a: 'ा', i: 'ी', u: 'ू' };   // "sita" → सीता, "devi" → देवी, "raju" → राजू

/** Letter-by-letter conversion, used when a word is not known. */
function romanWordToHindi(word) {
  const s = String(word).toLowerCase().replace(/[^a-z]/g, '');
  const tokens = [];
  let i = 0;
  while (i < s.length) {
    const vowel = ROMAN_VOWELS.find(function (v) { return s.startsWith(v[0], i); });
    if (vowel) {
      tokens.push({ type: 'V', latin: vowel[0], letter: vowel[1], matra: vowel[2] });
      i += vowel[0].length;
      continue;
    }
    const cons = ROMAN_CONSONANTS.find(function (c) { return s.startsWith(c[0], i); });
    tokens.push({ type: 'C', latin: cons[0], letter: cons[1] });
    i += cons[0].length;
  }

  let out = '';
  for (let k = 0; k < tokens.length; k++) {
    const token = tokens[k];
    const next = tokens[k + 1];

    if (token.type === 'V') { out += token.letter; continue; }

    if (next && next.type === 'V') {
      const isLast = k + 1 === tokens.length - 1;
      const matra = isLast && FINAL_MATRA[next.latin] ? FINAL_MATRA[next.latin] : next.matra;
      out += token.letter + matra;
      k++;
      continue;
    }

    if (next && next.type === 'C') {
      const nasal = token.latin === 'n' || token.latin === 'm';
      if (nasal && ['h', 'y', 'r', 'l', 'v', 'w', 'n', 'm'].indexOf(next.latin) === -1) {
        out += 'ं';                                   // "santosh" → संतोष
      } else if (['r', 'y', 'v', 'w', 'l'].indexOf(next.latin) !== -1 ||
                 next.latin === token.latin || (nasal && next.latin === 'h')) {
        out += token.letter + HALANT;                  // "pradeep" → प्रदीप, "kanhaiya" → कन्हैया
      } else {
        out += token.letter;
      }
      continue;
    }

    out += token.letter;                               // last letter of the word
  }
  return out;
}

/** Builds a lookup of Hindi words already used in the donation records. */
function buildHindiWordIndex(records) {
  const index = {};
  records.forEach(function (record) {
    splitWords(record.name).forEach(function (word) {
      if (!/[\u0900-\u097F]/.test(word)) return;
      const key = soundKey(word, true);
      if (!key) return;
      index[key] = index[key] || {};
      index[key][word] = (index[key][word] || 0) + 1;
    });
  });
  return index;
}

const COMMON_WORDS_BY_KEY = (function () {
  const map = {};
  Object.keys(COMMON_HINDI_WORDS).forEach(function (english) {
    const key = soundKey(english, true);
    if (!map[key]) map[key] = COMMON_HINDI_WORDS[english];
  });
  return map;
})();

function englishWordToHindi(word, index) {
  if (!/[a-z]/i.test(word)) return word;
  const lower = word.toLowerCase().replace(/[^a-z]/g, '');

  // Single letters / initials like "M." stay as they are
  if (lower.length === 1) return word.toUpperCase();

  const key = soundKey(lower, true);
  if (index && index[key]) {
    const spellings = index[key];
    return Object.keys(spellings).sort(function (a, b) { return spellings[b] - spellings[a]; })[0];
  }
  if (COMMON_HINDI_WORDS[lower]) return COMMON_HINDI_WORDS[lower];
  if (COMMON_WORDS_BY_KEY[key]) return COMMON_WORDS_BY_KEY[key];
  return romanWordToHindi(lower);
}

/** "Dinesh Mandal" → "दिनेश मंडल". Hindi text is left unchanged. */
function englishNameToHindi(name, index) {
  return String(name || '').split(/(\s+|[(),\-\/])/).map(function (part) {
    if (!part || /^(\s+|[(),\-\/])$/.test(part)) return part;
    return englishWordToHindi(part, index);
  }).join('').replace(/\s+/g, ' ').trim();
}

/** Optional: suggestions from Google's Hindi typing service. Returns [] if unavailable. */
async function fetchOnlineHindi(text) {
  if (!ONLINE_HINDI_SUGGESTIONS || !/[a-z]/i.test(text) || typeof fetch !== 'function') return [];
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(function () { controller.abort(); }, 2500) : null;
  try {
    const url = 'https://inputtools.google.com/request?itc=hi-t-i0-und&num=5&cp=0&cs=1&ie=utf-8&oe=utf-8&text=' +
      encodeURIComponent(text);
    const response = await fetch(url, controller ? { signal: controller.signal } : undefined);
    const data = await response.json();
    if (!Array.isArray(data) || data[0] !== 'SUCCESS' || !data[1] || !data[1][0]) return [];
    return (data[1][0][1] || []).filter(function (s) { return typeof s === 'string'; });
  } catch (error) {
    return [];
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/* --------------------------------------------------------------------------
   4. ADMIN: TYPE IN ENGLISH, SAVE IN HINDI
   Adds an "English" box above the Hindi name box in the admin form.
   -------------------------------------------------------------------------- */
function setupEnglishNameBox() {
  const hindiInput = document.getElementById('donorName');
  const form = document.getElementById('donationForm');
  if (!hindiInput || !form || document.getElementById('donorNameEnglish')) return;

  const hindiField = hindiInput.closest('.field');
  const hindiLabel = hindiField.querySelector('label');
  hindiLabel.textContent = 'नाम हिंदी में (यही सेव होगा)';
  hindiInput.setAttribute('lang', 'hi');

  const englishField = document.createElement('div');
  englishField.className = 'field';
  englishField.innerHTML =
    '<label for="donorNameEnglish">नाम English में लिखें</label>' +
    '<input id="donorNameEnglish" type="text" autocomplete="off" spellcheck="false" placeholder="e.g. Dinesh Mandal">' +
    '<span class="field-hint">हिंदी नाम नीचे अपने-आप भर जाएगा। ग़लत हो तो सुझाव चुनें या ठीक कर दें।</span>';
  hindiField.parentNode.insertBefore(englishField, hindiField);

  const englishInput = document.getElementById('donorNameEnglish');
  const chips = document.createElement('div');
  chips.className = 'hindi-suggestions';
  chips.setAttribute('aria-label', 'हिंदी नाम के सुझाव');
  hindiInput.insertAdjacentElement('afterend', chips);

  let lastAutoValue = '';
  let timer = null;
  let requestNumber = 0;

  function setHindi(value) {
    hindiInput.value = value;
    lastAutoValue = value;
    hindiInput.dispatchEvent(new Event('input', { bubbles: true })); // clears old error message
  }

  function showChips(list) {
    const unique = list.filter(function (item, position) { return item && list.indexOf(item) === position; });
    chips.innerHTML = unique.length > 1 || (unique.length === 1 && unique[0] !== hindiInput.value)
      ? unique.map(function (item) {
          return '<button type="button" class="hindi-chip" lang="hi">' + escapeHTML(item) + '</button>';
        }).join('')
      : '';
  }

  function convertNow() {
    const text = englishInput.value.trim();
    if (!text) return '';
    return englishNameToHindi(text, buildHindiWordIndex(DonationStore._load()));
  }

  async function update() {
    const text = englishInput.value.trim();
    const number = ++requestNumber;
    if (!text) {
      chips.innerHTML = '';
      if (hindiInput.value === lastAutoValue) setHindi('');
      return;
    }
    const local = convertNow();
    if (!hindiInput.value || hindiInput.value === lastAutoValue) setHindi(local);
    showChips([local]);

    const online = await fetchOnlineHindi(text);
    if (number !== requestNumber) return;           // the admin kept typing
    showChips([local].concat(online.slice(0, 4)));
  }

  englishInput.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(update, 250);
  });

  chips.addEventListener('click', function (event) {
    const chip = event.target.closest('.hindi-chip');
    if (!chip) return;
    setHindi(chip.textContent);
    hindiInput.focus();
  });

  // If "Add" is pressed before the Hindi name appeared, convert first
  form.addEventListener('submit', function () {
    clearTimeout(timer);
    if (englishInput.value.trim() && (!hindiInput.value.trim() || hindiInput.value === lastAutoValue)) {
      hindiInput.value = convertNow();
    }
  }, true);

  form.addEventListener('reset', function () {
    lastAutoValue = '';
    chips.innerHTML = '';
  });
}

/* --------------------------------------------------------------------------
   5. ADMIN: IMPORT FROM CSV / EXCEL
   -------------------------------------------------------------------------- */
const IMPORT_HEADERS = {
  name: ['name', 'naam', 'donor', 'नाम', 'दानदाता'],
  amount: ['amount', 'rupee', 'rs', 'inr', '₹', 'राशि', 'रकम', 'रुपय', 'रुपए'],
  date: ['date', 'तारीख', 'तिथि', 'दिनांक'],
  year: ['year', 'वर्ष', 'साल']
};

let importRows = [];

function buildToolsPanel() {
  const bar = document.querySelector('#dashboard .admin-bar');
  if (!bar || document.getElementById('toolsPanel')) return;

  const panel = document.createElement('section');
  panel.className = 'panel tools-panel';
  panel.id = 'toolsPanel';
  panel.setAttribute('lang', 'hi');
  panel.innerHTML =
    '<div class="tools-grid">' +
      '<div>' +
        '<h2>Excel / CSV से एक साथ जोड़ें</h2>' +
        '<p class="field-hint">फ़ाइल में ये कॉलम हों: <strong>नाम (Name)</strong>, <strong>राशि (Amount)</strong>, ' +
        '<strong>तारीख (Date)</strong>। वर्ष (Year) कॉलम ज़रूरी नहीं है। पहली पंक्ति में कॉलम के नाम हों।</p>' +
        '<div class="field">' +
          '<label for="importFile">फ़ाइल चुनें (.csv या .xlsx)</label>' +
          '<input id="importFile" type="file" accept=".csv,.xlsx,.xls,text/csv">' +
        '</div>' +
        '<div class="field-row">' +
          '<div class="field">' +
            '<label for="importDefaultDate">जिन पंक्तियों में तारीख नहीं है, उनकी तारीख</label>' +
            '<input id="importDefaultDate" type="date">' +
          '</div>' +
          '<div class="field check-field">' +
            '<label><input id="importToHindi" type="checkbox" checked> English नाम हिंदी में बदलें</label>' +
          '</div>' +
        '</div>' +
        '<button class="btn btn-outline btn-small" id="templateBtn" type="button">नमूना फ़ाइल डाउनलोड करें</button>' +
      '</div>' +
      '<div class="publish-box">' +
        '<h2>सबको दिखाने के लिए प्रकाशित करें</h2>' +
        '<p class="field-hint">Admin पैनल में जोड़े गए नाम अभी सिर्फ़ इसी ब्राउज़र में हैं। सबको दिखाने के लिए:</p>' +
        '<ol class="publish-steps">' +
          '<li>नीचे के बटन से नई <code>main.js</code> डाउनलोड करें।</li>' +
          '<li>उसे वेबसाइट फ़ोल्डर के <code>js</code> फ़ोल्डर में पुरानी <code>main.js</code> की जगह रखें।</li>' +
          '<li>zip बनाकर Netlify पर अपलोड करें।</li>' +
        '</ol>' +
        '<button class="btn btn-primary" id="publishBtn" type="button">नई main.js डाउनलोड करें</button>' +
      '</div>' +
    '</div>' +
    '<div class="import-preview" id="importPreview" hidden>' +
      '<div class="table-caption-row">' +
        '<h2>फ़ाइल की जाँच</h2>' +
        '<span class="result-count" id="importSummary"></span>' +
      '</div>' +
      '<div class="table-wrap">' +
        '<table class="data-table import-table">' +
          '<thead><tr>' +
            '<th scope="col">पंक्ति</th><th scope="col">फ़ाइल में नाम</th><th scope="col">हिंदी नाम (सेव होगा)</th>' +
            '<th scope="col" class="num">राशि</th><th scope="col">तारीख</th><th scope="col">वर्ष</th><th scope="col">स्थिति</th>' +
          '</tr></thead>' +
          '<tbody id="importBody"></tbody>' +
        '</table>' +
      '</div>' +
      '<div class="form-actions import-actions">' +
        '<button class="btn btn-primary" id="importConfirmBtn" type="button">रिकॉर्ड जोड़ें</button>' +
        '<button class="btn btn-outline" id="importCancelBtn" type="button">रद्द करें</button>' +
      '</div>' +
    '</div>';

  bar.insertAdjacentElement('afterend', panel);

  document.getElementById('importFile').addEventListener('change', handleImportFile);
  document.getElementById('importToHindi').addEventListener('change', function () {
    const file = document.getElementById('importFile').files[0];
    if (file) handleImportFile();
  });
  document.getElementById('importDefaultDate').addEventListener('change', function () {
    const file = document.getElementById('importFile').files[0];
    if (file) handleImportFile();
  });
  document.getElementById('templateBtn').addEventListener('click', downloadTemplate);
  document.getElementById('importConfirmBtn').addEventListener('click', confirmImport);
  document.getElementById('importCancelBtn').addEventListener('click', resetImport);
  document.getElementById('publishBtn').addEventListener('click', downloadUpdatedMainJs);
}

function resetImport() {
  importRows = [];
  document.getElementById('importFile').value = '';
  document.getElementById('importPreview').hidden = true;
  document.getElementById('importBody').innerHTML = '';
}

async function handleImportFile() {
  const file = document.getElementById('importFile').files[0];
  if (!file) return;
  try {
    const table = /\.xlsx?$/i.test(file.name) ? await readExcel(file) : parseCSV(await file.text());
    importRows = await prepareImportRows(table);
    renderImportPreview();
  } catch (error) {
    console.error(error);
    showToast(error.message || 'फ़ाइल पढ़ी नहीं जा सकी।', 'error');
  }
}

/** Reads CSV text into rows of cells. Handles quotes, commas inside quotes, ; and tab separators. */
function parseCSV(text) {
  text = String(text).replace(/^\uFEFF/, '');
  const firstLine = text.split(/\r?\n/)[0] || '';
  const counts = { ',': (firstLine.match(/,/g) || []).length, ';': (firstLine.match(/;/g) || []).length, '\t': (firstLine.match(/\t/g) || []).length };
  const separator = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];

  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { cell += ch; }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === separator) {
      row.push(cell); cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function loadSheetJS() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise(function (resolve, reject) {
    const script = document.createElement('script');
    script.src = SHEETJS_URL;
    script.onload = function () { resolve(window.XLSX); };
    script.onerror = function () {
      reject(new Error('Excel फ़ाइल पढ़ने के लिए इंटरनेट चाहिए। या फ़ाइल को Excel में “CSV” के रूप में सेव करके चुनें।'));
    };
    document.head.appendChild(script);
  });
}

async function readExcel(file) {
  const XLSX = await loadSheetJS();
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
}

function findColumns(headerRow) {
  const cells = headerRow.map(function (cell) { return String(cell || '').trim().toLowerCase(); });
  const columns = {};
  Object.keys(IMPORT_HEADERS).forEach(function (field) {
    const index = cells.findIndex(function (cell, i) {
      return Object.values(columns).indexOf(i) === -1 &&
        IMPORT_HEADERS[field].some(function (word) { return cell.indexOf(word) !== -1; });
    });
    if (index !== -1) columns[field] = index;
  });
  return columns;
}

function isoFromParts(year, month, day) {
  if (!year || !month || !day) return 'invalid';
  return year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

/** Accepts 27-10-2025, 27/10/2025, 27.10.25, 2025-10-27 and Excel dates. */
function parseImportDate(value) {
  if (value === null || value === undefined || String(value).trim() === '') return '';
  if (typeof value === 'number') {
    if (value > 20000 && value < 80000) {
      const date = new Date(Math.round((value - 25569) * 86400000));
      return isoFromParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    }
    return 'invalid';
  }
  const text = String(value).trim();
  let match = text.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
  if (match) return isoFromParts(Number(match[1]), Number(match[2]), Number(match[3]));
  match = text.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})$/);
  if (match) {
    let year = Number(match[3]);
    if (year < 100) year += 2000;
    return isoFromParts(year, Number(match[2]), Number(match[1]));
  }
  return 'invalid';
}

/** "₹1,100", "200/-", "Rs. 501" → "1100", "200", "501" */
function parseImportAmount(value) {
  if (typeof value === 'number') return String(value);
  return String(value || '').replace(/₹|rs\.?|inr|\/-|\/–|,|\s/gi, '');
}

function recordKey(name, amount, date) {
  return String(name).trim() + '|' + Number(amount) + '|' + date;
}

async function prepareImportRows(table) {
  const rows = table.filter(function (row) {
    return row.some(function (cell) { return String(cell).trim() !== ''; });
  });
  if (!rows.length) throw new Error('फ़ाइल खाली है।');

  let columns = findColumns(rows[0]);
  let dataRows = rows.slice(1);
  let firstRowNumber = 2;
  if (columns.name === undefined || columns.amount === undefined) {
    // No header row: assume Name, Amount, Date, Year
    columns = { name: 0, amount: 1, date: 2, year: 3 };
    dataRows = rows;
    firstRowNumber = 1;
  }

  const toHindi = document.getElementById('importToHindi').checked;
  const defaultDate = document.getElementById('importDefaultDate').value;
  const existing = await DonationStore.getAll();
  const index = buildHindiWordIndex(existing);

  // How many times each donation already exists (to skip repeats)
  const existingCount = {};
  existing.forEach(function (record) {
    const key = recordKey(record.name, record.amount, record.date);
    existingCount[key] = (existingCount[key] || 0) + 1;
  });

  const prepared = [];
  dataRows.forEach(function (row, i) {
    const originalName = String(row[columns.name] === undefined ? '' : row[columns.name]).trim();
    if (/^(total|कुल)/i.test(originalName)) return;   // skip "Total Collection" rows
    if (!originalName && !String(row[columns.amount] || '').trim()) return;

    const name = toHindi ? englishNameToHindi(originalName, index) : originalName;
    const amount = parseImportAmount(row[columns.amount]);
    let date = columns.date !== undefined ? parseImportDate(row[columns.date]) : '';
    if (!date && defaultDate) date = defaultDate;

    let year = columns.year !== undefined ? String(row[columns.year] || '').trim() : '';
    if (!year && /^\d{4}/.test(date)) year = date.slice(0, 4);

    const item = {
      rowNumber: firstRowNumber + i,
      originalName: originalName,
      name: name,
      amount: amount,
      date: date,
      year: year,
      status: 'ok',
      message: '✓ ठीक है'
    };
    checkImportRow(item, existingCount);
    prepared.push(item);
  });
  return prepared;
}

/** Shows the main validation messages in Hindi. */
function hindiError(message) {
  const map = {
    'Enter the donor’s name.': 'नाम नहीं है।',
    'The name must have at least 2 letters.': 'नाम बहुत छोटा है।',
    'Keep the name under 80 characters.': 'नाम बहुत लंबा है।',
    'Enter the donation amount.': 'राशि नहीं है।',
    'Use numbers only, for example 1100.': 'राशि में सिर्फ़ अंक लिखें, जैसे 1100।',
    'The amount must be more than ₹0.': 'राशि ₹0 से ज़्यादा होनी चाहिए।',
    'The amount looks too large. Check the number.': 'राशि बहुत बड़ी है, जाँच लें।',
    'Use up to 2 decimal places, for example 501 or 250.50.': 'राशि सही लिखें, जैसे 501।',
    'Select a valid date.': 'तारीख सही नहीं है।',
    'The date can’t be in the future.': 'तारीख आगे की नहीं हो सकती।',
    'Select the Chhath Puja year.': 'वर्ष नहीं है।',
    'Select a year between 2000 and 2100.': 'वर्ष सही नहीं है।'
  };
  return map[message] || message;
}

function checkImportRow(item, existingCount) {
  if (item.date === 'invalid') {
    item.status = 'error';
    item.message = 'तारीख समझ नहीं आई (जैसे 27-10-2025 लिखें)';
    return;
  }
  if (!item.date) {
    item.status = 'error';
    item.message = 'तारीख नहीं है। ऊपर “जिन पंक्तियों में तारीख नहीं है” भरें।';
    return;
  }
  const result = validateDonation({ name: item.name, amount: item.amount, date: item.date, year: item.year });
  if (!result.valid) {
    item.status = 'error';
    item.message = Object.values(result.errors).map(hindiError).join(' ');
    return;
  }
  const key = recordKey(result.value.name, result.value.amount, result.value.date);
  if (existingCount && existingCount[key] > 0) {
    existingCount[key]--;
    item.status = 'duplicate';
    item.message = 'पहले से सूची में है, छोड़ दिया जाएगा';
    return;
  }
  item.status = 'ok';
  item.message = '✓ ठीक है';
}

function renderImportPreview() {
  const body = document.getElementById('importBody');
  const preview = document.getElementById('importPreview');
  const ok = importRows.filter(function (r) { return r.status === 'ok'; });
  const errors = importRows.filter(function (r) { return r.status === 'error'; }).length;
  const duplicates = importRows.filter(function (r) { return r.status === 'duplicate'; }).length;
  const total = ok.reduce(function (sum, r) { return sum + Number(r.amount); }, 0);

  document.getElementById('importSummary').textContent =
    'कुल पंक्तियाँ: ' + importRows.length + ' · सही: ' + ok.length + ' (' + formatINR(total) + ')' +
    (errors ? ' · ग़लत: ' + errors : '') + (duplicates ? ' · पहले से मौजूद: ' + duplicates : '');

  body.innerHTML = importRows.length ? importRows.map(function (row, i) {
    return '<tr class="import-' + row.status + '">' +
      '<td data-label="पंक्ति">' + row.rowNumber + '</td>' +
      '<td data-label="फ़ाइल में नाम">' + escapeHTML(row.originalName) + '</td>' +
      '<td data-label="हिंदी नाम"><input class="import-name" type="text" lang="hi" data-index="' + i + '" value="' + escapeHTML(row.name) + '" aria-label="पंक्ति ' + row.rowNumber + ' का हिंदी नाम"></td>' +
      '<td data-label="राशि" class="num">' + (Number(row.amount) ? formatINR(row.amount) : escapeHTML(row.amount)) + '</td>' +
      '<td data-label="तारीख">' + (row.date && row.date !== 'invalid' ? formatDate(row.date) : '–') + '</td>' +
      '<td data-label="वर्ष">' + escapeHTML(row.year) + '</td>' +
      '<td data-label="स्थिति" class="import-status">' + escapeHTML(row.message) + '</td>' +
    '</tr>';
  }).join('') : '<tr class="empty-row"><td colspan="7">फ़ाइल में कोई दान नहीं मिला।</td></tr>';

  const confirmBtn = document.getElementById('importConfirmBtn');
  confirmBtn.textContent = ok.length + ' रिकॉर्ड जोड़ें';
  confirmBtn.disabled = ok.length === 0;
  preview.hidden = false;

  // Let the admin correct a Hindi name before importing
  body.querySelectorAll('.import-name').forEach(function (input) {
    input.addEventListener('change', async function () {
      const row = importRows[Number(input.getAttribute('data-index'))];
      row.name = input.value.trim();
      await recheckAllRows();
    });
  });

  preview.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function recheckAllRows() {
  const existing = await DonationStore.getAll();
  const existingCount = {};
  existing.forEach(function (record) {
    const key = recordKey(record.name, record.amount, record.date);
    existingCount[key] = (existingCount[key] || 0) + 1;
  });
  importRows.forEach(function (row) { checkImportRow(row, existingCount); });
  renderImportPreview();
}

async function confirmImport() {
  await recheckAllRows();
  const ok = importRows.filter(function (r) { return r.status === 'ok'; });
  if (!ok.length) return;
  if (!window.confirm(ok.length + ' रिकॉर्ड जोड़ें?')) return;

  let added = 0;
  try {
    for (const row of ok) {
      await DonationStore.add({ name: row.name, amount: row.amount, date: row.date, year: row.year });
      added++;
    }
  } catch (error) {
    console.error(error);
    showToast((error.message || 'कुछ रिकॉर्ड नहीं जुड़ पाए।') + ' (' + added + ' जुड़े)', 'error');
  }
  resetImport();
  if (typeof refreshAll === 'function') await refreshAll();
  if (added) showToast(added + ' रिकॉर्ड जुड़ गए। सबको दिखाने के लिए “नई main.js डाउनलोड करें” दबाएँ।', 'success');
}

function downloadTemplate() {
  const csv = [
    ['नाम (Name)', 'राशि (Amount)', 'तारीख (Date)', 'वर्ष (Year)'],
    ['Dinesh Mandal', '200', '27-10-2025', '2025'],
    ['सीता देवी', '501', '27-10-2025', '2025']
  ].map(function (row) { return row.map(csvCell).join(','); }).join('\r\n');
  downloadCSV('chhath-donation-template.csv', csv);
}

/* --------------------------------------------------------------------------
   6. ADMIN: PUBLISH FOR EVERYONE
   Creates a new main.js that contains every record in this browser.
   -------------------------------------------------------------------------- */
const OLD_MERGE_BLOCK =
"      const addedInAdmin = saved.filter(function (record) {\n" +
"        return String(record.id).indexOf('sample-') !== 0;\n" +
"      });";

const NEW_MERGE_BLOCK =
"      // Keep records added in the admin panel, except the ones that are now\n" +
"      // part of the code list (they were published with \"नई main.js डाउनलोड करें\").\n" +
"      const publishedNow = {};\n" +
"      SAMPLE_DONATIONS.forEach(function (record) {\n" +
"        const key = record.name + '|' + record.amount + '|' + record.date;\n" +
"        publishedNow[key] = (publishedNow[key] || 0) + 1;\n" +
"      });\n" +
"      saved.forEach(function (record) {\n" +
"        if (String(record.id).indexOf('sample-') !== 0) return;\n" +
"        const key = record.name + '|' + record.amount + '|' + record.date;\n" +
"        if (publishedNow[key]) publishedNow[key]--;\n" +
"      });\n" +
"      const addedInAdmin = saved.filter(function (record) {\n" +
"        if (String(record.id).indexOf('sample-') === 0) return false;\n" +
"        const key = record.name + '|' + record.amount + '|' + record.date;\n" +
"        if (publishedNow[key] > 0) { publishedNow[key]--; return false; }\n" +
"        return true;\n" +
"      });";

function sampleNumber(record) {
  const match = String(record.id).match(/^sample-(\d+)$/);
  return match ? Number(match[1]) : Infinity;
}

async function downloadUpdatedMainJs() {
  let source;
  try {
    const response = await fetch('js/main.js', { cache: 'no-store' });
    if (!response.ok) throw new Error('not found');
    source = await response.text();
  } catch (error) {
    showToast('main.js नहीं पढ़ी जा सकी। वेबसाइट Live Server या Netlify से खोलें, फ़ाइल पर डबल-क्लिक करके नहीं।', 'error');
    return;
  }

  const startMarker = 'const SAMPLE_DONATIONS = [';
  const endMarker = '].map(function ([name, amount, date], index) {';
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start === -1 || end === -1) {
    showToast('main.js में दान सूची नहीं मिली। फ़ाइल बदली गई लगती है।', 'error');
    return;
  }

  const records = await DonationStore.getAll();
  const years = Array.from(new Set(records.map(function (r) { return r.year; }))).sort(function (a, b) { return b - a; });

  const lines = [startMarker];
  years.forEach(function (year) {
    const list = records.filter(function (r) { return r.year === year; }).sort(function (a, b) {
      return sampleNumber(a) - sampleNumber(b) || String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    });
    const summary = summarizeDonations(list);
    lines.push('  // ---------- Chhath Puja ' + year + ' — ' + list.length + ' donations, total ' + formatINR(summary.total) + ' ----------');
    list.forEach(function (r) {
      lines.push('  [' + JSON.stringify(r.name) + ', ' + Number(r.amount) + ', ' + JSON.stringify(r.date) + '],');
    });
    lines.push('');
  });
  // Remove the comma after the very last entry
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/,$/.test(lines[i])) { lines[i] = lines[i].replace(/,$/, ''); break; }
  }
  if (!records.length) lines.push('  // No donations yet');

  let output = source.slice(0, start) + lines.join('\n').replace(/\n+$/, '') + '\n' + source.slice(end);

  // One-time upgrade so published admin records are not shown twice
  if (output.indexOf('const publishedNow = {};') === -1 && output.indexOf(OLD_MERGE_BLOCK) !== -1) {
    output = output.replace(OLD_MERGE_BLOCK, NEW_MERGE_BLOCK);
  }

  // Safety check: the new file must be valid JavaScript
  try {
    new Function(output); // checks the code without running it
  } catch (error) {
    console.error(error);
    showToast('नई main.js बनाने में गड़बड़ी हुई। कुछ नहीं बदला गया।', 'error');
    return;
  }

  const blob = new Blob([output], { type: 'text/javascript;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'main.js';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);

  showToast('main.js डाउनलोड हो गई (' + records.length + ' रिकॉर्ड)। इसे js फ़ोल्डर में रखें और Netlify पर अपलोड करें।', 'success');
}

/* --------------------------------------------------------------------------
   7. START-UP
   -------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', function () {
  // Search boxes: tell people they can type in Hindi or English
  ['searchInput', 'searchRecords'].forEach(function (id) {
    const box = document.getElementById(id);
    if (box) box.placeholder = 'नाम लिखें (हिंदी या English)';
  });

  // Admin page only
  setupEnglishNameBox();
  buildToolsPanel();
});
