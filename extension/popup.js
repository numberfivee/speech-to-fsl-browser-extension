const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const status = document.getElementById("status");


startBtn.addEventListener("click", async () => {

    const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
    });


    await chrome.scripting.insertCSS({
        target: {
            tabId: tab.id
        },
        files: ["overlay.css"]
    });


    await chrome.scripting.executeScript({
        target: {
            tabId: tab.id
        },
        files: ["content.js"]
    });


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