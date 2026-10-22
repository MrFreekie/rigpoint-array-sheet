# Development

Notes for anyone changing the code. If you only want to use the app, see the [README](../README.md).

## Ground rules

- UK English in the interface, comments, file names and documentation.
- Kilograms and metres only. A report in other units is refused.
- The PDF is the source of truth. The engine copies what it prints and calculates nothing.
- Never guess. Anything unreadable becomes a problem that names the array, not a made-up figure.
- No server, accounts, tracking or outside network calls.
- Real names do not go into fixtures or examples.
- Every new dependency needs a reason in the pull request.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server at http://localhost:5173/rigpoint-array-sheet/ |
| `npm run build` | Typecheck, then a production build into `dist/` with the strict CSP added |
| `npm run preview` | Serves the production build at http://localhost:4173/rigpoint-array-sheet/ |
| `npm run typecheck` | TypeScript in strict mode |
| `npm run lint` | ESLint, including the rule that keeps the engine pure |
| `npm test` | All tests |
| `npm run e2e` | Playwright tests on Chromium, Firefox, iPhone SE (WebKit) and Android, against the production build. Run `npx playwright install` once first |
| `npm run e2e:chromium` | The same on Chromium only |
| `npm run ci` | Typecheck, lint, tests and build, as CI runs them (CI also runs the e2e tests) |
| `npm run extract:fixtures` | Rebuilds the anonymised fixtures from the PDFs in `reference/` |

Playwright's Firefox may not start on Windows. CI on Linux runs it, so use `npm run e2e:chromium` locally if it will not launch.

## Layout

| Path | Contents |
|---|---|
| `src/engine/` | Pure parser: lines of positioned text in, a report and a list of problems out |
| `src/schema/` | Zod schema for the report, with plain-English errors that name the field |
| `src/engine/sheet.ts` | What each fly sheet card and rigging row shows, including the one height subtraction |
| `src/files/` | Reading a PDF with pdf.js, the document model, saving and opening files, migrations, revisions, file names and autosave |
| `src/ui/` | The React interface. It displays engine results and calculates nothing itself |
| `src/print/` | The print sheet, the card content shared with the image export, the PNG layout and the QR code |
| `e2e/` | Playwright tests, with PDFs built from the committed fixtures |
| `src/testing/` | A seeded random generator, a report renderer and a tiny PDF builder for tests |
| `fixtures/` | Anonymised text extracted from the two sample reports |
| `reference/` | The sample PDFs (kept out of git, see below) |

The engine may not touch the DOM, storage, pdf.js or other layers. ESLint enforces this.

## How reading works

pdf.js gives each piece of text with its page and position. The engine groups pieces into lines by height, then walks the lines in order. Group headings, source headings and the physical configuration section are read. The acoustic configuration section is skipped.

The enclosure table is read by column position, not by order, because some cells are blank (a sub has no angle) and values are right aligned under their headings. A page break repeats the table heading and the parser carries on.

Group nesting is not printed, only a number. A group numbered 1 starts a deeper level, and a group numbered n replaces the group numbered n minus 1 at the same level. This reproduces the nesting in both samples. If the numbering ever fails to follow that rule, the parser reports a problem and the group names may be wrong.

## Checks on what was read

Two levels of problem come back with the report.

An error means the figures cannot be relied on: no text, not a Soundvision report, or units other than kilograms and metres.

A check means something looks wrong and should be compared with the PDF: a line the parser did not understand, an unreadable cell, a motor count that does not match the pickups, or enclosures out of order. For flown arrays it also compares figures the PDF prints against each other. Each site angle should equal the one above minus its angle, and each top height should match the bottom of the row above. Stacked arrays in the samples break those two rules legitimately, so only their numbering and top and bottom site are checked.

## Tests

Expected values in `src/engine/parse.test.ts` were read by hand from the sample PDFs. Do not edit an expected value to make a test pass. Raise it instead.

The property tests draw 300 random reports in the Soundvision layout, with page breaks in random places, and require that they read back exactly with no problems. Other tests cover empty and non-report PDFs, pounds and feet, unreadable cells, unknown lines, shuffled input and garbage.

The two sample PDFs carry real venue and author names, so they are listed in `.gitignore`. The committed fixtures replace those names. When the PDFs are present in `reference/`, extra tests check that pdf.js still produces exactly the committed fixtures. Without them those tests skip, which is what happens in CI.

## Panflex label

A fly sheet shows a label next to each enclosure: 70, 110, or 90 with On or Off. `panflexLabel` in `src/engine/panflex.ts` produces it. It is the one value the engine derives, so the rule is written out there and tested against the owner's sample output.

