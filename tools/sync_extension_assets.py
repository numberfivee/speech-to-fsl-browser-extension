from pathlib import Path
import shutil


# ============================================================
# PROJECT PATHS
# ============================================================

# Root project directory
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# Source files/folders
SOURCE_LOOKUP = PROJECT_ROOT / "video_lookup.json"
SOURCE_VIDEOS = PROJECT_ROOT / "fsl_videos"

# Chrome extension directory
EXTENSION_DIR = PROJECT_ROOT / "extension"

# Destination files/folders
DEST_LOOKUP = EXTENSION_DIR / "video_lookup.json"
DEST_VIDEOS = EXTENSION_DIR / "fsl_videos"


# ============================================================
# COPY VIDEO LOOKUP
# ============================================================

print("=" * 60)
print("FSL EXTENSION ASSET SYNCHRONIZATION")
print("=" * 60)

print("\nProject root:")
print(PROJECT_ROOT)

print("\nExtension directory:")
print(EXTENSION_DIR)


if SOURCE_LOOKUP.exists():

    shutil.copy2(
        SOURCE_LOOKUP,
        DEST_LOOKUP
    )

    print("\n✓ video_lookup.json synchronized")

else:

    print("\n✗ ERROR: video_lookup.json not found")
    print(SOURCE_LOOKUP)


# ============================================================
# COPY FSL VIDEOS
# ============================================================

if SOURCE_VIDEOS.exists():

    # Create destination directory
    DEST_VIDEOS.mkdir(
        parents=True,
        exist_ok=True
    )

    copied = 0
    skipped = 0

    print("\nSynchronizing FSL videos...")

    for source_file in SOURCE_VIDEOS.rglob("*"):

        if not source_file.is_file():
            continue

        relative_path = source_file.relative_to(
            SOURCE_VIDEOS
        )

        destination_file = (
            DEST_VIDEOS / relative_path
        )

        destination_file.parent.mkdir(
            parents=True,
            exist_ok=True
        )

        shutil.copy2(
            source_file,
            destination_file
        )

        copied += 1

    print(f"✓ Videos synchronized: {copied}")

else:

    print("\n✗ ERROR: fsl_videos folder not found")
    print(SOURCE_VIDEOS)


# ============================================================
# FINAL CHECK
# ============================================================

print("\n" + "=" * 60)
print("SYNCHRONIZATION COMPLETE")
print("=" * 60)

print("\nExtension assets:")

print(
    f"video_lookup.json: "
    f"{DEST_LOOKUP.exists()}"
)

print(
    f"fsl_videos folder: "
    f"{DEST_VIDEOS.exists()}"
)

# Specific test for THANK YOU
test_video = DEST_VIDEOS / "7" / "12.MOV"

print(
    f"THANK YOU video (7/12.MOV): "
    f"{test_video.exists()}"
)

print("\nReady for Chrome extension testing.")