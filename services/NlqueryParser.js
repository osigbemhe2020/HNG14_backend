// ─── DICTIONARIES ─────────────────────────────────────────────────────────────

const GENDER_KEYWORDS = {
  male: ["male", "males", "man", "men", "boy", "boys", "gentlemen", "gentleman"],
  female: ["female", "females", "woman", "women", "girl", "girls", "lady", "ladies"],
};

const AGE_GROUP_KEYWORDS = {
  child:    ["child", "children", "kid", "kids"],
  teenager: ["teenager", "teenagers", "teen", "teens", "adolescent", "adolescents"],
  adult:    ["adult", "adults"],
  senior:   ["senior", "seniors", "elderly", "elder", "old", "aged"],
};

// "young" is parsed into a min/max age range — NOT stored as an age_group
const YOUNG_KEYWORDS = ["young", "youth", "youthful"];

const ABOVE_KEYWORDS = ["above", "over", "older than", "greater than", "more than"];
const BELOW_KEYWORDS = ["below", "under", "younger than", "less than"];

// ISO 3166-1 alpha-2 country map (name → code)
const COUNTRY_MAP = {
  afghanistan: "AF", albania: "AL", algeria: "DZ", angola: "AO", argentina: "AR",
  australia: "AU", austria: "AT", azerbaijan: "AZ", bahrain: "BH", bangladesh: "BD",
  belarus: "BY", belgium: "BE", benin: "BJ", bolivia: "BO", botswana: "BW",
  brazil: "BR", bulgaria: "BG", burkina: "BF", "burkina faso": "BF", burundi: "BI",
  cambodia: "KH", cameroon: "CM", canada: "CA", chad: "TD", chile: "CL",
  china: "CN", colombia: "CO", "congo": "CG", "democratic republic of congo": "CD",
  "dr congo": "CD", "drc": "CD", "republic of congo": "CG",
  "costa rica": "CR", croatia: "HR", cuba: "CU", czechia: "CZ", "czech republic": "CZ",
  denmark: "DK", djibouti: "DJ", "dominican republic": "DO", ecuador: "EC",
  egypt: "EG", "el salvador": "SV", eritrea: "ER", estonia: "EE", ethiopia: "ET",
  finland: "FI", france: "FR", gabon: "GA", gambia: "GM", georgia: "GE",
  germany: "DE", ghana: "GH", greece: "GR", guatemala: "GT", guinea: "GN",
  "guinea-bissau": "GW", guyana: "GY", haiti: "HT", honduras: "HN", hungary: "HU",
  india: "IN", indonesia: "ID", iran: "IR", iraq: "IQ", ireland: "IE",
  israel: "IL", italy: "IT", "ivory coast": "CI", "cote d'ivoire": "CI",
  jamaica: "JM", japan: "JP", jordan: "JO", kazakhstan: "KZ", kenya: "KE",
  kuwait: "KW", kyrgyzstan: "KG", laos: "LA", latvia: "LV", lebanon: "LB",
  lesotho: "LS", liberia: "LR", libya: "LY", lithuania: "LT", luxembourg: "LU",
  madagascar: "MG", malawi: "MW", malaysia: "MY", mali: "ML", mauritania: "MR",
  mauritius: "MU", mexico: "MX", moldova: "MD", mongolia: "MN", morocco: "MA",
  mozambique: "MZ", myanmar: "MM", namibia: "NA", nepal: "NP", netherlands: "NL",
  "new zealand": "NZ", nicaragua: "NI", niger: "NE", nigeria: "NG", norway: "NO",
  oman: "OM", pakistan: "PK", panama: "PA", paraguay: "PY", peru: "PE",
  philippines: "PH", poland: "PL", portugal: "PT", qatar: "QA", romania: "RO",
  russia: "RU", rwanda: "RW", "saudi arabia": "SA", senegal: "SN",
  "sierra leone": "SL", singapore: "SG", somalia: "SO", "south africa": "ZA",
  "south korea": "KR", "south sudan": "SS", spain: "ES", "sri lanka": "LK",
  sudan: "SD", sweden: "SE", switzerland: "CH", syria: "SY", taiwan: "TW",
  tajikistan: "TJ", tanzania: "TZ", thailand: "TH", togo: "TG", tunisia: "TN",
  turkey: "TR", turkmenistan: "TM", uganda: "UG", ukraine: "UA",
  "united arab emirates": "AE", uae: "AE", "united kingdom": "GB", uk: "GB",
  "united states": "US", usa: "US", america: "US", uruguay: "UY",
  uzbekistan: "UZ", venezuela: "VE", vietnam: "VN", yemen: "YE",
  zambia: "ZM", zimbabwe: "ZW",
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * Normalize query: lowercase and collapse extra spaces
 */
function normalize(q) {
  return q.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Find a number after a keyword like "above 30"
 */
function extractNumberAfter(q, keywords) {
  for (const kw of keywords) {
    // e.g. "above 30" or "above30"
    const regex = new RegExp(`${kw}\\s*(\\d+)`);
    const match = q.match(regex);
    if (match) return parseInt(match[1], 10);
  }
  return null;
}

/**
 * Check if any word from a list appears in the query as a whole word
 */
function containsAny(q, words) {
  return words.some((w) => {
    const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`).test(q);
  });
}

// ─── PARSER ───────────────────────────────────────────────────────────────────

/**
 * Parse a plain-English query string into a filter object.
 * Returns { filters } on success or { error } on failure.
 *
 * Possible filter keys:
 *   gender       → "male" | "female"
 *   age_group    → "child" | "teenager" | "adult" | "senior"
 *   min_age      → Number
 *   max_age      → Number
 *   country_id   → ISO 3166-1 alpha-2 string
 */
function parseNaturalQuery(rawQuery) {
  if (!rawQuery || !rawQuery.trim()) return { error: true };

  const q = normalize(rawQuery);
  const filters = {};
  let matched = false;

  // ── 1. GENDER ──────────────────────────────────────────────────────────────
  const hasMale   = containsAny(q, GENDER_KEYWORDS.male);
  const hasFemale = containsAny(q, GENDER_KEYWORDS.female);

  if (hasMale && !hasFemale) {
    filters.gender = "male";
    matched = true;
  } else if (hasFemale && !hasMale) {
    filters.gender = "female";
    matched = true;
  } else if (hasMale && hasFemale) {
    // "male and female" → no gender filter, but still matched
    matched = true;
  }

  // ── 2. AGE GROUP ───────────────────────────────────────────────────────────
  for (const [group, keywords] of Object.entries(AGE_GROUP_KEYWORDS)) {
    if (containsAny(q, keywords)) {
      filters.age_group = group;
      matched = true;
      break;
    }
  }

  // ── 3. "YOUNG" → age range 16–24 (overrides age_group if present) ──────────
  if (containsAny(q, YOUNG_KEYWORDS)) {
    // "young" is a parsing convenience only — NOT stored as age_group
    delete filters.age_group;
    filters.min_age = 16;
    filters.max_age = 24;
    matched = true;
  }

  // ── 4. ABOVE / BELOW modifiers ─────────────────────────────────────────────
  const aboveAge = extractNumberAfter(q, ABOVE_KEYWORDS);
  const belowAge = extractNumberAfter(q, BELOW_KEYWORDS);

  if (aboveAge !== null) {
    // "above N" overrides young's min if larger
    filters.min_age = filters.min_age != null
      ? Math.max(filters.min_age, aboveAge)
      : aboveAge;
    matched = true;
  }
  if (belowAge !== null) {
    filters.max_age = filters.max_age != null
      ? Math.min(filters.max_age, belowAge)
      : belowAge;
    matched = true;
  }

  // ── 5. COUNTRY ─────────────────────────────────────────────────────────────
  // Try multi-word country names first (longest match wins)
  const sortedCountries = Object.keys(COUNTRY_MAP).sort(
    (a, b) => b.length - a.length
  );
  for (const name of sortedCountries) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`).test(q)) {
      filters.country_id = COUNTRY_MAP[name];
      matched = true;
      break;
    }
  }

  if (!matched) return { error: true };

  return { filters };
}

// ─── MONGOOSE QUERY BUILDER ───────────────────────────────────────────────────

/**
 * Convert parsed filters into a Mongoose query object.
 */
function buildMongooseQuery(filters) {
  const query = {};

  if (filters.gender)     query.gender    = filters.gender;
  if (filters.age_group)  query.age_group = filters.age_group;
  if (filters.country_id) query.country_id = filters.country_id;

  if (filters.min_age != null || filters.max_age != null) {
    query.age = {};
    if (filters.min_age != null) query.age.$gte = filters.min_age;
    if (filters.max_age != null) query.age.$lte = filters.max_age;
  }

  return query;
}

module.exports = { parseNaturalQuery, buildMongooseQuery };