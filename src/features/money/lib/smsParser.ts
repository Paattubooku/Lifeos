/**
 * Bank SMS classifier: a port of My-Tracker `expenseParser.ts` (PRD F19).
 * Three stages, cheapest first, exactly as the reference:
 *   A) reject rules → skipped (plus a new OTP rule);
 *   B) ordered extraction rules, first match wins;
 *   C) no match → unmatched (the reference's Gemini fallback is not ported).
 *
 * This file is dependency-free and byte-identical to
 * `supabase/functions/_shared/smsParser.ts` (a test checks), so the app's
 * Parser Lab and the `ingest-sms` Edge Function classify the same way.
 */

/** LifeOS category keys; the ingest maps them to the user's categories by name. */
export type SmsCategory =
  'food' | 'bills' | 'transport' | 'health' | 'shopping' | 'other' | 'income';

export type SkipReason = 'bill_reminder' | 'failed_autopay' | 'statement_notice' | 'noise' | 'otp';

export type SmsTransaction = {
  kind: 'transaction';
  direction: 'debit' | 'credit';
  amount: number;
  merchant: string | null;
  /** YYYY-MM-DD from the SMS. */
  date: string;
  /** UPI / IMPS / Txn ID, or `sig_<stableHash>` for ref-less formats. */
  txnRef: string;
  category: SmsCategory;
  stage: 'extract_rule';
  rule: string;
};

export type SmsSkipped = {
  kind: 'skipped';
  classification: SkipReason;
  stage: 'reject_rule';
  rule: string;
};

export type SmsUnmatched = {
  kind: 'unmatched';
  classification: 'unmatched';
  stage: 'unmatched_default';
  rule: null;
};

export type SmsResult = SmsTransaction | SmsSkipped | SmsUnmatched;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTHS: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
};

/**
 * "01-Jun-26" (DD-MMM-YY) or "12-06-2026" (DD-MM-YYYY) → YYYY-MM-DD.
 * Unlike the reference (which falls back to today's UTC date), an unknown
 * shape returns null so the message is left unmatched instead of mis-dated.
 */
export function parseBankDate(raw: string): string | null {
  const a = /^(\d{2})-([A-Za-z]{3})-(\d{2})$/.exec(raw);
  if (a) {
    const month = MONTHS[(a[2] as string).toLowerCase()];
    return month ? `20${a[3]}-${month}-${a[1]}` : null;
  }
  const b = /^(\d{2})-(\d{2})-(\d{4})$/.exec(raw);
  if (b) return `${b[3]}-${b[2]}-${b[1]}`;
  return null;
}

const amountOf = (raw: string) => parseFloat(raw.replace(/,/g, ''));

/** FNV-1a 32-bit plus a second mixing seed, as in the reference. */
export function stableHash(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193);
    h2 = (h2 ^ code) + ((h2 << 5) + (h2 >>> 2));
    h2 |= 0;
  }
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  return hex(h1) + hex(h2);
}

export const syntheticRef = (message: string) => `sig_${stableHash(message.trim())}`;

const cleanPayee = (raw: string | undefined | null): string | null =>
  raw ? raw.replace(/\s+/g, ' ').trim() || null : null;

// ---------------------------------------------------------------------------
// Category (cosmetic; never affects classification)
// ---------------------------------------------------------------------------

/**
 * Merchant keyword map from Tracker `parse-sms.ts` (upper-cased payee
 * `includes`, first category wins), folded into LifeOS categories:
 * Subscriptions → Bills; Entertainment and Education → Other (PRD F18).
 */
