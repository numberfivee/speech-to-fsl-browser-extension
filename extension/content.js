chrome.runtime.onMessage.addListener((message) => {

    if (message.action === "startTranslation") {

        createTranslatorWidget();

        Promise.all([
            loadDictionary(),
            loadPhraseMappings(),
            loadVideoLookup()
        ])
        .then(() => {

            console.log(
                "All translation resources loaded."
            );

            startSpeechRecognition();

        })
        .catch((error) => {

            console.error(
                "Failed to load translation resources:",
                error
            );

            const speechElement =
                document.getElementById(
                    "recognized-speech"
                );

            if (speechElement) {

                speechElement.textContent =
                    "Failed to load FSL translation resources.";

            }

        });
    }


    if (message.action === "stopTranslation") {

        stopSpeechRecognition();

        removeTranslatorWidget();

    }

});


let recognition = null;

let isTranslationActive = false;

let accumulatedFinalTranscript = "";

let fslPlaybackState = {
    phraseMatches: [],
    phraseKeys: [],
    currentIndex: -1,
    mainVideo: null,
    currentPhrase: null,
    queueItems: [],
    initialized: false
};


function resetTranslationState() {

    accumulatedFinalTranscript = "";

    fslPlaybackState = {
        phraseMatches: [],
        phraseKeys: [],
        currentIndex: -1,
        mainVideo: null,
        currentPhrase: null,
        queueItems: [],
        initialized: false
    };

}


