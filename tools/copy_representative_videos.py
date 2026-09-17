import json
import shutil
from pathlib import Path


# ==========================================
# SETTINGS
# ==========================================

LOOKUP_FILE = Path(
    "video_lookup.json"
)

DATASET_ROOT = Path(
    r"C:\Users\Mark Wayne Cleofe\Downloads\FSL-105 A dataset for recognizing 105 Filipino sign language videos\FSL-105 A dataset for recognizing 105 Filipino sign language videos"
)

OUTPUT_ROOT = Path(
    "fsl_videos"
)


# ==========================================
# LOAD LOOKUP
# ==========================================

with open(
    LOOKUP_FILE,
    "r",
    encoding="utf-8"
) as file:

    video_lookup = json.load(file)


# ==========================================
# COPY VIDEOS
# ==========================================

copied = 0
missing = 0


for dataset_id, data in video_lookup.items():

    original_path = Path(
        data["original_path"]
    )

    source = (
        DATASET_ROOT /
        original_path
    )

    destination_folder = (
        OUTPUT_ROOT /
        str(dataset_id)
    )

    destination_folder.mkdir(
        parents=True,
        exist_ok=True
    )

    filename = Path(
        data["video"]
    ).name

    destination = (
        destination_folder /
        filename
    )


    print()
    print("-" * 60)

    print(
        f"ID       : {dataset_id}"
    )

    print(
        f"Label    : {data['label']}"
    )

    print(
        f"Source   : {source}"
    )

    print(
        f"Destination: {destination}"
    )


    if not source.exists():

        print(
            "❌ VIDEO NOT FOUND"
        )

        missing += 1

        continue


    shutil.copy2(
        source,
        destination
    )

    print(
        "✓ COPIED"
    )

    copied += 1


# ==========================================
# SUMMARY
# ==========================================

print()
print("=" * 60)
print("FSL-105 VIDEO COLLECTION")
print("=" * 60)

print(
    f"Videos copied : {copied}"
)

print(
    f"Videos missing: {missing}"
)

if copied == 105 and missing == 0:

    print()
    print(
        "SUCCESS!"
    )

    print(
        "All 105 representative videos "
        "were copied correctly."
    )

print("=" * 60)