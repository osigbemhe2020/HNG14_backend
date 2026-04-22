# Natural Language Profile Search — Parser Documentation

## Overview

`GET /api/profiles/search?q=<query>`

This endpoint accepts plain English queries and converts them into structured MongoDB filters using a **rule-based parser** (`nlQueryParser.js`). No AI or LLMs are involved. The parser works by scanning the query string for known keywords and patterns, then assembling a filter object that is passed directly to Mongoose.

---

## 1. Parsing Approach

### How it works

The query string is normalized (lowercased, whitespace collapsed) and then passed through five sequential stages. Each stage checks for its own keyword set independently, so multiple filters can be extracted from a single query.

```
Raw query → normalize → [gender] → [age group] → [young] → [above/below] → [country] → Mongoose query
```

Each stage writes into a shared `filters` object. At the end, if no stage matched anything, the parser returns an error.

---

### Stage 1 — Gender

Detected by matching synonyms against two keyword banks.

| Filter value | Keywords matched |
|---|---|
| `male` | male, males, man, men, boy, boys, gentleman, gentlemen |
| `female` | female, females, woman, women, girl, girls, lady, ladies |

**Both genders present** (e.g. *"male and female teenagers"*) → no `gender` filter is applied, but the query is still considered valid and the other stages continue.

---

### Stage 2 — Age Group

Matched against four keyword banks. Maps directly to the `age_group` enum on the schema.

| `age_group` value | Keywords matched |
|---|---|
| `child` | child, children, kid, kids |
| `teenager` | teenager, teenagers, teen, teens, adolescent, adolescents |
| `adult` | adult, adults |
| `senior` | senior, seniors, elderly, elder, old, aged |

Only the **first match** is used. If multiple age group words appear in the same query, the first one encountered wins.

---

### Stage 3 — "young" (special case)

The word *young* (and synonyms: *youth*, *youthful*) is treated as a **shorthand age range**, not an age group. It is intentionally **not** stored as `age_group`.

| Keyword | Maps to |
|---|---|
| young, youth, youthful | `min_age: 16, max_age: 24` |

If an `age_group` was already set in Stage 2, it is **removed** when *young* is detected, because *young* implies a numeric range that supersedes a categorical group.

---

### Stage 4 — Above / Below (numeric age modifiers)

The parser scans for a number following directional keywords.

| Direction | Keywords | Filter key |
|---|---|---|
| Above | above, over, older than, greater than, more than | `min_age` |
| Below | below, under, younger than, less than | `max_age` |

**Interaction with "young":** If *young* set `min_age: 16` and the query also says *above 20*, the parser takes the **larger** of the two values (`min_age = 20`). Similarly, *below* takes the **smaller** of any existing `max_age`.

Example resolutions:

| Query | min_age | max_age |
|---|---|---|
| `young males` | 16 | 24 |
| `young males above 20` | 20 | 24 |
| `young females below 22` | 16 | 22 |
| `females above 30` | 30 | — |

---

### Stage 5 — Country

The parser maintains a dictionary of ~150 country names mapped to their ISO 3166-1 alpha-2 codes. Matching uses **whole-word boundary checks** and resolves **longest match first** to avoid partial collisions (e.g. *guinea* matching inside *guinea-bissau*).

A selection of supported aliases:

| Query term(s) | `country_id` |
|---|---|
| nigeria | NG |
| angola | AO |
| kenya | KE |
| south africa | ZA |
| united states, usa, america | US |
| united kingdom, uk | GB |
| united arab emirates, uae | AE |
| dr congo, drc, democratic republic of congo | CD |
| ivory coast, cote d'ivoire | CI |

The full dictionary covers Africa, Asia, Europe, the Americas, and the Middle East.

---

### Query Examples

