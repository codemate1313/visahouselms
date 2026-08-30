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
| `listening/` | Per-part Listening CSV/PDF imports, plus `listening_full_combined.csv` (all 4 parts in one file, routed by a `part_code` column). Use `media/sample-listening-audio.mp3` for each Listening part audio upload. |
| `writing/` | Per-part Writing CSV imports. |
| `speaking/` | Per-part Speaking CSV imports. Use `media/sample-speaking-material.pdf` for Speaking material PDF upload. |
| `full-mock/` | Index file showing which standalone section files to upload into a Full Mock. |
| `final-test/` | Index file showing which standalone section files to upload into a Final Test. |
| `media/` | Shared media fixtures for MP3, PDF, and image upload controls. |
| `../module-upload-templates/pdf/` | Reusable PDF samples for the bulk upload flow. |

These files are intentionally short and artificial. They are for upload/parser testing, not real exam content. The MP3 fixture is only for backend signature validation; use a real audio file if you need browser playback.

## Listening 3 (notepad task)

Listening 3 uses the `notepad_gaps` layout - one shared passage with a heading and sequential
`{{blank:1}}`, `{{blank:2}}`... markers, not a stack of independent questions. `listening_3.csv`
and `listening_3.pdf` carry that passage in a `passage` column / as text before the numbered list,
so import produces a real heading + gapped paragraph instead of an empty notepad.

Note: Listening 3's part editor only shows the "Edit Notepad" composer - there is no per-part
upload control for it (that control is hidden for every composed-task layout: notepad tasks,
inline-matching-blanks, and source-text-matching parts). To bulk-import Listening 3 content, use
the whole-module "Full test upload" flow with a file that covers the whole module (`pdf/full-listening-bulk-upload.pdf`
or `listening_full_combined.csv`) - it will route rows into Listening 3 and build its notepad automatically.

## PDF fixtures

| File | Use |
|---|---|
| `pdf/full-listening-bulk-upload.pdf` | Upload to a Listening module via "Full test upload"; questions sort into Listening 1-4, including a proper Listening 3 notepad. Add Listening audio before publishing. |
| `pdf/full-writing-bulk-upload.pdf` | Upload to a Writing module; tasks sort into Writing 1-2. |
| `pdf/full-speaking-bulk-upload.pdf` | Upload to a Speaking module; prompts sort into Speaking 1-4 and timings are normalized during review/import. |
| `pdf/full-reading-bulk-upload-review-only.pdf` | Upload to a Reading module to test extraction and sorting. Review shared passages and option banks before final import. |
| `listening/listening_1.pdf` … `listening_4.pdf` | Single-part PDF equivalents of the per-part Listening CSVs, for parser testing. Listening 1/2/4 can be uploaded through that part's own import control; Listening 3 has no per-part control (see above) so use it via a whole-module upload instead. |
| `../module-upload-templates/pdf/listening-sample-upload.pdf` | Upload to a Listening module; add Listening audio before publishing. |
| `../module-upload-templates/pdf/reading-sample-upload.pdf` | Upload to a Reading module to test extraction and sorting. |
| `../module-upload-templates/pdf/full-module-mcq-sample-upload.pdf` | Combined section PDF sample with `Part:` headers. |
