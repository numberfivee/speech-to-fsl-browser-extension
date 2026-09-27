/*
 * translator.js
 *
 * Rule-Based Filipino -> FSL translation layer.
 *
 * Pipeline (Chapter 3, Table 1):
 *
 *   normalize
 *     -> phrase mapping      (longest, non-overlapping)
 *     -> for each unmapped gap:
 *          question-form restructuring
 *          particle / linker / auxiliary removal
 *          pronoun normalization
 *          morphological simplification (stemming)
 *          negation fronting
 *          temporal expression -> end
 *          dictionary lookup, else fingerspell fallback
 *
 * Public API used by content.js:
 *   loadDictionary(), loadPhraseMappings(), loadVideoLookup(), loadAlphabet()
 *   normalizeText(text)
 *   findPhraseMappings(text)        - unchanged behaviour
 *   buildFSLSequence(text)          - NEW: full rule-based sequence
 *   getFSLVideo(datasetId)
 */

let fslDictionary = {};
let phraseMappings = {};
let videoLookup = {};
let alphabetLookup = {};

/* ------------------------------------------------------------------ */
/* Resource loading                                                    */
/* ------------------------------------------------------------------ */

async function loadJSONResource(filename) {
    const url = chrome.runtime.getURL(filename);
    const response = await fetch(url);
    return await response.json();
}

async function loadVideoLookup() {
    try {
        videoLookup = await loadJSONResource("video_lookup.json");
        console.log("FSL Video Lookup loaded:", videoLookup);
    } catch (error) {
        console.error("Error loading FSL video lookup:", error);
    }
}

async function loadDictionary() {
    try {
        fslDictionary = await loadJSONResource("dictionary.json");
        console.log("FSL Dictionary loaded:", fslDictionary);
    } catch (error) {
        console.error("Error loading dictionary:", error);
    }
}

async function loadPhraseMappings() {
    try {
        phraseMappings = await loadJSONResource("phrase_mappings.json");
        console.log("Phrase mappings loaded:", phraseMappings);
    } catch (error) {
        console.error("Error loading phrase mappings:", error);
    }
}

/*
 * Optional. Maps a single letter -> asset path, e.g.
 *   { "a": "fsl_alphabet/a.mp4", "b": "fsl_alphabet/b.mp4", ... }
 * Used only for the fingerspelling fallback. Safe to omit.
 */
async function loadAlphabet() {
    try {
        alphabetLookup = await loadJSONResource("alphabet_lookup.json");
        console.log("FSL Alphabet loaded:", alphabetLookup);
    } catch (error) {
        console.warn("Alphabet lookup unavailable; fingerspelling disabled.");
        alphabetLookup = {};
    }
}

/* ------------------------------------------------------------------ */
/* Rule tables                                                         */
/*                                                                     */
/* These are the "predefined grammatical transformation rules" the     */
/* methodology refers to. Keep them here (not scattered in code) so    */
/* they can be cited and extended.                                     */
/* ------------------------------------------------------------------ */

const FSL_RULES = {

    /* Rule: removal of linking verbs, articles, markers, enclitics */
    particles: [
        "ay", "ang", "ng", "nang", "mga", "na", "si", "ni", "kay",
        "sa", "isang", "yung", "ung", "iyong", "ito", "iyan",
        "po", "opo", "ba", "naman", "lang", "lamang", "din", "rin",
        "daw", "raw", "pala", "kasi", "at", "o", "ni"
    ],

    /* Rule: question-form restructuring (interrogative word dropped) */
    questionWords: [
        "ano", "anong", "sino", "sinong", "saan", "saang",
        "kailan", "bakit", "paano", "papaano", "alin", "aling",
        "ilan", "ilang", "magkano", "kanino"
    ],

    /* Rule: removal of auxiliary / modal verbs */
    auxiliaries: [
        "pwede", "puwede", "maaari", "maari", "dapat", "kailangan",
        "gusto", "nais", "ibig", "baka", "siguro", "medyo"
    ],

    /* Rule: negation handling (fronted in FSL output) */
    negators: {
        "hindi": "HINDI",
        "di": "HINDI",
        "wala": "WALA",
        "walang": "WALA",
        "huwag": "HUWAG",
        "wag": "HUWAG",
        "ayaw": "AYAW"
    },

    /* Rule: temporal expression handling (moved to end of sequence) */
    temporal: [
        "ngayon", "bukas", "kahapon", "mamaya", "kanina",
        "mayamaya", "kanina", "ngayong", "later", "today", "tomorrow"
    ],

    /* Pronoun normalization -> FSL gloss */
    pronouns: {
        "ako": "AKO", "akong": "AKO", "ko": "AKO", "aking": "AKO",
        "ikaw": "IKAW", "ka": "IKAW", "mo": "IKAW", "mong": "IKAW",
        "iyong": "IKAW", "kayo": "KAYO", "ninyo": "KAYO", "inyong": "KAYO",
        "siya": "SIYA", "niya": "SIYA", "kaniya": "SIYA",
        "kami": "KAMI", "namin": "KAMI",
        "tayo": "TAYO", "natin": "TAYO",
        "sila": "SILA", "nila": "SILA"
    },

    /*
     * Morphological exceptions. Checked BEFORE the affix stripper,
     * because Filipino affixation is too irregular to stem blindly.
     * Extend this as your vocabulary grows.
     */
    stemExceptions: {
        "tulungan": "tulong", "tumulong": "tulong", "matulungan": "tulong",
        "pupunta": "punta", "pumunta": "punta", "magpunta": "punta",
        "magsisimula": "simula", "nagsimula": "simula", "simulan": "simula",
        "makakarinig": "rinig", "narinig": "rinig", "marinig": "rinig",
        "naiintindihan": "intindi", "intindihin": "intindi",
        "maghintay": "hintay", "naghintay": "hintay", "hintayin": "hintay",
        "magsalita": "salita", "nagsalita": "salita",
        "makita": "kita", "nakita": "kita",
        "kumain": "kain", "kumakain": "kain",
        "magtanong": "tanong", "nagtanong": "tanong"
    },

    /* Affixes stripped when no exception matches */
    prefixes: ["nagpa", "magpa", "naka", "maka", "nag", "mag", "um", "in", "na", "ma", "pa"],
    suffixes: ["han", "hin", "an", "in"]
};

