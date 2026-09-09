let fslDictionary = {};
let phraseMappings = {};


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


function findPhraseMapping(text) {

    const normalizedText =
        normalizeText(text);


    // Exact match
    if (phraseMappings[normalizedText]) {

        return {
            phrase: normalizedText,
            ...phraseMappings[normalizedText]
        };
    }


    // Longer phrases first
    const phrases =
        Object.keys(phraseMappings)
            .sort(
                (a, b) =>
                    b.length - a.length
            );


    for (const phrase of phrases) {

        if (normalizedText.includes(phrase)) {

            return {
                phrase: phrase,
                ...phraseMappings[phrase]
            };
        }
    }


    return null;
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