chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "startTranslation") {
        createTranslatorWidget();
        startSpeechRecognition();
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
                <h3>Speech</h3>

                <p id="recognized-speech">
                    Waiting for speech...
                </p>
            </div>

            <div class="fsl-section">
                <h3>FSL Translation</h3>

                <div id="fsl-animation">
                    Waiting for translation...
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

    // Check browser support
    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) {

        document.getElementById(
            "recognized-speech"
        ).textContent =
            "Speech recognition is not supported in this browser.";

        return;
    }


    recognition = new SpeechRecognition();

    // Language for Filipino speech
    recognition.lang = "fil-PH";

    // Continue listening
    recognition.continuous = true;

    // Show partial results while speaking
    recognition.interimResults = true;


    recognition.onstart = () => {

        const speechElement =
            document.getElementById("recognized-speech");

        if (speechElement) {
            speechElement.textContent =
                "Listening...";
        }
    };


    recognition.onresult = (event) => {

        let transcript = "";

        for (
            let i = event.resultIndex;
            i < event.results.length;
            i++
        ) {

            transcript +=
                event.results[i][0].transcript;
        }


        const speechElement =
            document.getElementById("recognized-speech");

        if (speechElement) {
            speechElement.textContent =
                transcript;
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