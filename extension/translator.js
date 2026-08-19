function processText(text) {
    // Convert text to lowercase
    let processedText = text.toLowerCase();

    // Remove punctuation
    processedText = processedText.replace(/[.,!?;:]/g, "");

    // Remove extra spaces
    processedText = processedText.replace(/\s+/g, " ").trim();

    // Words to remove for our initial rule-based processing
    const stopWords = [
        "ay",
        "ang",
        "ng",
        "mga",
        "na",
        "si",
        "ni",
        "kay",
        "sa",
        "isang"
    ];

    // Split sentence into words
    let words = processedText.split(" ");

    // Remove selected stop words
    words = words.filter(word => !stopWords.includes(word));

    return words;
}