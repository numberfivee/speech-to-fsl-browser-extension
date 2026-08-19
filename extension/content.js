chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "startTranslation") {
        createTranslatorWidget();
    }

    if (message.action === "stopTranslation") {
        removeTranslatorWidget();
    }
});


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
        .addEventListener("click", removeTranslatorWidget);
}


function removeTranslatorWidget() {
    const widget = document.getElementById("speech-to-fsl-widget");

    if (widget) {
        widget.remove();
    }
}