const MERCHANTS: readonly [SmsCategory, readonly string[]][] = [
  [
    'food',
    [
      'SWIGGY',
      'ZOMATO',
      'DOMINOS',
      'PIZZA HUT',
      'MCDONALDS',
      'BURGER KING',
      'KFC',
      'SUBWAY',
      'STARBUCKS',
      'CHAAYOS',
      'EAT.FIT',
      'FRESHMENU',
      'BOX8',
      'FAASOS',
      'BEHROUZ',
      'LUNCHBOX',
      'ROLLS MAN',
      'HALDIRAM',
      'BIKANERVALA',
      'SAGAR RATNA',
      'CHAI POINT',
      'COSTA COFFEE',
      'BARISTA',
      'CREAM STONE',
      'HAVMOR',
      'NATURAL',
      'HOT N SPICY',
      'BIRYANI',
      'DOSA',
      'IDLY',
      'RESTAURANT',
      'CAFE',
      'BAKERY',
      'SWEET',
      'FOOD',
      'DHABA',
      'MESS',
      'KITCHEN',
      'TANDOOR',
      'PIZZA',
      'BURGER',
      'NOODLES',
      'BIRYANI HOUSE',
    ],
  ],
  [
    'transport',
    [
      'UBER',
      'OLA',
      'RAPIDO',
      'IRCTC',
      'MAKEMYTRIP',
      'GOIBIBO',
      'CLEARTRIP',
      'REDBUS',
      'YATRA',
      'BLUSMART',
      'INDIGO',
      'SPICEJET',
      'AIR INDIA',
      'VISTARA',
      'AKASA AIR',
      'METRO',
      'FASTAG',
      'TOLL',
      'NHAI',
      'PARKING',
      'PETROL',
      'FUEL',
      'GAS STATION',
      'HP PETROL',
      'BP PETROL',
      'IOCL',
      'CABS',
      'TAXI',
      'AUTORICKSHAW',
      'RAILWAY',
    ],
  ],
  [
    'shopping',
    [
      'AMAZON',
      'FLIPKART',
      'MYNTRA',
      'AJIO',
      'NYKAA',
      'SNAPDEAL',
      'MEESHO',
      'CROMA',
      'RELIANCE DIGITAL',
      'VIJAY SALES',
      'IKEA',
      'H&M',
      'ZARA',
      'TATA CLIQ',
      'FIRSTCRY',
      'DECATHLON',
      'NYKA FASHION',
      'LIMEROAD',
      'STREET STYLE',
      'BIG BAZAAR',
      'DMART',
      'RELIANCE FRESH',
      'MORE STORE',
      'SPENCER',
      'D-MART',
    ],
  ],
  [
    'other',
    [
      'NETFLIX',
      'SPOTIFY',
      'HOTSTAR',
      'DISNEY',
      'PRIME VIDEO',
      'YOUTUBE',
      'APPLE MUSIC',
      'SOUNDCLOUD',
      'GAANA',
      'JIOSAAVN',
      'WYNK',
      'BOOKMYSHOW',
      'TICKETMASTER',
      'PAYTM MOVIES',
      'PVR',
      'INOX',
      'CINEPOLIS',
      'XBOX',
      'PLAYSTATION',
      'STEAM',
      'EPIC GAMES',
    ],
  ],
  [
    'bills',
    [
      'ELECTRICITY',
      'WATER BILL',
      'GAS BILL',
      'RENT',
      'SOCIETY',
      'MAINTENANCE',
      'MUNICIPAL',
      'PROPERTY TAX',
      'INSURANCE',
      'LIC',
      'POLICY',
      'EMI',
      'LOAN',
      'HDFC LTD',
      'BAJAJ FINSERV',
      'TATA POWER',
      'ADANI',
      'BSNL',
      'JIO POSTPAID',
      'AIRTEL',
      'VI POSTPAID',
      'DTH',
      'TATA SKY',
      'DISHTV',
      'ACTFIBER',
      'BSNL FIBER',
      'JIO FIBER',
      'AIRTEL BROADBAND',
      'HATHWAY',
      'BROADBAND',
      'FIBER',
      'TATA PLAY',
      'AURAGOLD',
    ],
  ],
  [
    'health',
    [
      'PHARMACY',
      'MEDPLUS',
      'APOLLO PHARMA',
      'NETMEDS',
      'PHARMEASY',
      '1MG',
      'PRISTYN',
      'APOLLO HOSPITAL',
      'FORTIS',
      'MAX HOSPITAL',
      'GYM',
      'CULT FIT',
      'FITSO',
      'HEALTHIFY',
      'DOCTOR',
      'DENTAL',
      'HOSPITAL',
      'CLINIC',
      'DIAGNOSTIC',
      'DR LAL PATH',
      'THYROCARE',
      'METROPOLIS',
    ],
  ],
  [
    'other',
    [
      'COURSERA',
      'UDACITY',
      'UDEMY',
      'BYJU',
      'UNACADEMY',
      'WHITEHAT',
      'VEDANTU',
      'TOPPR',
      'SIMPLILEARN',
      'PLURALSIGHT',
      'SKILLSHARE',
      'DUOLINGO',
      'CHEGG',
      'SCHOOL',
      'COLLEGE',
      'UNIVERSITY',
      'TUITION',
    ],
  ],
  [
    'bills',
    [
      'ICLOUD',
      'GITHUB',
      'MEDIUM',
      'NOTION',
      'CANVA',
      'FIGMA',
      'SLACK',
      'ZOOM',
      'MICROSOFT 365',
      'GOOGLE ONE',
      'APPLE ONE',
      'APPLE TV',
      'AUDIBLE',
      'KINDLE',
      'HEADSPACE',
      'CALM',
    ],
  ],
];

