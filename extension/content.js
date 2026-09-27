chrome.runtime.onMessage.addListener((message) => {

    if (message.action === "startTranslation") {

        createTranslatorWidget();

        Promise.all([
            loadDictionary(),
            loadPhraseMappings(),
            loadVideoLookup(),
            loadAlphabet()
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


/*
 * Accumulated transcript is capped so a long lecture doesn't grow
 * an unbounded string / unbounded DOM queue. When it's trimmed we
 * also drop matched sequence items that fall before the new start,
 * which is handled naturally by updateFSLTranslation's key diffing
 * as long as we trim on a phrase boundary (a space).
 */
const MAX_TRANSCRIPT_CHARS = 800;

let recognition = null;

let isTranslationActive = false;

let accumulatedFinalTranscript = "";

let fslPlaybackState = {
    phraseMatches: [],
    phraseKeys: [],
    currentIndex: -1,
    mainVideo: null,
    letterImage: null,
    letterCaption: null,
    currentPhrase: null,
    queueItems: [],
    initialized: false,
    /* fingerspelling sub-state */
    fingerspellLetters: null,
    fingerspellIndex: -1,
    fingerspellTimeoutId: null
};

/* Latency measurement (Eq. 3.3): timestamp of the most recent
   finalized speech result, cleared once its first sign has
   rendered. See recordLatencySample(). */
let pendingLatencyInput = null;

/* Accumulated samples for this session, exportable as CSV via
   window.__fslExportSessionLog() (see bottom of file) or a
   popup button wired to the same message. */
let latencySamples = [];


function resetTranslationState() {

    accumulatedFinalTranscript = "";

    if (
        fslPlaybackState &&
        fslPlaybackState.fingerspellTimeoutId
    ) {
        clearTimeout(
            fslPlaybackState.fingerspellTimeoutId
        );
    }

    fslPlaybackState = {
        phraseMatches: [],
        phraseKeys: [],
        currentIndex: -1,
        mainVideo: null,
        letterImage: null,
        letterCaption: null,
        currentPhrase: null,
        queueItems: [],
        initialized: false,
        fingerspellLetters: null,
        fingerspellIndex: -1,
        fingerspellTimeoutId: null
    };

    pendingLatencyInput = null;

}


/*
 * Captures t_output (Eq. 3.3) the moment a sign actually renders
 * on screen — either a video's 'playing' event, or the first
 * frame of a fingerspelled word. Pairs it with the most recent
 * t_input (when that speech was finalized) and stores one sample.
 *
 * Deliberately coarse: it measures "time from finalized speech to
 * the first sign of that utterance appearing," not per-word
 * latency. That matches how Eq. 3.3 is defined in the methodology
 * (system latency, not per-token latency) and avoids needing to
 * disambiguate which ASR result produced which specific queue item.
 */
function recordLatencySample() {

    if (!pendingLatencyInput) {
        return;
    }

    const outputTimestamp = performance.now();

    const latencyMs = Math.round(
        outputTimestamp - pendingLatencyInput.timestamp
    );

    latencySamples.push({
        timestamp: new Date().toISOString(),
        transcript: pendingLatencyInput.transcript,
        latency_ms: latencyMs
    });

    console.log(
        "Latency sample (ms):",
        latencyMs,
        "for:",
        pendingLatencyInput.transcript
    );

    // Each ASR result should only be credited with one sample.
    pendingLatencyInput = null;

}


/*
 * Exports accumulated latency samples as a CSV download. Call
 * from the DevTools console during testing (window.__fslExportSessionLog()),
 * or wire a button in popup.js that sends a message this content
 * script listens for.
 */
function exportSessionLog() {

    if (latencySamples.length === 0) {
        console.warn("No latency samples recorded yet.");
        return;
    }

    const header = "timestamp,transcript,latency_ms\n";

    const rows = latencySamples
        .map(sample => {

            // Escape quotes/commas in the transcript for CSV safety.
            const safeTranscript =
                `"${sample.transcript.replace(/"/g, '""')}"`;

            return `${sample.timestamp},${safeTranscript},${sample.latency_ms}`;

        })
        .join("\n");

    const csvContent = header + rows;

    const blob = new Blob(
        [csvContent],
        { type: "text/csv" }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download =
        `fsl_latency_log_${Date.now()}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    console.log(
        `Exported ${latencySamples.length} latency samples.`
    );

}

window.__fslExportSessionLog = exportSessionLog;


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


/*
 * A single label for any queue-item type: a matched phrase,
 * a dictionary word, or a fingerspelled word.
 */
function labelForUnit(unit) {

    if (unit.type === "fingerspell") {
        return `${unit.phrase} (fingerspelled)`;
    }

    if (unit.type === "unmapped") {
        return `${unit.phrase} — no sign yet`;
    }

    return unit.phrase;
}


/* Applies a dimmed, italic style to queue items for words that
   have no FSL representation yet, so the gap reads as a known
   vocabulary limit rather than a rendering glitch. */
function styleQueueItem(item, unit) {

    if (unit.type === "unmapped") {
        item.style.opacity = "0.55";
        item.style.fontStyle = "italic";
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


    /*
     * Fingerspelling display. The FSL alphabet dataset is IMAGES,
     * not video, so letters render here instead of in mainVideo.
     * Only one of the two is visible at a time.
     */
    const letterImage =
        document.createElement("img");

    letterImage.style.display = "none";
    letterImage.style.width = "100%";
    letterImage.style.maxWidth = "400px";
    letterImage.style.height = "auto";
    letterImage.style.maxHeight = "300px";
    letterImage.style.objectFit = "contain";
    letterImage.style.boxSizing = "border-box";
    letterImage.style.borderRadius = "10px";
    letterImage.style.margin =
        "0 auto 10px auto";

    animationElement.appendChild(
        letterImage
    );


    // Caption under the fingerspelling image, e.g. "A - K - O"
    const letterCaption =
        document.createElement("div");

    letterCaption.style.display = "none";
    letterCaption.style.textAlign = "center";
    letterCaption.style.fontSize = "13px";
    letterCaption.style.letterSpacing = "2px";
    letterCaption.style.marginBottom = "8px";
    letterCaption.style.color = "#555";

    animationElement.appendChild(
        letterCaption
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

    fslPlaybackState.letterImage =
        letterImage;

    fslPlaybackState.letterCaption =
        letterCaption;

    fslPlaybackState.currentPhrase =
        currentPhrase;

    fslPlaybackState.phraseQueue =
        phraseQueue;

    fslPlaybackState.initialized =
        true;


    // Move to the next unit / next fingerspelled letter
    mainVideo.addEventListener(
        "ended",
        handleVideoEnded
    );

    /* Latency sample point: Eq. 3.3, t_output. Fires the moment
       a sign actually starts rendering on screen. */
    mainVideo.addEventListener(
        "playing",
        recordLatencySample
    );

}


function handleVideoEnded() {

    /* Fingerspelling now advances on its own timer (images have
       no 'ended' event), so this handler only ever fires for
       real sign videos. */
    const nextIndex =
        fslPlaybackState.currentIndex + 1;

    playPhrase(nextIndex);

}


/* How long each fingerspelled letter is shown on screen. */
const FINGERSPELL_LETTER_MS = 650;


function playFingerspellLetter(letterIndex) {

    const letterImage = fslPlaybackState.letterImage;
    const letterCaption = fslPlaybackState.letterCaption;
    const letters = fslPlaybackState.fingerspellLetters;

    if (!letterImage || !letters || !letters[letterIndex]) {
        return;
    }

    fslPlaybackState.fingerspellIndex = letterIndex;

    letterImage.src = letters[letterIndex].image;

    letterCaption.textContent =
        letters
            .map((entry, i) =>
                i === letterIndex
                    ? entry.letter.toUpperCase()
                    : entry.letter.toLowerCase()
            )
            .join(" - ");

    /* First letter of a fingerspelled word is the latency
       sample point for this unit, mirroring the 'playing'
       event used for real sign videos. */
    if (letterIndex === 0) {
        recordLatencySample();
    }

    if (fslPlaybackState.fingerspellTimeoutId) {
        clearTimeout(fslPlaybackState.fingerspellTimeoutId);
    }

    fslPlaybackState.fingerspellTimeoutId = setTimeout(() => {

        const nextLetterIndex = letterIndex + 1;

        if (nextLetterIndex < letters.length) {
            playFingerspellLetter(nextLetterIndex);
            return;
        }

        // Fingerspelled word finished; resume the normal queue.
        fslPlaybackState.fingerspellLetters = null;
        fslPlaybackState.fingerspellIndex = -1;
        fslPlaybackState.fingerspellTimeoutId = null;

        playPhrase(fslPlaybackState.currentIndex + 1);

    }, FINGERSPELL_LETTER_MS);

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


    // No more units
    if (
        index >= phraseMatches.length
    ) {

        currentPhrase.textContent =
            "✓ Translation complete";

        fslPlaybackState.currentIndex =
            phraseMatches.length - 1;

        return;
    }


    const unit =
        phraseMatches[index];


    fslPlaybackState.currentIndex =
        index;


    // Current phrase
    currentPhrase.textContent =
        `▶ ${labelForUnit(unit)}`;


    // Update queue
    queueItems.forEach(
        (item, itemIndex) => {

            if (itemIndex < index) {

                item.textContent =
                    `✓ ${itemIndex + 1}. ${labelForUnit(phraseMatches[itemIndex])}`;

            } else if (
                itemIndex === index
            ) {

                item.textContent =
                    `▶ ${itemIndex + 1}. ${labelForUnit(phraseMatches[itemIndex])}`;

            } else {

                item.textContent =
                    `○ ${itemIndex + 1}. ${labelForUnit(phraseMatches[itemIndex])}`;

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


    /*
     * Fingerspelled words: display each letter image in order,
     * then fall through to the next unit automatically once the
     * fingerspelling timer finishes.
     */
    if (unit.type === "fingerspell") {

        mainVideo.pause();
        mainVideo.style.display = "none";

        fslPlaybackState.letterImage.style.display = "block";
        fslPlaybackState.letterCaption.style.display = "block";

        fslPlaybackState.fingerspellLetters =
            unit.letters;

        playFingerspellLetter(0);

        return;
    }


    // Returning to a real sign video: hide the letter display
    fslPlaybackState.letterImage.style.display = "none";
    fslPlaybackState.letterCaption.style.display = "none";
    mainVideo.style.display = "block";

    if (fslPlaybackState.fingerspellTimeoutId) {
        clearTimeout(fslPlaybackState.fingerspellTimeoutId);
        fslPlaybackState.fingerspellTimeoutId = null;
    }

    fslPlaybackState.fingerspellLetters = null;
    fslPlaybackState.fingerspellIndex = -1;


    // Skip units without a resolved video (phrase or word alike)
    if (!unit.video) {

        if (queueItems[index]) {

            const reason =
                unit.type === "unmapped"
                    ? "no sign yet"
                    : "video unavailable";

            queueItems[index].textContent =
                `${index + 1}. ${unit.phrase} — ${reason}`;

        }

        playPhrase(index + 1);

        return;
    }


    // Change video
    mainVideo.src =
        unit.video;

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

        /* Timestamp captured at the moment audio produced a
           result, for latency = t_output - t_input (Eq. 3.3). */
        const inputTimestamp =
            performance.now();

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

            /*
             * Cap the transcript so translation cost stays
             * bounded during long sessions. Trim on a word
             * boundary so we never cut a phrase mid-word.
             */
            if (
                accumulatedFinalTranscript.length >
                    MAX_TRANSCRIPT_CHARS
            ) {

                const overflow =
                    accumulatedFinalTranscript.length -
                    MAX_TRANSCRIPT_CHARS;

                const cutPoint =
                    accumulatedFinalTranscript.indexOf(
                        " ",
                        overflow
                    );

                accumulatedFinalTranscript =
                    cutPoint === -1
                        ? accumulatedFinalTranscript
                        : accumulatedFinalTranscript.slice(
                            cutPoint + 1
                        );

            }

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


        /*
         * Only re-run translation when new speech was finalized.
         * Re-matching against every interim result (several times
         * per second) is unnecessary work and was the main cost
         * driver in the previous version.
         */
        if (!newFinalTranscript) {
            return;
        }

        if (!accumulatedFinalTranscript) {
            return;
        }

        const sequence =
            buildFSLSequence(
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


        if (sequence.length > 0) {

            // Display all recognized units
            if (processedTextElement) {

                processedTextElement.textContent =
                    sequence
                        .map(unit => labelForUnit(unit))
                        .join(" + ");

            }


            // Update persistent FSL queue
            updateFSLTranslation(sequence);


            // Display translation details
            if (translationDetails) {

                translationDetails.innerHTML =
                    sequence
                        .map((unit, index) => {

                            return `
                                <div style="margin-bottom: 10px;">
                                    <p>
                                        <strong>
                                            ✓ Unit ${index + 1}
                                            (${unit.type})
                                        </strong>
                                    </p>

                                    <p>
                                        Input:
                                        ${unit.phrase}
                                    </p>

                                    <p>
                                        FSL Label:
                                        ${unit.dataset_label}
                                    </p>

                                    <p>
                                        Dataset ID:
                                        ${
                                            unit.dataset_id ??
                                            "—"
                                        }
                                    </p>

                                    <p>
                                        Category:
                                        ${unit.category}
                                    </p>

                                    <p>
                                        Source:
                                        ${unit.source ?? "—"}
                                    </p>
                                </div>
                            `;

                        })
                        .join("");

            }


            /*
             * t_input for Eq. 3.3. t_output is captured
             * separately in recordLatencySample(), fired when
             * the corresponding sign (video 'playing', or the
             * first fingerspelled letter) actually reaches the
             * screen — not merely when the sequence was computed.
             */
            pendingLatencyInput = {
                timestamp: inputTimestamp,
                transcript: accumulatedFinalTranscript
            };


            console.log(
                "Accumulated Speech:",
                accumulatedFinalTranscript
            );


            console.log(
                "FSL Sequence:",
                sequence
            );

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


/*
 * A stable identity for a queue unit. Works for phrase matches,
 * dictionary words, and fingerspelled words alike, since all of
 * them carry position/phrase/dataset_id from buildFSLSequence().
 */
function createUnitKey(unit) {
    return (
        `${unit.position}|` +
        `${unit.phrase}|` +
        `${unit.dataset_id}`
    );
}


function updateFSLTranslation(sequence) {

    if (!sequence || sequence.length === 0) {
        return;
    }

    initializeFSLPlayer();

    const mainVideo =
        fslPlaybackState.mainVideo;

    const phraseQueue =
        fslPlaybackState.phraseQueue;

    if (!mainVideo || !phraseQueue) {
        return;
    }

    const latestMatches = sequence.map(
        (unit) => ({
            ...unit,
            key: createUnitKey(unit)
        })
    );

    /*
     * If there are no existing units,
     * initialize the queue normally.
     */
    if (fslPlaybackState.phraseMatches.length === 0) {

        fslPlaybackState.phraseMatches =
            latestMatches;

        fslPlaybackState.phraseKeys =
            latestMatches.map(
                unit => unit.key
            );

        phraseQueue.innerHTML = "";
        fslPlaybackState.queueItems = [];

        latestMatches.forEach(
            (unit, index) => {

                const item =
                    document.createElement("div");

                item.textContent =
                    `${index + 1}. ${labelForUnit(unit)}`;

                item.style.padding = "8px";
                item.style.borderRadius = "5px";
                item.style.marginBottom = "3px";
                item.style.fontSize = "14px";

                styleQueueItem(item, unit);

                phraseQueue.appendChild(item);

                fslPlaybackState.queueItems.push(
                    item
                );
            }
        );

        if (mainVideo.paused || mainVideo.ended) {

            playPhrase(0);
        }

        return;
    }

    /*
     * Check whether the current queue still matches
     * the latest translation.
     */
    const currentMatches =
        fslPlaybackState.phraseMatches;

    const currentKeys =
        currentMatches.map(
            unit => createUnitKey(unit)
        );

    const latestKeys =
        latestMatches.map(
            unit => unit.key
        );

    let sequenceChanged =
        currentKeys.length !== latestKeys.length;

    if (!sequenceChanged) {

        for (
            let i = 0;
            i < currentKeys.length;
            i++
        ) {

            if (
                currentKeys[i] !==
                latestKeys[i]
            ) {

                sequenceChanged = true;
                break;
            }
        }
    }

    if (!sequenceChanged) {
        return;
    }

    /*
     * Preserve the unit currently being played.
     */
    const currentUnitKey =
        fslPlaybackState.currentIndex >= 0 &&
        fslPlaybackState.currentIndex <
            currentMatches.length
            ? createUnitKey(
                currentMatches[
                    fslPlaybackState.currentIndex
                ]
            )
            : null;

    fslPlaybackState.phraseMatches =
        latestMatches;

    fslPlaybackState.phraseKeys =
        latestKeys;

    phraseQueue.innerHTML = "";

    fslPlaybackState.queueItems = [];

    latestMatches.forEach(
        (unit, index) => {

            const item =
                document.createElement("div");

            item.textContent =
                `${index + 1}. ${labelForUnit(unit)}`;

            item.style.padding = "8px";
            item.style.borderRadius = "5px";
            item.style.marginBottom = "3px";
            item.style.fontSize = "14px";

            styleQueueItem(item, unit);

            phraseQueue.appendChild(item);

            fslPlaybackState.queueItems.push(
                item
            );
        }
    );

    let preservedIndex = -1;

    if (currentUnitKey) {

        preservedIndex =
            latestKeys.indexOf(
                currentUnitKey
            );
    }

    if (preservedIndex >= 0) {

        fslPlaybackState.currentIndex =
            preservedIndex;

        latestMatches.forEach(
            (unit, index) => {

                if (
                    fslPlaybackState.queueItems[
                        index
                    ]
                ) {

                    if (index < preservedIndex) {

                        fslPlaybackState.queueItems[
                            index
                        ].textContent =
                            `✓ ${index + 1}. ` +
                            `${labelForUnit(unit)}`;

                    } else if (
                        index === preservedIndex
                    ) {

                        fslPlaybackState.queueItems[
                            index
                        ].textContent =
                            `▶ ${index + 1}. ` +
                            `${labelForUnit(unit)}`;

                    } else {

                        fslPlaybackState.queueItems[
                            index
                        ].textContent =
                            `○ ${index + 1}. ` +
                            `${labelForUnit(unit)}`;
                    }
                }
            }
        );

        if (
            mainVideo.ended &&
            preservedIndex + 1 <
                latestMatches.length
        ) {

            playPhrase(
                preservedIndex + 1
            );
        }

        return;
    }

    if (
        mainVideo.paused ||
        mainVideo.ended
    ) {

        playPhrase(0);
    }
}