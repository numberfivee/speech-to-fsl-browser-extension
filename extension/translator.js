let fslDictionary = {};
let phraseMappings = {};
let videoLookup = {};


async function loadVideoLookup() {

    try {

        const videoURL =
            chrome.runtime.getURL(
                "video_lookup.json"
            );

        const response =
            await fetch(videoURL);

        videoLookup =
            await response.json();

        console.log(
            "FSL Video Lookup loaded:",
            videoLookup
        );

    } catch (error) {

        console.error(
            "Error loading FSL video lookup:",
            error
        );

    }
}

async function loadDictionary() {

    try {

        const dictionaryURL =
            chrome.runtime.getURL("dictionary.json");

        const response =
            await fetch(dictionaryURL);

        fslDictionary =
            await response.json();

        console.log(
            "FSL Dictionary loaded:",
            fslDictionary
        );

    } catch (error) {

        console.error(
            "Error loading dictionary:",
            error
        );
    }
}


async function loadPhraseMappings() {

    try {

        const mappingURL =
            chrome.runtime.getURL(
                "phrase_mappings.json"
            );

        const response =
            await fetch(mappingURL);

        phraseMappings =
            await response.json();

        console.log(
            "Phrase mappings loaded:",
            phraseMappings
        );

    } catch (error) {

        console.error(
            "Error loading phrase mappings:",
            error
        );
    }
}


function normalizeText(text) {

    return text
        .toLowerCase()
        .replace(/[.,!?;:¿¡]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}


function findPhraseMappings(text) {

    const normalizedText = normalizeText(text);

    const phrases = Object.keys(phraseMappings);

    const candidates = [];

    // Find every possible phrase match
    for (const phrase of phrases) {

        const normalizedPhrase =
            normalizeText(phrase);

        if (!normalizedPhrase) {
            continue;
        }

        // Escape special characters for RegExp
        const escapedPhrase =
            normalizedPhrase.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
            );

        // Match complete words/phrases only
        const regex = new RegExp(
            `(?:^|\\s)${escapedPhrase}(?=\\s|$)`,
            "g"
        );

        let match;

        while (
            (match = regex.exec(normalizedText)) !== null
        ) {

            const leadingSpace =
                match[0].startsWith(" ")
                    ? 1
                    : 0;

            const position =
                match.index + leadingSpace;

            candidates.push({
                phrase: phrase,
                position: position,
                end:
                    position +
                    normalizedPhrase.length,
                ...phraseMappings[phrase]
            });
        }
    }

    // First sort by position.
    // If phrases start at the same position,
    // prefer the longer phrase.
    candidates.sort((a, b) => {

        if (a.position !== b.position) {
            return a.position - b.position;
        }

        return (
            b.phrase.length -
            a.phrase.length
        );
    });

    // Remove overlapping matches
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


function processText(text) {

    let processedText =
        normalizeText(text);


    const stopWords = [
        "ay",
        "ang",
        "ng",
        "mga",
        "na",
        "si",
        "ni",
        "kay",
        "sa",
        "isang"
    ];


    let words =
        processedText.split(" ");


    words =
        words.filter(
            word =>
                !stopWords.includes(word)
        );


    return words;
}


function translateWords(words) {

    const translations = [];


    words.forEach((word) => {

        if (fslDictionary[word]) {

            translations.push({

                word: word,

                animation:
                    fslDictionary[word].animation,

                found: true

            });

        } else {

            translations.push({

                word: word,

                animation: null,

                found: false

            });
        }
    });


    return translations;
}


function getFSLVideo(datasetId) {

    const videoData =
        videoLookup[String(datasetId)];

    if (!videoData) {

        return null;

    }

    return {
        label: videoData.label,
        category: videoData.category,
        video: chrome.runtime.getURL(
            videoData.video
        )
    };
}