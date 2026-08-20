let fslDictionary = {};


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


function processText(text) {

    // Convert text to lowercase
    let processedText = text.toLowerCase();

    // Remove punctuation
    processedText =
        processedText.replace(/[.,!?;:]/g, "");

    // Remove extra spaces
    processedText =
        processedText.replace(/\s+/g, " ").trim();


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
            word => !stopWords.includes(word)
        );


    return words;
}


function translateWords(words) {

    const translations = [];

    words.forEach(word => {

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