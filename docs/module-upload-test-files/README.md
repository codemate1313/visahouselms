# Module upload test files

Small fixtures for manually testing module authoring uploads.

## How to use

1. Create the module type you want to test.
2. Open a part in the module editor.
3. Use that part's import/upload control and choose the matching file from this folder.
4. For Full Mock and Final Test, use the same section files as the standalone modules because those modules are made from Listening, Reading, Writing, and Speaking parts.

## Files

| Folder | Use |
|---|---|
| `reading/` | Per-part Reading CSV imports. These mirror the existing Reading fixture format. |
| `listening/` | Per-part Listening CSV imports. Use `media/sample-listening-audio.mp3` for each Listening part audio upload. |
| `writing/` | Per-part Writing CSV imports. |
| `speaking/` | Per-part Speaking CSV imports. Use `media/sample-speaking-material.pdf` for Speaking material PDF upload. |
| `full-mock/` | Index file showing which standalone section files to upload into a Full Mock. |
| `final-test/` | Index file showing which standalone section files to upload into a Final Test. |
| `media/` | Shared media fixtures for MP3, PDF, and image upload controls. |
| `pdf/` | Full-module PDF fixtures for the bulk upload flow. |

These files are intentionally short and artificial. They are for upload/parser testing, not real exam content. The MP3 fixture is only for backend signature validation; use a real audio file if you need browser playback.

## PDF fixtures

| File | Use |
|---|---|
| `pdf/full-listening-bulk-upload.pdf` | Upload to a Listening module; questions sort into Listening 1-4. Add Listening audio before publishing. |
| `pdf/full-writing-bulk-upload.pdf` | Upload to a Writing module; tasks sort into Writing 1-2. |
| `pdf/full-speaking-bulk-upload.pdf` | Upload to a Speaking module; prompts sort into Speaking 1-4 and timings are normalized during review/import. |
| `pdf/full-reading-bulk-upload-review-only.pdf` | Upload to a Reading module to test extraction and sorting. Review shared passages and option banks before final import. |
