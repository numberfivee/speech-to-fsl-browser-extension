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

        let finalTranscript = "";


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

                finalTranscript +=
                    transcript;

            } else {

                interimTranscript +=
                    transcript;

            }

        }


        const speechElement =
            document.getElementById(
                "recognized-speech"
            );


        if (speechElement) {

            speechElement.textContent =
                finalTranscript ||
                interimTranscript;

        }


        if (finalTranscript) {

            const phraseMatches =
                findPhraseMappings(
                    finalTranscript
                );

            const processedTextElement =
                document.getElementById(
                    "processed-text"
                );

            const translationDetails =
                document.getElementById(
                    "translation-details"
                );

            const animationElement =
                document.getElementById(
                    "fsl-animation"
                );

            if (phraseMatches.length > 0) {

                // Display recognized phrases in order
                if (processedTextElement) {
                    processedTextElement.textContent =
                        phraseMatches
                            .map(match => match.phrase)
                            .join(" + ");
                }

                // Create sequential FSL video player
                if (animationElement) {

                    animationElement.innerHTML = "";

                    animationElement.style.display = "block";
                    animationElement.style.width = "100%";
                    animationElement.style.boxSizing = "border-box";

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
                    mainVideo.style.margin = "0 auto 10px auto";

                    animationElement.appendChild(
                        mainVideo
                    );


                    // Currently playing phrase
                    const currentPhrase =
                        document.createElement("div");

                    currentPhrase.style.display = "block";
                    currentPhrase.style.width = "100%";
                    currentPhrase.style.boxSizing = "border-box";
                    currentPhrase.style.textAlign = "center";
                    currentPhrase.style.fontWeight = "bold";
                    currentPhrase.style.marginBottom = "12px";

                    animationElement.appendChild(
                        currentPhrase
                    );


                    // Phrase sequence title
                    const queueTitle =
                        document.createElement("div");

                    queueTitle.style.display = "block";
                    queueTitle.style.width = "100%";
                    queueTitle.style.boxSizing = "border-box";
                    queueTitle.style.fontWeight = "bold";
                    queueTitle.style.marginBottom = "6px";

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
                    phraseQueue.style.boxSizing = "border-box";
                    phraseQueue.style.border = "1px solid #ddd";
                    phraseQueue.style.borderRadius = "8px";
                    phraseQueue.style.padding = "6px";
                    phraseQueue.style.margin = "0 auto";

                    animationElement.appendChild(
                        phraseQueue
                    );


                    // Store queue items
                    const queueItems = [];


                    // Create queue
                    phraseMatches.forEach(
                        (phraseMatch, index) => {

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

                            queueItems.push(item);
                        }
                    );


                    // Keep track of the currently playing phrase
                    let currentIndex = 0;


                    function playPhrase(index) {

                        // No more phrases
                        if (
                            index >= phraseMatches.length
                        ) {

                            currentPhrase.textContent =
                                "✓ Translation complete";

                            return;
                        }


                        currentIndex = index;


                        const phraseMatch =
                            phraseMatches[index];


                        const videoData =
                            getFSLVideo(
                                phraseMatch.dataset_id
                            );


                        // If video is unavailable,
                        // skip to the next phrase
                        if (!videoData) {

                            queueItems[index].textContent =
                                `${index + 1}. ${phraseMatch.phrase} — Video unavailable`;

                            playPhrase(index + 1);

                            return;
                        }


                        // Update current phrase
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
                        queueItems[index].scrollIntoView({
                            behavior: "smooth",
                            block: "nearest"
                        });


                        // Change the main video
                        mainVideo.src =
                            videoData.video;


                        // Load the new video
                        mainVideo.load();


                        // Play the video
                        mainVideo.play()
                            .catch(error => {

                                console.error(
                                    "Unable to play FSL video:",
                                    error
                                );

                            });
                    }


                    // When the current video finishes,
                    // play the next phrase
                    mainVideo.addEventListener(
                        "ended",
                        () => {

                            playPhrase(
                                currentIndex + 1
                            );

                        }
                    );


                    // Start the first phrase
                    playPhrase(0);
                }

                // Display translation information
                if (translationDetails) {

                    translationDetails.innerHTML =
                        phraseMatches
                            .map(
                                (phraseMatch, index) => {

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
                    "Phrase Matches:",
                    phraseMatches
                );

            } else {

                if (processedTextElement) {
                    processedTextElement.textContent =
                        "No matching FSL phrase found.";
                }

                if (animationElement) {
                    animationElement.innerHTML =
                        "FSL video not available.";
                }

                if (translationDetails) {
                    translationDetails.innerHTML = `
                        <p>
                            No FSL phrase mapping found.
                        </p>
                    `;
                }

                console.log(
                    "No FSL phrase mapping found."
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