/* ------------------------------------------------------------------ */
/* Normalization                                                       */
/* ------------------------------------------------------------------ */

function normalizeText(text) {
    return text
        .toLowerCase()
        .replace(/[\u2018\u2019]/g, "'")   // curly -> straight apostrophe
        .replace(/[.,!?;:¿¡"]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

/* ------------------------------------------------------------------ */
/* Phrase matching (behaviour preserved from the original)             */
/* ------------------------------------------------------------------ */

function findPhraseMappings(text) {

    const normalizedText = normalizeText(text);
    const phrases = Object.keys(phraseMappings);
    const candidates = [];

    for (const phrase of phrases) {

        const normalizedPhrase = normalizeText(phrase);
        if (!normalizedPhrase) continue;

        const escapedPhrase = normalizedPhrase.replace(
            /[.*+?^${}()|[\]\\]/g, "\\$&"
        );

        const regex = new RegExp(
            `(?:^|\\s)${escapedPhrase}(?=\\s|$)`, "g"
        );

        let match;
        while ((match = regex.exec(normalizedText)) !== null) {

            const leadingSpace = match[0].startsWith(" ") ? 1 : 0;
            const position = match.index + leadingSpace;

            candidates.push({
                type: "phrase",
                phrase: phrase,
                position: position,
                end: position + normalizedPhrase.length,
                ...phraseMappings[phrase]
            });

            /* allow adjacent matches to be found */
            regex.lastIndex = position + 1;
        }
    }

    candidates.sort((a, b) => {
        if (a.position !== b.position) return a.position - b.position;
        return b.phrase.length - a.phrase.length;
    });

    const matches = [];
    let lastEnd = -1;

    for (const candidate of candidates) {
        if (candidate.position >= lastEnd) {
            matches.push(candidate);
            lastEnd = candidate.end;
        }
    }

    return matches;
}

/* ------------------------------------------------------------------ */
/* Rule implementations                                                */
/* ------------------------------------------------------------------ */

function stemWord(word) {

    if (FSL_RULES.stemExceptions[word]) {
        return FSL_RULES.stemExceptions[word];
    }

    /* already a known sign? leave it alone */
    if (fslDictionary[word]) return word;

    let candidate = word;

    /* CV- reduplication, e.g. "pupunta" -> "punta" */
    const redup = candidate.match(/^([bkdglmnprstwy])([aeiou])\2?\1?/);
    if (redup && candidate.length > 5) {
        const stripped = candidate.slice(2);
        if (fslDictionary[stripped]) return stripped;
    }

    for (const prefix of FSL_RULES.prefixes) {
        if (candidate.startsWith(prefix) && candidate.length - prefix.length >= 3) {
            const stripped = candidate.slice(prefix.length);
            if (fslDictionary[stripped]) return stripped;
        }
    }

    for (const suffix of FSL_RULES.suffixes) {
        if (candidate.endsWith(suffix) && candidate.length - suffix.length >= 3) {
            const stripped = candidate.slice(0, -suffix.length);
            if (fslDictionary[stripped]) return stripped;
        }
    }

    return word;
}

/*
 * Applies the Table 1 rules to a run of words that no phrase
 * mapping claimed. Returns an ordered array of glosses.
 */
function applyRules(words, baseOffset, normalizedText) {

    let tokens = words.map((word, index) => ({
        surface: word,
        /* absolute character position, used for stable queue keys */
        position: baseOffset + normalizedText
            .slice(baseOffset)
            .indexOf(word)
    }));

    const negations = [];
    const temporals = [];
    const core = [];

    for (const token of tokens) {

        const word = token.surface;

        /* Rule: question-form restructuring */
        if (FSL_RULES.questionWords.includes(word)) continue;

        /* Rule: auxiliary / modal removal */
        if (FSL_RULES.auxiliaries.includes(word)) continue;

        /* Rule: particle, article and linking-verb removal */
        if (FSL_RULES.particles.includes(word)) continue;

        /* Rule: negation handling - collected, emitted first */
        if (FSL_RULES.negators[word]) {
            negations.push({ ...token, gloss: FSL_RULES.negators[word] });
            continue;
        }

        /* Rule: temporal handling - collected, emitted last */
        if (FSL_RULES.temporal.includes(word)) {
            temporals.push({ ...token, gloss: word.toUpperCase() });
            continue;
        }

        /* Pronoun normalization */
        if (FSL_RULES.pronouns[word]) {
            core.push({ ...token, gloss: FSL_RULES.pronouns[word] });
            continue;
        }

        /* Morphological simplification, then keyword retained */
        const stem = stemWord(word);
        core.push({ ...token, surface: stem, gloss: stem.toUpperCase() });
    }

    return [...negations, ...core, ...temporals];
}

/*
 * Resolves a gloss to a playable unit:
 *   dictionary hit  -> { type: "sign", dataset_id }
 *   no hit + alphabet loaded -> { type: "fingerspell", letters: [...] }
 *   no hit, no alphabet      -> { type: "unmapped" }
 */
function resolveGloss(token) {

    const entry = fslDictionary[token.surface];

    /* dictionary.json entries point into video_lookup.json by
       dataset_id — the same FSL-105 asset system phrase mappings
       use, so word-level and phrase-level signs resolve the same
       way. */
    if (entry && entry.dataset_id !== undefined) {

        const videoData = getFSLVideo(entry.dataset_id);

        return {
            type: "sign",
            phrase: token.surface,
            position: token.position,
            end: token.position + token.surface.length,
            dataset_label: entry.dataset_label || token.gloss,
            dataset_id: entry.dataset_id,
            video: videoData ? videoData.video : null,
            category: entry.category || "WORD",
            source: entry.source || "dictionary"
        };
    }

    const chars = token.surface.split("");
    const hasFullCoverage =
        chars.length > 0 &&
        chars.every(c => alphabetLookup[c]);

    if (hasFullCoverage) {
        return {
            type: "fingerspell",
            phrase: token.surface,
            position: token.position,
            end: token.position + token.surface.length,
            dataset_label: token.gloss,
            dataset_id: null,
            /* resolved to full extension URLs now, so playback
               needs no further lookups. These are STILL IMAGES
               (the FSL alphabet dataset is image-based), not
               video, so content.js renders them differently. */
            letters: chars.map(c => ({
                letter: c,
                image: chrome.runtime.getURL(alphabetLookup[c])
            })),
            category: "FINGERSPELL",
            source: "FSL-alphabet"
        };
    }

    return {
        type: "unmapped",
        phrase: token.surface,
        position: token.position,
        end: token.position + token.surface.length,
        dataset_label: token.gloss,
        dataset_id: null,
        category: "UNMAPPED",
        source: null
    };
}

/* ------------------------------------------------------------------ */
/* Main entry point                                                    */
/* ------------------------------------------------------------------ */

/*
 * Returns an ordered array of playable units. Item shape is compatible
 * with what content.js already expects from findPhraseMappings(), so
 * the existing queue reconciliation keeps working.
 */
function buildFSLSequence(text) {

    const normalizedText = normalizeText(text);
    if (!normalizedText) return [];

    const phraseMatches = findPhraseMappings(normalizedText);

    const sequence = [];
    let cursor = 0;

    const emitGap = (from, to) => {
        const gap = normalizedText.slice(from, to).trim();
        if (!gap) return;

        const words = gap.split(" ").filter(Boolean);
        const tokens = applyRules(words, from, normalizedText);

        for (const token of tokens) {
            const unit = resolveGloss(token);
            /* Unmapped words now stay in the sequence so the
               widget can show "no sign available" instead of the
               word simply disappearing. This matters for
               usability testing: a visible gap reads as an honest
               vocabulary limit, a silent drop reads as a bug. */
            sequence.push(unit);
        }
    };

    for (const match of phraseMatches) {
        emitGap(cursor, match.position);

        const videoData = getFSLVideo(match.dataset_id);

        sequence.push({
            ...match,
            type: "phrase",
            video: videoData ? videoData.video : null
        });

        cursor = match.end;
    }

    emitGap(cursor, normalizedText.length);

    return sequence;
}

/* ------------------------------------------------------------------ */
/* Video resolution                                                    */
/* ------------------------------------------------------------------ */

function getFSLVideo(datasetId) {

    const videoData = videoLookup[String(datasetId)];
    if (!videoData) return null;

    return {
        label: videoData.label,
        category: videoData.category,
        video: chrome.runtime.getURL(videoData.video)
    };
}