| Query | Resulting filters |
|---|---|
| `young males from nigeria` | `gender=male, min_age=16, max_age=24, country_id=NG` |
| `females above 30` | `gender=female, min_age=30` |
| `people from angola` | `country_id=AO` |
| `adult males from kenya` | `gender=male, age_group=adult, country_id=KE` |
| `male and female teenagers above 17` | `age_group=teenager, min_age=17` |
| `young males above 20 from ghana` | `gender=male, min_age=20, max_age=24, country_id=GH` |
| `senior women` | `gender=female, age_group=senior` |

---

### Error Response

Any query that produces zero matched filters returns:

```json
{
  "status": "error",
  "message": "Unable to interpret query"
}
```

---

### Response Shape (success)

```json
{
  "status": "success",
  "query": "young males from nigeria",
  "interpreted_as": {
    "gender": "male",
    "min_age": 16,
    "max_age": 24,
    "country_id": "NG"
  },
  "pagination": {
    "total": 412,
    "page": 1,
    "limit": 20,
    "pages": 21
  },
  "data": [ ... ]
}
```

The `interpreted_as` field is returned on every successful response so clients can display or debug what the parser understood.

---

## 2. Limitations and Edge Cases

### Age handling

**No range syntax.** Queries like *"between 20 and 35"* or *"ages 18 to 25"* are not supported. Only `above N` and `below N` patterns work.

**"Young" is a parsing alias, not a data value.** The word *young* maps to `min_age=16, max_age=24` purely at query time. Documents do not store a *young* age group, so this filter works by querying the numeric `age` field. If a document has `age: null`, it will not match a young query even if it would otherwise qualify.

**"Old" is mapped to senior.** The word *old* triggers `age_group=senior` rather than a numeric filter. Queries like *"old people above 60"* will produce `age_group=senior, min_age=60` which may return fewer results than expected since `age_group` and `age` are separate fields that may not always align.

**No age range inference from age groups.** Saying *"adults"* sets `age_group=adult` but does not automatically add `min_age=18`. The parser trusts the stored `age_group` field and does not second-guess it with numeric bounds.

---

### Gender handling

**No non-binary or gender-neutral support.** The parser only recognises `male` and `female`. Terms like *non-binary*, *they/them*, *gender-neutral*, or *people* (used as a gender signal) are silently ignored.

**"People" is not a gender keyword.** *"people from angola"* correctly returns no gender filter and matches everyone. But *"people"* used with intent like *"all people"* adds nothing — it is simply ignored.

---

### Country handling

**Only country names, no cities or regions.** Queries like *"people from Lagos"* or *"males from East Africa"* will not match any country. City, state, region, and continent names are not in the dictionary.

**No demonym support.** *"Nigerian males"* will not match. Only the country name form works (*"males from nigeria"*). Demonyms (Nigerian, Kenyan, Ghanaian, etc.) are not in the keyword dictionary.

**Ambiguous short names.** Some countries share partial names. The longest-match strategy handles most cases (e.g. *guinea* vs *guinea-bissau*) but edge cases like *"congo"* default to Republic of Congo (`CG`), not DRC (`CD`). Use *"dr congo"* or *"drc"* explicitly for DRC.

**No ISO code input.** Typing `NG` or `KE` directly in the query string will not be recognised. The parser only reads country names, not codes.

---

### Query structure

**No negation.** Queries like *"males not from nigeria"* or *"adults excluding seniors"* are not supported. The *not* / *excluding* / *except* keywords are silently ignored and the positive filter is applied anyway.

**No OR logic across filters.** Every matched filter is ANDed together in the Mongoose query. There is no way to express *"males from kenya OR females from ghana"* in a single query.

**Only one age group per query.** If the query contains both *teenager* and *adult*, only the first matched keyword is used. The second is silently ignored.

**Typos and misspellings are not corrected.** *"nigria"* will not match Nigeria. The parser does exact whole-word matching with no fuzzy or phonetic fallback.

**Conjunctions are not parsed grammatically.** The parser does not understand sentence structure. *"males above 30 and females below 25"* will not split into two sub-queries. It will extract `gender=male` (first gender match), `min_age=30`, and `max_age=25`, which is likely not what was intended.