/** The reference's own hints over payee + message (cash/card/transfer → Other). */
const HINTS: readonly [SmsCategory, readonly RegExp[]][] = [
  ['other', [/cardless withdrawal/i, /\batm\b/i, /cash w/i]],
  [
    'bills',
    [/fibernet/i, /pdcl/i, /electricity/i, /bill pay/i, /broadband/i, /\bdth\b/i, /recharge/i],
  ],
  [
    'food',
    [
      /swiggy/i,
      /zomato/i,
      /juice/i,
      /spicy/i,
      /\bbriy/i,
      /hotel/i,
      /restaurant/i,
      /thalap/i,
      /unavagam/i,
      /food/i,
      /snacks?/i,
    ],
  ],
  ['other', [/credit card/i, /\bcard xx\d+/i, /spent using/i]],
  ['shopping', [/\bmart\b/i, /\bstore\b/i, /\bshop\b/i, /retail/i]],
];

/** Credits → income; else the merchant map on the payee, then the reference hints, else Other. */
export function inferCategory(
  direction: 'debit' | 'credit',
  merchant: string | null,
  message: string,
): SmsCategory {
  if (direction === 'credit') return 'income';
  const name = (merchant ?? '').toUpperCase().trim();
  if (name)
    for (const [cat, words] of MERCHANTS) if (words.some((w) => name.includes(w))) return cat;
  const hay = `${merchant ?? ''} ${message}`;
  for (const [cat, patterns] of HINTS) if (patterns.some((p) => p.test(hay))) return cat;
  return 'other';
}

// ---------------------------------------------------------------------------
// Stage A: reject
// ---------------------------------------------------------------------------

type RejectRule = { name: string; test: (lower: string) => boolean; reason: SkipReason };

/** Money actually moving: such a message is never rejected as an OTP. */
const MOVED = /debited for|credited with|spent using|cardless withdrawal|is credited/;

export const REJECT_RULES: readonly RejectRule[] = [
  {
    name: 'bill_reminder_auto_debit',
    test: (m) => m.includes('will be auto-debited on') || m.includes('will auto-deduct on'),
    reason: 'bill_reminder',
  },
  {
    name: 'bill_reminder_please_ignore',
    test: (m) => m.includes('amount will be debited from') && m.includes('please ignore if paid'),
    reason: 'bill_reminder',
  },
  {
    name: 'failed_autopay_cbs_rejection',
    test: (m) => m.includes('not debited') && m.includes('cbs rejection'),
    reason: 'failed_autopay',
  },
  {
    name: 'statement_notice',
    test: (m) => m.includes('statement is sent to'),
    reason: 'statement_notice',
  },
  {
    name: 'fee_change_noise',
    test: (m) => m.includes('revised') && m.includes('fee') && m.includes('updated'),
    reason: 'noise',
  },
  {
    name: 'generic_promo_noise',
    test: (m) =>
      m.includes('for details, visit') && !m.includes('debited') && !m.includes('credited'),
    reason: 'noise',
  },
  {
    // New in LifeOS (PRD F19): one-time passwords are never transactions.
    name: 'otp',
    test: (m) =>
      (/\botp\b/.test(m) || m.includes('one time password') || m.includes('do not share')) &&
      !MOVED.test(m),
    reason: 'otp',
  },
];

// ---------------------------------------------------------------------------
// Stage B: extract
// ---------------------------------------------------------------------------

type Extracted = Omit<SmsTransaction, 'kind' | 'category' | 'stage' | 'rule' | 'date'> & {
  date: string | null;
};
type ExtractRule = {
  name: string;
  regex: RegExp;
  extract: (m: RegExpExecArray, message: string) => Extracted;
};

const g = (m: RegExpExecArray, i: number) => m[i] as string;

