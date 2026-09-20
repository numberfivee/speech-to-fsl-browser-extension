# Pending Vocabulary — FSL Expert Consultation

Generated while cross-checking `translator.js`'s rule tables and
Chapter 3, Table 1 against the FSL-105 dataset (`video_lookup.json`).
None of the words below have a corresponding sign video yet.

## Why this list exists

The rule-based translator (Ch. 3) fronts negation, reorders temporal
expressions, strips particles, and normalizes pronouns — but it can
only ever be as complete as the vocabulary behind it. FSL-105 covers
105 general-purpose signs; almost none of the words in the thesis's
own Table 1 worked examples exist in that set. This list is what's
needed to make those examples actually playable, in priority order.

## Questions for the expert (answer these before recording)

1. **Question form.** Table 1's rule for WH-questions drops the
   question word entirely — e.g. "Anong oras magsisimula ang klase?"
   -> ORAS SIMULA KLASE, no interrogative sign, relying only on
   word order. Is that intelligible in FSL as a question, or does
   FSL require a retained WH-sign (ANO, SAAN, etc.) and/or a
   non-manual marker (eyebrow raise, head tilt) that a sequence of
   flat video clips cannot reproduce? This may mean revising the
   rule rather than just recording more clips.

2. **Fingerspelling fallback.** For words with no sign, the system
   currently fingerspells letter-by-letter. Is that how FSL signers
   actually handle an unfamiliar/untranslated word, or is a
   different strategy (classifier, gloss substitution, borrowed
   sign) more natural? This affects whether the fallback design
   itself needs to change.

## Priority 1 - Personal pronouns
High frequency, appears in nearly every sentence, small recording set.

- AKO (I/me)
- IKAW (you, singular)
- SIYA (he/she)
- KAMI (we, excl.)
- TAYO (we, incl.)
- KAYO (you, plural)
- SILA (they)

## Priority 2 - Negation
Already wired into the rule engine's negation-fronting logic; currently
resolves to nothing.

- HUWAG (don't / prohibitive)
- AYAW (don't want to)

  Note: HINDI, WALA already exist as standalone phrase-mapping
  entries via FSL-105 (ids 14, 13), so they already resolve. Confirm
  with the expert whether the *sign* used for "hindi" as a bare
  negative response ("no") is the same sign used for "hindi" as a
  grammatical negator ("not") - these may not be identical in FSL.

## Priority 3 - Words needed for Chapter 3, Table 1 specifically
Recording these makes the thesis's own worked examples runnable.

| Gloss | Appears in |
|---|---|
| TULONG | "Pwede mo ba akong tulungan?" |
| PUNTA | "Ako ay pupunta...", "...pumunta sa opisina..." |
| PAARALAN | "...pupunta sa paaralan ngayon." |
| PAKIUSAP | "Pakiusap maghintay sandali." |
| HINTAY | "Pakiusap maghintay sandali." |
| RINIG | "Hindi ako makakarinig nang maayos." |
| MAAYOS | "Hindi ako makakarinig nang maayos." |
| ORAS | "Anong oras magsisimula ang klase?" |
| SIMULA | "Anong oras magsisimula ang klase?" |
| KLASE | "Anong oras magsisimula ang klase?" |
| EMERGENCY | "May emergency announcement ngayon." |
| ANUNSYO | "May emergency announcement ngayon." |
| OPISINA | "Kailangan mong pumunta sa opisina bukas." |

## Priority 4 - Question words
Needed regardless of how Q1 above is answered, since some may be
retained signs rather than deleted particles.

- ANO / ANONG
- SINO
- SAAN
- KAILAN
- BAKIT
- PAANO

## Already covered (no action needed)
Confirmed present in FSL-105 and wired into dictionary.json:
SALAMAT (id 7), KUMUSTA/KAMUSTA (id 4), NGAYON (id 49), BUKAS (id 50).
Also present as full-phrase entries in phrase_mappings.json:
HINDI (14), WALA/"hindi ko alam" (13), OO (15), and the existing
greeting set.