function createTranslatorWidget() {

    if (
        document.getElementById(
            "speech-to-fsl-widget"
        )
    ) {
        return;
    }


    const widget =
        document.createElement("div");


    widget.id =
        "speech-to-fsl-widget";


    widget.innerHTML = `

        <div class="fsl-header">

            <h2>Speech to FSL</h2>

            <button id="fsl-close-btn">
                ×
            </button>

        </div>


        <div class="fsl-content">


            <div class="fsl-section">

                <h3>
                    Recognized Speech
                </h3>

                <p id="recognized-speech">
                    Waiting for speech...
                </p>

            </div>


            <div class="fsl-section">

                <h3>
                    Processed Text
                </h3>

                <p id="processed-text">
                    Waiting for processing...
                </p>

            </div>


            <div class="fsl-section">

                <h3>
                    FSL Translation
                </h3>

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

    const widget =
        document.getElementById(
            "speech-to-fsl-widget"
        );


    if (widget) {

        widget.remove();

    }

}


function initializeFSLPlayer() {

    const animationElement =
        document.getElementById(
            "fsl-animation"
        );

    if (!animationElement) {
        return;
    }

    // Do not recreate the player
    if (fslPlaybackState.initialized) {
        return;
    }

    animationElement.innerHTML = "";

    animationElement.style.display = "block";
    animationElement.style.width = "100%";
    animationElement.style.boxSizing =
        "border-box";


    // Main video
    const mainVideo =
        document.createElement("video");

    mainVideo.controls = true;
    mainVideo.muted = true;
    mainVideo.playsInline = true;

    mainVideo.style.display = "block";
    mainVideo.style.width = "100%";
    mainVideo.style.maxWidth = "400px";
    mainVideo.style.height = "auto";
    mainVideo.style.maxHeight = "300px";
    mainVideo.style.objectFit = "contain";
    mainVideo.style.boxSizing = "border-box";
    mainVideo.style.borderRadius = "10px";
    mainVideo.style.margin =
        "0 auto 10px auto";

    animationElement.appendChild(
        mainVideo
    );


    // Current phrase
    const currentPhrase =
        document.createElement("div");

    currentPhrase.style.display = "block";
    currentPhrase.style.width = "100%";
    currentPhrase.style.boxSizing =
        "border-box";
    currentPhrase.style.textAlign = "center";
    currentPhrase.style.fontWeight = "bold";
    currentPhrase.style.marginBottom =
        "12px";

    animationElement.appendChild(
        currentPhrase
    );


    // Queue title
    const queueTitle =
        document.createElement("div");

    queueTitle.textContent =
        "Phrase Sequence";

    queueTitle.style.display = "block";
    queueTitle.style.width = "100%";
    queueTitle.style.boxSizing =
        "border-box";
    queueTitle.style.fontWeight = "bold";
    queueTitle.style.marginBottom =
        "6px";

    animationElement.appendChild(
        queueTitle
    );


    // Phrase queue
    const phraseQueue =
        document.createElement("div");

    phraseQueue.style.display = "block";
    phraseQueue.style.width = "100%";
    phraseQueue.style.maxWidth = "400px";
    phraseQueue.style.maxHeight = "150px";
    phraseQueue.style.overflowY = "auto";
    phraseQueue.style.boxSizing =
        "border-box";
    phraseQueue.style.border =
        "1px solid #ddd";
    phraseQueue.style.borderRadius =
        "8px";
    phraseQueue.style.padding = "6px";
    phraseQueue.style.margin = "0 auto";

    animationElement.appendChild(
        phraseQueue
    );


    fslPlaybackState.mainVideo =
        mainVideo;

    fslPlaybackState.currentPhrase =
        currentPhrase;

    fslPlaybackState.phraseQueue =
        phraseQueue;

    fslPlaybackState.initialized =
        true;


    // Move to the next phrase
    mainVideo.addEventListener(
        "ended",
        () => {

            const nextIndex =
                fslPlaybackState.currentIndex +
                1;

            playPhrase(nextIndex);

        }
    );

}


function playPhrase(index) {

    const phraseMatches =
        fslPlaybackState.phraseMatches;

    const mainVideo =
        fslPlaybackState.mainVideo;

    const currentPhrase =
        fslPlaybackState.currentPhrase;

    const queueItems =
        fslPlaybackState.queueItems;


    if (!mainVideo) {
        return;
    }


    // No more phrases
    if (
        index >= phraseMatches.length
    ) {

        currentPhrase.textContent =
            "✓ Translation complete";

        fslPlaybackState.currentIndex =
            phraseMatches.length - 1;

        return;
    }


    const phraseMatch =
        phraseMatches[index];


    const videoData =
        getFSLVideo(
            phraseMatch.dataset_id
        );


    // Skip phrases without videos
    if (!videoData) {

        if (queueItems[index]) {

            queueItems[index].textContent =
                `${index + 1}. ${phraseMatch.phrase} — Video unavailable`;

        }

        playPhrase(index + 1);

        return;
    }


    fslPlaybackState.currentIndex =
        index;


    // Current phrase
    currentPhrase.textContent =
        `▶ ${phraseMatch.phrase}`;


    // Update queue
    queueItems.forEach(
        (item, itemIndex) => {

            if (itemIndex < index) {

                item.textContent =
                    `✓ ${itemIndex + 1}. ${phraseMatches[itemIndex].phrase}`;

            } else if (
                itemIndex === index
            ) {

                item.textContent =
                    `▶ ${itemIndex + 1}. ${phraseMatches[itemIndex].phrase}`;

            } else {

                item.textContent =
                    `○ ${itemIndex + 1}. ${phraseMatches[itemIndex].phrase}`;

            }

        }
    );


    // Scroll current phrase into view
    if (queueItems[index]) {

        queueItems[index].scrollIntoView({
            behavior: "smooth",
            block: "nearest"
        });

    }


    // Change video
    mainVideo.src =
        videoData.video;

    mainVideo.load();


    // Play
    mainVideo.play()
        .catch(error => {

            console.error(
                "Unable to play FSL video:",
                error
            );

        });

}


function startSpeechRecognition() {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;


    if (!SpeechRecognition) {

        const element =
            document.getElementById(
                "recognized-speech"
            );


        if (element) {

            element.textContent =
                "Speech recognition is not supported.";

        }

        return;
    }


    // Prevent multiple recognition sessions
    if (recognition) {

        console.log(
            "Speech recognition is already running."
        );

        return;
    }

    resetTranslationState();

    isTranslationActive = true;

    recognition =
        new SpeechRecognition();


    recognition.lang =
        "fil-PH";


    recognition.continuous =
        true;


    recognition.interimResults =
        true;


    recognition.onstart = () => {

        const speechElement =
            document.getElementById(
                "recognized-speech"
            );


        if (speechElement) {

            speechElement.textContent =
                "Listening...";

        }

    };


    recognition.onresult = (event) => {

        let interimTranscript = "";
        let newFinalTranscript = "";


        for (
            let i = event.resultIndex;
            i < event.results.length;
            i++
        ) {

            const transcript =
                event.results[i][0]
                    .transcript;


            if (
                event.results[i].isFinal
            ) {

                newFinalTranscript +=
                    transcript;

            } else {

                interimTranscript +=
                    transcript;

            }

        }


        // Add only newly finalized speech
        if (newFinalTranscript) {

            accumulatedFinalTranscript +=
                " " +
                newFinalTranscript;

            accumulatedFinalTranscript =
                accumulatedFinalTranscript
                    .replace(/\s+/g, " ")
                    .trim();

        }


        // Display accumulated speech + current interim speech
        const speechElement =
            document.getElementById(
                "recognized-speech"
            );


        if (speechElement) {

            const displayText =
                (
                    accumulatedFinalTranscript +
                    " " +
                    interimTranscript
                )
                .replace(/\s+/g, " ")
                .trim();


            speechElement.textContent =
                displayText ||
                "Listening...";

        }


        // Only translate finalized speech
        if (
            accumulatedFinalTranscript
        ) {

            const phraseMatches =
                findPhraseMappings(
                    accumulatedFinalTranscript
                );


            const processedTextElement =
                document.getElementById(
                    "processed-text"
                );


            const translationDetails =
                document.getElementById(
                    "translation-details"
                );


            if (
                phraseMatches.length > 0
            ) {

                // Display all recognized phrases
                if (
                    processedTextElement
                ) {

                    processedTextElement.textContent =
                        phraseMatches
                            .map(
                                match =>
                                    match.phrase
                            )
                            .join(" + ");

                }


                // Update persistent FSL queue
                updateFSLTranslation(
                    phraseMatches
                );


                // Display translation details
                if (
                    translationDetails
                ) {

                    translationDetails.innerHTML =
                        phraseMatches
                            .map(
                                (
                                    phraseMatch,
                                    index
                                ) => {

                                    return `
                                        <div style="margin-bottom: 10px;">
                                            <p>
                                                <strong>
                                                    ✓ Phrase ${index + 1}
                                                </strong>
                                            </p>

                                            <p>
                                                Input:
                                                ${phraseMatch.phrase}
                                            </p>

                                            <p>
                                                FSL-105 Label:
                                                ${phraseMatch.dataset_label}
                                            </p>

                                            <p>
                                                Dataset ID:
                                                ${phraseMatch.dataset_id}
                                            </p>

                                            <p>
                                                Category:
                                                ${phraseMatch.category}
                                            </p>

                                            <p>
                                                Source:
                                                ${phraseMatch.source}
                                            </p>
                                        </div>
                                    `;

                                }
                            )
                            .join("");

                }


                console.log(
                    "Accumulated Speech:",
                    accumulatedFinalTranscript
                );


                console.log(
                    "Phrase Matches:",
                    phraseMatches
                );

            }

        }

    };


    recognition.onerror =
        (event) => {

            console.error(
                "Speech recognition error:",
                event.error
            );


            const speechElement =
                document.getElementById(
                    "recognized-speech"
                );


            if (speechElement) {

                speechElement.textContent =
                    "Error: " +
                    event.error;

            }

        };


    recognition.onend = () => {

        console.log(
            "Speech recognition session ended."
        );


        // Only restart if the translator
        // is still supposed to be active
        if (isTranslationActive) {

            console.log(
                "Restarting speech recognition..."
            );


            setTimeout(() => {

                if (
                    !isTranslationActive ||
                    !recognition
                ) {
                    return;
                }


                try {

                    recognition.start();

                } catch (error) {

                    console.error(
                        "Unable to restart speech recognition:",
                        error
                    );

                }

            }, 300);

        }

    };


    recognition.start();

}


function stopSpeechRecognition() {

    isTranslationActive = false;


    if (recognition) {

        recognition.stop();

        recognition = null;

    }


    resetTranslationState();

}


function updateFSLTranslation(
    phraseMatches
) {

    if (
        !phraseMatches ||
        phraseMatches.length === 0
    ) {
        return;
    }


    initializeFSLPlayer();


    // Find only NEW phrase matches
    const newMatches = [];


    phraseMatches.forEach(
        (phraseMatch) => {

            const key =
                `${phraseMatch.position}|` +
                `${phraseMatch.phrase}|` +
                `${phraseMatch.dataset_id}`;


            if (
                !fslPlaybackState.phraseKeys.includes(
                    key
                )
            ) {

                fslPlaybackState.phraseKeys.push(
                    key
                );

                newMatches.push(
                    phraseMatch
                );

            }

        }
    );


    if (newMatches.length === 0) {

        return;

    }


    // Add new phrases to existing queue
    fslPlaybackState.phraseMatches.push(
        ...newMatches
    );


    const phraseQueue =
        fslPlaybackState.phraseQueue;


    // Create queue items only for new phrases
    newMatches.forEach(
        (phraseMatch) => {

            const index =
                fslPlaybackState.queueItems.length;


            const item =
                document.createElement("div");


            item.textContent =
                `${index + 1}. ${phraseMatch.phrase}`;


            item.style.padding =
                "8px";

            item.style.borderRadius =
                "5px";

            item.style.marginBottom =
                "3px";

            item.style.fontSize =
                "14px";


            phraseQueue.appendChild(
                item
            );


            fslPlaybackState.queueItems.push(
                item
            );

        }
    );


    // Start playback if nothing is currently playing
    const mainVideo =
        fslPlaybackState.mainVideo;


    if (!mainVideo) {
        return;
    }


    if (
        mainVideo.paused ||
        mainVideo.ended
    ) {

        const nextIndex =
            fslPlaybackState.currentIndex + 1;


        if (
            nextIndex <
            fslPlaybackState.phraseMatches.length
        ) {

            playPhrase(nextIndex);

        }

    }

}