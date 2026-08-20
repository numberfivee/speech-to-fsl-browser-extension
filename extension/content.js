chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "startTranslation") {
        createTranslatorWidget();

        loadDictionary().then(() => {
            startSpeechRecognition();
        });
    }

    if (message.action === "stopTranslation") {
        stopSpeechRecognition();
        removeTranslatorWidget();
    }
});

let recognition = null;


function createTranslatorWidget() {
    // Prevent multiple widgets
    if (document.getElementById("speech-to-fsl-widget")) {
        return;
    }

    const widget = document.createElement("div");

    widget.id = "speech-to-fsl-widget";

    widget.innerHTML = `
        <div class="fsl-header">
            <h2>Speech to FSL</h2>

            <button id="fsl-close-btn">×</button>
        </div>

        <div class="fsl-content">

            <div class="fsl-section">
                <h3>Recognized Speech</h3>

                <p id="recognized-speech">
                    Waiting for speech...
                </p>
            </div>

            <div class="fsl-section">
                <h3>Processed Text</h3>

                <p id="processed-text">
                    Waiting for processing...
                </p>
            </div>

            <div class="fsl-section">
                <h3>FSL Translation</h3>

                <div id="fsl-animation">
                    Waiting for translation...
                </div>

                <div id="translation-details">
                    No translation yet.
                </div>
            </div>

        </div>
    `;

    document.body.appendChild(widget);

    document
        .getElementById("fsl-close-btn")
        .addEventListener("click", () => {
            stopSpeechRecognition();
            removeTranslatorWidget();
        });
}


function removeTranslatorWidget() {
    const widget = document.getElementById("speech-to-fsl-widget");

    if (widget) {
        widget.remove();
    }
}


function startSpeechRecognition() {
    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        document.getElementById("recognized-speech").textContent =
            "Speech recognition is not supported.";

        return;
    }

    recognition = new SpeechRecognition();

    recognition.lang = "fil-PH";
    recognition.continuous = true;
    recognition.interimResults = true;


    recognition.onstart = () => {
        const speechElement =
            document.getElementById("recognized-speech");

        if (speechElement) {
            speechElement.textContent = "Listening...";
        }
    };


    recognition.onresult = (event) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (
            let i = event.resultIndex;
            i < event.results.length;
            i++
        ) {
            const transcript =
                event.results[i][0].transcript;

            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            } else {
                interimTranscript += transcript;
            }
        }


        const speechElement =
            document.getElementById("recognized-speech");

        if (speechElement) {
            speechElement.textContent =
                finalTranscript || interimTranscript;
        }


        // Process only final speech results
        if (finalTranscript) {

            // Rule-based NLP
            const processedWords =
                processText(finalTranscript);


            const processedTextElement =
                document.getElementById("processed-text");

            if (processedTextElement) {
                processedTextElement.textContent =
                    processedWords.join(" ");
            }


            // Map processed words to FSL dictionary
            const translations =
                translateWords(processedWords);


            const translationDetails =
                document.getElementById("translation-details");

            if (translationDetails) {
                translationDetails.innerHTML = "";

                translations.forEach((item) => {
                    const translationItem =
                        document.createElement("p");

                    if (item.found) {
                        translationItem.textContent =
                            `✓ ${item.word} → Sign found`;
                    } else {
                        translationItem.textContent =
                            `✗ ${item.word} → Sign not found`;
                    }

                    translationDetails.appendChild(
                        translationItem
                    );
                });
            }


            console.log(
                "Original:",
                finalTranscript
            );

            console.log(
                "Processed:",
                processedWords
            );

            console.log(
                "Translations:",
                translations
            );
        }
    };


    recognition.onerror = (event) => {
        console.error(
            "Speech recognition error:",
            event.error
        );

        const speechElement =
            document.getElementById("recognized-speech");

        if (speechElement) {
            speechElement.textContent =
                "Error: " + event.error;
        }
    };


    recognition.onend = () => {
        console.log(
            "Speech recognition stopped."
        );
    };


    recognition.start();
}


function stopSpeechRecognition() {
    if (recognition) {
        recognition.stop();
        recognition = null;
    }
}