"""
generate_alphabet_lookup.py

Picks one representative image per letter (A-Z) from the FSL
alphabet dataset and copies it into the extension, producing
alphabet_lookup.json for the fingerspelling fallback.

Mirrors the same pattern as copy_representative_videos.py and
generate_video_lookup.py for the FSL-105 dataset, applied to the
26-letter alphabet dataset instead.

    ASSUMPTIONS (confirm/adjust against your actual dataset folder):

    This script assumes a Kaggle-style layout where each letter has
    its own subfolder full of sample images, e.g.:

        SOURCE_DIR/
            A/
                img001.jpg
                img002.jpg
                ...
            B/
                ...
            ...
            Z/
                ...

    If your downloaded dataset instead has flat filenames like
    "A_0001.jpg", "B_0034.jpg" etc. in a single folder, use the
    FLAT_FILENAME_PATTERN branch below instead (toggle
    USE_FLAT_LAYOUT = True and adjust the regex).

Run from the tools/ directory:

    python generate_alphabet_lookup.py

Output:
    extension/fsl_alphabet/<letter>.jpg   (one file per letter)
    extension/alphabet_lookup.json
"""

import json
import re
import shutil
from pathlib import Path

# ---------------------------------------------------------------
# Configuration — adjust these to match your actual dataset layout
# ---------------------------------------------------------------

# Where the raw downloaded dataset lives (folder-per-letter layout)
SOURCE_DIR = Path("C:/Users/Mark Wayne Cleofe/Downloads/archive/Collated")

# Where to copy the chosen representative images inside the extension
DEST_DIR = Path("../extension/fsl_alphabet")

# Where to write the lookup JSON
OUTPUT_JSON = Path("../extension/alphabet_lookup.json")

# Set True if your dataset is flat filenames like "A_0001.jpg"
# instead of folder-per-letter.
USE_FLAT_LAYOUT = False

# Only used when USE_FLAT_LAYOUT = True. Adjust to match your
# actual filenames if they differ.
FLAT_FILENAME_PATTERN = re.compile(r"^([A-Za-z])[_\-].*\.(jpg|jpeg|png)$", re.IGNORECASE)

VALID_EXTENSIONS = {".jpg", ".jpeg", ".png"}


def pick_representative_from_folder(letter_dir: Path) -> Path | None:
    """Returns the first valid image found in a letter's folder."""

    images = sorted(
        p for p in letter_dir.iterdir()
        if p.suffix.lower() in VALID_EXTENSIONS
    )

    return images[0] if images else None


def build_from_folder_layout() -> dict:

    lookup = {}

    for letter_dir in sorted(SOURCE_DIR.iterdir()):

        if not letter_dir.is_dir():
            continue

        letter = letter_dir.name.strip().lower()

        if len(letter) != 1 or not letter.isalpha():
            print(f"Skipping unexpected folder: {letter_dir.name}")
            continue

        chosen = pick_representative_from_folder(letter_dir)

        if not chosen:
            print(f"WARNING: no image found for letter '{letter}'")
            continue

        dest_filename = f"{letter}{chosen.suffix.lower()}"
        dest_path = DEST_DIR / dest_filename

        shutil.copy2(chosen, dest_path)

        # Path as it should appear in the extension (forward slashes,
        # relative to the extension root — matches video_lookup.json's
        # convention for the "video" field).
        lookup[letter] = f"fsl_alphabet/{dest_filename}"

    return lookup


def build_from_flat_layout() -> dict:

    by_letter: dict[str, Path] = {}

    for file_path in sorted(SOURCE_DIR.iterdir()):

        match = FLAT_FILENAME_PATTERN.match(file_path.name)

        if not match:
            continue

        letter = match.group(1).lower()

        # Keep the first match per letter only (representative sample)
        if letter not in by_letter:
            by_letter[letter] = file_path

    lookup = {}

    for letter, chosen in sorted(by_letter.items()):

        dest_filename = f"{letter}{chosen.suffix.lower()}"
        dest_path = DEST_DIR / dest_filename

        shutil.copy2(chosen, dest_path)

        lookup[letter] = f"fsl_alphabet/{dest_filename}"

    return lookup


def main():

    DEST_DIR.mkdir(parents=True, exist_ok=True)

    if not SOURCE_DIR.exists():
        raise FileNotFoundError(
            f"SOURCE_DIR not found: {SOURCE_DIR.resolve()}\n"
            "Update SOURCE_DIR at the top of this script to point "
            "at your downloaded FSL alphabet dataset."
        )

    if USE_FLAT_LAYOUT:
        lookup = build_from_flat_layout()
    else:
        lookup = build_from_folder_layout()

    missing = sorted(set("abcdefghijklmnopqrstuvwxyz") - set(lookup.keys()))

    if missing:
        print(f"\nWARNING: {len(missing)} letters have no image: "
              f"{', '.join(missing)}")
        print("Fingerspelling will silently skip words containing "
              "these letters (falls back to 'no sign yet').")

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(lookup, f, indent=4, ensure_ascii=False, sort_keys=True)

    print(f"\nWrote {len(lookup)} letters to {OUTPUT_JSON.resolve()}")
    print(f"Copied images into {DEST_DIR.resolve()}")


if __name__ == "__main__":
    main()