export const EXTRACT_RULES: readonly ExtractRule[] = [
  {
    name: 'upi_debit',
    regex:
      /Acct\s+XX\d+\s+debited for Rs\s*([\d,]+\.\d{2})\s+on\s+(\d{2}-[A-Za-z]{3}-\d{2});\s*(.+?)\s+credited\.?\s*UPI:(\d+)/i,
    extract: (m) => ({
      direction: 'debit',
      amount: amountOf(g(m, 1)),
      merchant: cleanPayee(m[3]),
      date: parseBankDate(g(m, 2)),
      txnRef: g(m, 4),
    }),
  },
  {
    name: 'upi_credit',
    regex:
      /Acct\s+XX\d+\s+is credited with Rs\s*([\d,]+\.\d{2})\s+on\s+(\d{2}-[A-Za-z]{3}-\d{2})\s+from\s+(.+?)\.\s*UPI:(\d+)/i,
    extract: (m) => ({
      direction: 'credit',
      amount: amountOf(g(m, 1)),
      merchant: cleanPayee(m[3]),
      date: parseBankDate(g(m, 2)),
      txnRef: g(m, 4),
    }),
  },
  {
    name: 'imps_credit',
    regex:
      /Account\s+XX\d+\s+is credited with Rs\s*([\d,]+\.\d{2})\s+on\s+(\d{2}-[A-Za-z]{3}-\d{2})\s+by\s+(.+?)\.\s*IMPS Ref\.?\s*no\.?\s*(\d+)/i,
    extract: (m) => ({
      direction: 'credit',
      amount: amountOf(g(m, 1)),
      merchant: cleanPayee(m[3]),
      date: parseBankDate(g(m, 2)),
      txnRef: g(m, 4),
    }),
  },
  {
    name: 'cardless_atm_withdrawal',
    regex:
      /Rs\.?\s*([\d,]+\.\d{2})\s+cardless withdrawal at ICICI Bank ATM on\s+(\d{2}-[A-Za-z]{3}-\d{2})\.\s*Info:\s*([\w*]+)/i,
    extract: (m) => ({
      direction: 'debit',
      amount: amountOf(g(m, 1)),
      merchant: 'ATM Cash Withdrawal',
      date: parseBankDate(g(m, 2)),
      txnRef: g(m, 3),
    }),
  },
  {
    name: 'credit_card_spend',
    regex:
      /INR\s*([\d,]+\.\d{2})\s+spent using ICICI Bank Card\s+XX\d+\s+on\s+(\d{2}-[A-Za-z]{3}-\d{2})\s+on\s+(.+?)\.\s*Avl/i,
    extract: (m, message) => ({
      direction: 'debit',
      amount: amountOf(g(m, 1)),
      merchant: cleanPayee(m[3]),
      date: parseBankDate(g(m, 2)),
      txnRef: syntheticRef(message),
    }),
  },
  {
    name: 'bill_autodebit_paid',
    regex:
      /^(.+?)\s+bill of Rs\s*([\d,.]+)\s+for .*?paid on\s+(\d{2}-\d{2}-\d{4})\s+[\d:]+\s*[AP]M\.\s*Txn ID:\s*(\S+)/i,
    extract: (m) => ({
      direction: 'debit',
      amount: amountOf(g(m, 2)),
      merchant: cleanPayee(m[1]),
      date: parseBankDate(g(m, 3)),
      txnRef: g(m, 4).replace(/-ICICI Bank\.?$/i, ''),
    }),
  },
  {
    name: 'credit_card_autopay_confirmation',
    regex:
      /thank you for your payment of INR\s*([\d,]+\.\d{2})\s+towards\s+(.+?)\s+through Auto Debit from Account\s+XX\d+\s+on\s+(\d{2}-[A-Za-z]{3}-\d{2})/i,
    extract: (m, message) => ({
      direction: 'debit',
      amount: amountOf(g(m, 1)),
      merchant: cleanPayee(m[2]),
      date: parseBankDate(g(m, 3)),
      txnRef: syntheticRef(message),
    }),
  },
];

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const UNMATCHED: SmsUnmatched = {
  kind: 'unmatched',
  classification: 'unmatched',
  stage: 'unmatched_default',
  rule: null,
};

/** Classify one SMS. Pure and synchronous; throws only on programming errors. */
export function classifySms(message: string): SmsResult {
  const text = message.trim();
  const lower = text.toLowerCase();
  for (const r of REJECT_RULES)
    if (r.test(lower))
      return { kind: 'skipped', classification: r.reason, stage: 'reject_rule', rule: r.name };
  for (const r of EXTRACT_RULES) {
    const m = r.regex.exec(text);
    if (!m) continue;
    const x = r.extract(m, text);
    if (x.date === null || !(x.amount > 0)) return UNMATCHED;
    return {
      kind: 'transaction',
      ...x,
      date: x.date,
      category: inferCategory(x.direction, x.merchant, text),
      stage: 'extract_rule',
      rule: r.name,
    };
  }
  return UNMATCHED;
}
