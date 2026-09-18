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


            // ----------------------------------------------------
            // CHECK IF PHRASES WERE FOUND
            // ----------------------------------------------------

            if (phraseMatches.length > 0) {


                // ------------------------------------------------
                // DISPLAY ALL MATCHED PHRASES
                // ------------------------------------------------

                if (processedTextElement) {

                    processedTextElement.textContent =
                        phraseMatches
                            .map(match => match.phrase)
                            .join(" + ");

                }


                // ------------------------------------------------
                // CLEAR PREVIOUS VIDEOS
                // ------------------------------------------------

                if (animationElement) {

                    animationElement.innerHTML = "";

                }


                // ------------------------------------------------
                // DISPLAY EACH FSL VIDEO
                // ------------------------------------------------

                phraseMatches.forEach(
                    (phraseMatch, index) => {

                        const videoData =
                            getFSLVideo(
                                phraseMatch.dataset_id
                            );


                        if (
                            animationElement &&
                            videoData
                        ) {

                            const container =
                                document.createElement(
                                    "div"
                                );


                            container.style.marginBottom =
                                "15px";


                            const title =
                                document.createElement(
                                    "p"
                                );


                            title.innerHTML =
                                `<strong>
                                    ${index + 1}.
                                    ${phraseMatch.phrase}
                                </strong>`;


                            const video =
                                document.createElement(
                                    "video"
                                );


                            video.src =
                                videoData.video;


                            video.controls =
                                true;


                            video.autoplay =
                                index === 0;


                            video.loop =
                                true;


                            video.muted =
                                true;


                            video.playsInline =
                                true;


                            video.style.width =
                                "100%";


                            video.style.maxWidth =
                                "400px";


                            video.style.borderRadius =
                                "10px";


                            container.appendChild(
                                title
                            );


                            container.appendChild(
                                video
                            );


                            animationElement.appendChild(
                                container
                            );

                        }

                    }
                );


                // ------------------------------------------------
                // DISPLAY TRANSLATION DETAILS
                // ------------------------------------------------

                if (translationDetails) {

                    translationDetails.innerHTML = `

                        <p>
                            <strong>
                                ✓ ${phraseMatches.length}
                                Phrase(s) Found
                            </strong>
                        </p>

                    `;


                    phraseMatches.forEach(
                        (phraseMatch, index) => {

                            const videoData =
                                getFSLVideo(
                                    phraseMatch.dataset_id
                                );


                            translationDetails.innerHTML += `

                                <hr>

                                <p>
                                    <strong>
                                        Phrase ${index + 1}:
                                    </strong>

                                    ${phraseMatch.phrase}
                                </p>

                                <p>
                                    <strong>
                                        FSL-105 Label:
                                    </strong>

                                    ${phraseMatch.dataset_label}
                                </p>

                                <p>
                                    <strong>
                                        Dataset ID:
                                    </strong>

                                    ${phraseMatch.dataset_id}
                                </p>

                                <p>
                                    <strong>
                                        Category:
                                    </strong>

                                    ${phraseMatch.category}
                                </p>

                                <p>
                                    <strong>
                                        Source:
                                    </strong>

                                    ${phraseMatch.source}
                                </p>

                                <p>
                                    <strong>
                                        Video:
                                    </strong>

                                    ${
                                        videoData
                                            ? "Available"
                                            : "Not available"
                                    }
                                </p>

                            `;

                        }
                    );

                }


                // ------------------------------------------------
                // DEBUGGING INFORMATION
                // ------------------------------------------------

                console.log(
                    "Phrase Matches:",
                    phraseMatches
                );


            } else {

                if (processedTextElement) {

                    processedTextElement.textContent =
                        "No FSL phrase mapping found.";

                }


                if (animationElement) {

                    animationElement.innerHTML =
                        "No FSL translation available.";

                }


                if (translationDetails) {

                    translationDetails.innerHTML = `
                        <p>
                            No matching FSL phrase found.
                        </p>
                    `;

                }


                console.log(
                    "No phrase mappings found for:",
                    finalTranscript
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