The two Panflex figures are added together. When they differ, the wider side is On if it points towards the stage centre and Off if it points away, seen from the box. In the samples the first figure points towards negative X and the second towards positive X, so the answer depends on which side of X = 0 the array sits. Left-hand arrays match the sample output. Right-hand arrays follow by mirroring and are not yet checked against a reference.

## Inputs on top of the report

The PDF does not hold the show name, system engineer, company, Z-axis zero or a ground offset, so the interface asks for them. The offset can be set for every array and overridden per array. Heights on the sheet are the report's heights minus the offset, rounded to 0.01 m. An array's Position Z is its top height and its Bottom elevation is its bottom height. If an offset is not a number, the heights are hidden and the field says why. Nothing is ever shown as 0 because it was missing.

## Mirrored arrays

When two arrays are exact left-right copies, the fly sheet shows the first one and names the other on its card. `findMirrors` in `src/engine/symmetry.ts` decides. The test is strict: group, configuration, bumper, motors, weights, heights, sites, every enclosure row and every warning must match. X and azimuth must be negated, pickup X must be negated, and the two Panflex figures must be swapped. A difference of 0.01 in any figure means no pairing. An array on the centre line is never paired.

A checkbox above the cards shows the mirrored arrays as well. A mirrored array uses its partner's ground offset unless it has its own. The rigging summary always lists every pickup, because mirrored arrays hang from different points.

## Saved files

A saved file is JSON in the format `arraysheet/2`. It holds the report as read from the PDF (not the PDF), the problems found, the show details, one ground offset and one print choice per array, the status, the revision, the name of the PDF and the time it was saved. The schema is `src/schema/array-file.ts`.

Every opened file is treated as untrusted. In order, it must pass the size limit (8 MB), parse as JSON, say it is an `arraysheet` file, be no newer than this version, and pass the schema. The schema also caps the number of arrays, enclosures, pickups, warnings and the length of text. Anything wrong stops the open with a plain-English message that names the field. Nothing is partly opened.

Each version has a migration to the next in `src/files/migrations.ts`. Version 2 added the print choices, so the one step so far turns a version 1 file into version 2 by choosing every array for printing, which is what a version 1 file did. A file from a newer version is refused, not opened and silently trimmed.

Because the file holds the report as read, it reopens exactly as saved, whatever the PDF reader does later.

## Status, revision and the lock

Status is Draft, Issued, Approved or Superseded. The revision is blank for the first issue, then A, B, C, through Z, then AA. `nextRevision` does the counting.

A file opened as approved or superseded is read-only, and so is a file that has just been saved as one. Choosing Approved on a draft does not lock it, so it can still be saved. Create new revision starts a draft with the next letter and no file name, so it saves under a new name such as `Main stage - Rev B.arraysheet.json`. The old file is never changed. Setting the old one to Superseded is left to the person.

## Update from PDF

With a file open, Update from PDF reads a newer PDF and compares it with the saved report (`src/engine/compare.ts`). Arrays are matched by name. The comparison lists every difference in the arrays, the enclosure rows, the pickups, the weights and the warnings, plus the Soundvision version, date and project name. If nothing differs, the app says so. If something does, the person chooses Update from new PDF or Keep as saved. A PDF that reads with an error is refused and the file stays as it was. After an update, ground offsets stay with the array of the same name, and the file counts as having unsaved changes.

## Three layers of saving

1. Every browser: a file input to open and a download to save.
2. Chrome and Edge on a computer, found by feature and never by browser name: the File System Access API. `src/files/fs-access.ts` holds the pickers, `src/files/save-flow.ts` decides what Save and Save As do, and `src/files/recent.ts` keeps file handles in IndexedDB for the Recent list. Permission is asked for again when a file is reused.
3. Autosave to IndexedDB, described below.

`saveText` takes a request and returns what happened: cancelled, denied, saved to a handle, or downloaded. Save writes back to the handle when there is one and asks where when there is not. Save As always asks. Nothing is reported as saved unless the write succeeded. Anything typed while a picker was open stays unsaved, because only the text that was written counts as saved. Create new revision forgets the handle, so Save asks where and the original file is never touched.

The Playwright tests cannot drive a native picker, so they replace the two picker functions with ones that return real handles from the browser's private file system. Everything after the picker is the real code.

## Install, offline and updates

`vite-plugin-pwa` builds the manifest and precaches the app with Workbox, using our own service worker in `src/sw.ts` (strategy `injectManifest`). The precache includes the PDF reader's worker, so a PDF opens with no network. The icons in `public/` are rendered from `favicon.svg` by `npm run icons` and committed, so builds need no browser.

The service worker waits. A new version is used only after the person presses Reload in the update prompt (`src/ui/UpdatePrompt.tsx`), and the prompt mentions that unsaved changes are kept by autosave. The app checks for a new version every hour while it is open.

## File handler and share target

