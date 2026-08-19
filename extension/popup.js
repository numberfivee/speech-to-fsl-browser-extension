const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const status = document.getElementById("status");


startBtn.addEventListener("click", async () => {

    const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
    });


    // Inject widget styles
    await chrome.scripting.insertCSS({
        target: {
            tabId: tab.id
        },
        files: ["overlay.css"]
    });


    // Inject translator first
    await chrome.scripting.executeScript({
        target: {
            tabId: tab.id
        },
        files: ["translator.js"]
    });


    // Inject main content script
    await chrome.scripting.executeScript({
        target: {
            tabId: tab.id
        },
        files: ["content.js"]
    });


    // Start translation
    chrome.tabs.sendMessage(tab.id, {
        action: "startTranslation"
    });


    status.textContent = "Listening";
});


stopBtn.addEventListener("click", async () => {

    const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
    });


    chrome.tabs.sendMessage(tab.id, {
        action: "stopTranslation"
    });


    status.textContent = "Stopped";
});