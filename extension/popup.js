const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const status = document.getElementById("status");


startBtn.addEventListener("click", async () => {

    try {

        const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true
        });


        // Check whether our scripts are already loaded
        const [result] = await chrome.scripting.executeScript({
            target: {
                tabId: tab.id
            },

            func: () => {
                return window.__speechToFSLLoaded === true;
            }
        });


        const scriptsAlreadyLoaded = result.result;


        // Only inject scripts once
        if (!scriptsAlreadyLoaded) {

            // Inject widget styles
            await chrome.scripting.insertCSS({
                target: {
                    tabId: tab.id
                },
                files: ["overlay.css"]
            });


            // Inject translator
            await chrome.scripting.executeScript({
                target: {
                    tabId: tab.id
                },
                files: ["translator.js"]
            });


            // Inject content script
            await chrome.scripting.executeScript({
                target: {
                    tabId: tab.id
                },
                files: ["content.js"]
            });


            // Mark scripts as loaded
            await chrome.scripting.executeScript({
                target: {
                    tabId: tab.id
                },

                func: () => {
                    window.__speechToFSLLoaded = true;
                }
            });

        }


        // Start translation
        await chrome.tabs.sendMessage(tab.id, {
            action: "startTranslation"
        });


        status.textContent = "Listening";


    } catch (error) {

        console.error(
            "Failed to start translator:",
            error
        );

        status.textContent = "Error";

    }

});


stopBtn.addEventListener("click", async () => {

    try {

        const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true
        });


        await chrome.tabs.sendMessage(tab.id, {
            action: "stopTranslation"
        });


        status.textContent = "Stopped";


    } catch (error) {

        console.error(
            "Failed to stop translator:",
            error
        );

    }

});