The manifest registers the app as a handler for `.json` files, so a saved file opens on double-click in the installed app (Chrome and Edge on a computer). It does not register for PDFs, because the app should not take over every PDF on the computer. `src/files/launch.ts` receives the file through `launchQueue`.

The manifest also declares a share target. On Android a saved file or a Soundvision PDF can be shared into the app. The service worker receives the POST, keeps the file in a cache, and sends the app to `?shared=1`, where `src/files/share-target.ts` takes it out and opens it. Playwright tests simulate the Android POST with `fetch`, because the app's strict CSP blocks form submissions.

## Autosave

While there are unsaved changes, a copy is written to IndexedDB (through idb-keyval) about a second after each edit. On the next visit the app offers to restore it. The offer says it is a safety net and not a save. The copy is checked like any opened file, and one that fails is thrown away. Saving, starting again, opening another file or declining the offer removes it. If the browser refuses IndexedDB (a private window, for example), saving to a file still works.

The `beforeunload` warning also fires while there are unsaved changes.

## Printing

`src/print/PrintSheet.tsx` renders the whole printed sheet off-screen at all times, so it can be measured, and `print.css` shows it only when printing. The editing screen is hidden in print. A draft is marked with DRAFT on every pocket panel, because a word across the whole A4 page would be cut up by the folds. The rigging page carries one.

Every card is laid out at a fixed width (half the page less padding) and measured. `planPages` in `src/print/layout.ts` then fills pages four at a time, in report order. A card that would have to shrink below 72% to fit its panel gets a page of its own, and may shrink to 50% there. Beyond that the page is allowed to run on rather than cut anything off. The rigging summary page always comes last.

While printing, the measuring copy is hidden, so a measurement then would read zero. The measuring code ignores a hidden container and keeps the heights it already has. A Playwright test covers this.

The footer is `printFooter`. It says which version, which Soundvision report, which file and when. A file that has changed since it was saved is marked. The last page carries the small print from `src/print/small-print.ts`. It is the approved wording of `DISCLAIMER.md`, and a test fails if the two differ by a word. Change them together, and only with the owner's approval.

The Playwright PDF tests check three things: the number of PDF pages, that every card sits inside its panel and every footer inside its page, and that the text is what the screen shows. PDF output is a Chromium feature, so those run on Chromium only.

## Choosing what to print

Each array has a Print this array checkbox. The choices are saved in the file as one true or false per array (`print`). Unticked arrays leave the print sheet and the image export, and the rigging page lists only the pickups of the printed arrays. A card that stands for a mirror image carries that mirror's pickups with it. With the mirrored arrays shown, each array is chosen on its own. The screen always shows every array.

An approved or superseded file cannot change, but it can still be printed in part. Its choices are held for the session only (`printOverride` in `src/files/doc.ts`), are never saved and do not count as a change. Create new revision starts from the choices in force. Update from PDF keeps a choice with the array of the same name. Print is off while no array is ticked.

## Images

Card content (`src/print/card-content.ts`) is plain data that both the print card and the image draw from, so they cannot disagree. `array-image.ts` turns it into a list of drawing steps (text, lines, boxes) and draws them on a canvas at twice the size. Canvas text needs no markup, so it works under the strict CSP. The layout is pure and has unit tests. Playwright checks that the download is a real PNG of the right width.

## The QR code

`src/print/qr.ts` makes the code on this device with `qrcode-generator` (MIT, no dependencies, about 20 KB) and draws it as one SVG path. The address is `APP_URL` in `src/app-info.ts`. A test decodes the picture back to the address with `jsqr`, which is a test-only dependency.

## Later ideas

- Print an array to a receipt printer or similar narrow printer.
- A larger type size on pocket cards that have room to spare.

## The interface

- The page opens on a screen that explains what the app does and does not do. A PDF can be chosen or dropped anywhere on the page.
- A report with an error-level problem shows only the problem list, not the figures.
- A report with checks shows the sheet and the list of things to compare with the PDF.
- Every status has a word as well as a colour: READ OK, CHECK, ERROR, WARNING, CAUTION.
- Colours for Day and Night are tokens in `src/ui/styles.css`. `src/ui/contrast.test.ts` checks them against WCAG 2.1 AA.
- pdf.js and its worker load only when a PDF is opened, and run under the strict CSP.
- Components are tested by rendering them to HTML (`src/ui/render.test.tsx`), and the whole flow by Playwright tests.

## Not done yet

- The update prompt is not covered by an automated test, because it needs two deployed versions. It is covered by hand before a release.
- The sample fly sheet's Btm Height + 1 row is deliberately left out.
- The cabling and folding sheets from other tools are out of scope.
- pdf.js needs its worker file bundled when the interface exists. Phase 2 decides how.
- Only Soundvision is supported. Other tools would need their own reader.
