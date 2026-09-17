import csv
import json
from pathlib import Path


# ==========================================
# SETTINGS
# ==========================================

TRAIN_FILE = Path("train.csv")

OUTPUT_FILE = Path("video_lookup.json")


# ==========================================
# READ TRAINING DATASET
# ==========================================

video_lookup = {}

with open(
    TRAIN_FILE,
    "r",
    encoding="utf-8-sig"
) as file:

    reader = csv.DictReader(file)

    for row in reader:

        dataset_id = int(row["id_label"])

        # Select the first training video
        # encountered for each class.
        if dataset_id not in video_lookup:

            original_path = row["vid_path"]

            original_path = (
                original_path
                .replace("\\", "/")
            )

            filename = Path(
                original_path
            ).name

            video_lookup[dataset_id] = {

                "label": row["label"],

                "category": row["category"],

                "video": (
                    f"fsl_videos/"
                    f"{dataset_id}/"
                    f"{filename}"
                ),

                "original_path":
                    original_path

            }


# ==========================================
# CHECK ALL 105 CLASSES
# ==========================================

expected_ids = set(range(105))

found_ids = set(
    video_lookup.keys()
)

missing_ids = (
    expected_ids -
    found_ids
)


# ==========================================
# WRITE VIDEO LOOKUP
# ==========================================

with open(
    OUTPUT_FILE,
    "w",
    encoding="utf-8"
) as file:

    json.dump(
        {
            str(dataset_id):
                video_lookup[dataset_id]

            for dataset_id
            in sorted(video_lookup)
        },
        file,
        indent=4,
        ensure_ascii=False
    )


# ==========================================
# SUMMARY
# ==========================================

print("=" * 60)
print("FSL-105 VIDEO LOOKUP GENERATOR")
print("=" * 60)

print(
    f"Training classes found: "
    f"{len(found_ids)}"
)

print(
    f"Output file: "
    f"{OUTPUT_FILE}"
)

if missing_ids:

    print()
    print("WARNING!")
    print("Missing IDs:")

    for dataset_id in sorted(
        missing_ids
    ):

        print(
            f"  - {dataset_id}"
        )

else:

    print()
    print(
        "SUCCESS!"
    )

    print(
        "All 105 FSL-105 classes "
        "were found."
    )

print("=" * 60)