# Demo translation files

Files a client or translator would send back. Upload them on a website's **Languages** screen
(*Translation file*). Nothing is applied until you press **Use these translations** — the preview
always says first where every text will go and what is still missing.

All of them are written for **Hill Country Tea Tours**, so they also fit the copy you make from it
in the demo script (step A: *Misty Mountain Retreats*).

| File | What it is for | What you should see |
|---|---|---|
| `tamil-translations.csv` | The complete Tamil translation. | `44 texts will be added or updated` → **Tamil after import: complete ✓** |
| `sinhala-translations-incomplete.csv` | Sinhala as a client often really sends it: the first half done, the rest left blank. | `26 texts will be added or updated`, `18 empty cells were skipped` → **Sinhala after import: 17 texts still missing**. Sinhala cannot be made visible. |
| `sinhala-translations-rest.csv` | The remaining Sinhala texts, "sent a week later". | `17 texts will be added or updated` → **Sinhala after import: complete ✓**, and **Make visible** becomes available. |
| `tamil-corrections-messy.csv` | A realistic *problem* file: the client deleted the `key` column and edited rows by hand. | Rows are matched by their English wording instead; 2 updated, 1 already correct, and 2 rows reported as not placeable (see below). |
| `tamil-corrections.json` | The same kind of correction in the other accepted format (JSON, grouped by language code). | `3 texts will be added or updated` |

## Why 18 blank cells but "17 texts still missing"

`sinhala-translations-incomplete.csv` leaves 18 cells empty, but the website only reports **17**.
The extra one is `contact.address`, which is **private client information** and is cleared when a
website is copied for a new campaign. A field with no main-language text is not counted as a
missing translation — there is nothing to translate yet. (`sinhala-translations-rest.csv`
deliberately leaves that row out for the same reason: the new client has their own address.)

## What the "messy" file demonstrates

Two rows cannot be placed, and the import report says exactly why in plain language:

* **`Plan my trip`** — this wording is used in *two* places (the menu button and the
  call-to-action button), so matching by text alone would be a guess. The report asks for the
  `key` column back.
* **`Sunset Cruise Special`** — no such text exists on this website, so the row is ignored
  (the client may have been working from an older spreadsheet).

The other rows still import normally. Nothing is half-applied: you see the whole report before
deciding.

## Making your own

On *Languages*, press **Spreadsheet for \<language\>** to download the file for that language,
filled in with the current English text. That is exactly the format above — send it out, get it
back, upload it. A `key` column makes matching exact; without one, rows are matched by their
unique English wording.
