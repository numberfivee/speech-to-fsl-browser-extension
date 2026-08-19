const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const status = document.getElementById("status");

startBtn.addEventListener("click", () => {
    status.textContent = "Ready";
});

stopBtn.addEventListener("click", () => {
    status.textContent = "Stopped";
});