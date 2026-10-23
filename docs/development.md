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
| `fixtures/` | Anonymised text extracted from the sample reports |
| `reference/` | The sample PDFs (kept out of git, see below) |

The engine may not touch the DOM, storage, pdf.js or other layers. ESLint enforces this.

## How reading works

pdf.js gives each piece of text with its page and position. The engine groups pieces into lines by height, then walks the lines in order. Group headings, source headings and the physical configuration section are read. The acoustic configuration section is skipped.

The enclosure table is read by column position, not by order, because some cells are blank (a sub has no angle) and values are right aligned under their headings. A page break repeats the table heading and the parser carries on.

A stacked array may print a `# fixations:` count and one line for each fixation, such as `Front right fixation position (X; Y; Z, m): Fr (-2.84; 4.6; 1)`. The parser keeps the count and, for each line, the name as printed (Fr, Fl, Rr, Rl) with X, Y and Z. Both fields are optional on an array, so an array without the lines is unchanged. The lines were seen only in sample E, on its eight KARA II stacks, always four with a Z of 1. A repeated `# fixations:` line, or the same name on two lines, raises a check; both positions are kept and the last count is used. No other wording is read: any other line that looks like a fixation is reported as not understood.

Group nesting is not printed, only a number. A group numbered 1 starts a deeper level, and a group numbered n replaces the group numbered n minus 1 at the same level. This reproduces the nesting in both samples. If the numbering ever fails to follow that rule, the parser reports a problem and the group names may be wrong.

## Checks on what was read

Two levels of problem come back with the report.

An error means the figures cannot be relied on: no text, not a Soundvision report, or units other than kilograms and metres.

A check means something looks wrong and should be compared with the PDF: a line the parser did not understand, an unreadable cell, a motor count that does not match the pickups, enclosures out of order, or a fixation count that does not match the fixation positions found. A flown or stacked array with no Position line is also flagged. For flown arrays the parser compares figures the PDF prints against each other. Each site angle should equal the one above minus its angle, and the first and last site angles should match the top and bottom site. Every row except the first needs an angle, and a table that has lost its Angle column gets one check about the column. Heights are not compared, because with large splays the front edges of enclosures do not meet. Stacked arrays follow different rules, so only their numbering is checked. A stack laid out in columns is numbered from #1 in each column, and the column numbers must run C1, C2, C3 with none missing and no plain rows mixed in.

## Tests

Expected values in `src/engine/parse.test.ts` were read by hand from the sample PDFs. Do not edit an expected value to make a test pass. Raise it instead.

The property tests draw 300 random reports in the Soundvision layout, with page breaks in random places, and require that they read back exactly with no problems. Other tests cover empty and non-report PDFs, pounds and feet, unreadable cells, unknown lines, shuffled input and garbage.

The two sample PDFs carry real venue and author names, so they are listed in `.gitignore`. The committed fixtures replace those names. When the PDFs are present in `reference/`, extra tests check that pdf.js still produces exactly the committed fixtures. Without them those tests skip, which is what happens in CI.

## Panflex label

A fly sheet shows a label next to each enclosure: 70, 110, or 90 with On or Off. `panflexLabel` in `src/engine/panflex.ts` produces it. It is the one value the engine derives, so the rule is written out there and tested against the owner's sample output.

The two Panflex figures are added together. When they differ, the wider side is On if it points towards the stage centre and Off if it points away, seen from the box. In the samples the first figure points towards negative X and the second towards positive X, so the answer depends on which side of X = 0 the array sits. Left-hand arrays match the sample output. Right-hand arrays follow by mirroring and are not yet checked against a reference.

## Inputs on top of the report

The PDF does not hold the show name, venue, system engineer, company, Z-axis zero or a ground offset, so the interface asks for them. The offset can be set for every array and overridden per array. Heights on the sheet are the report's heights minus the offset, rounded to 0.01 m. An array's Position Z is its top height and its Bottom elevation is its bottom height. If an offset is not a number, the heights are hidden and the field says why. Nothing is ever shown as 0 because it was missing.

## Mirrored arrays

When two arrays are exact left-right copies, the fly sheet shows the first one and names the other on its card. `findMirrors` in `src/engine/symmetry.ts` decides. The test is strict: group, configuration, bumper, motors, weights, heights, sites, every enclosure row and every warning must match. X and azimuth must be negated, pickup X must be negated, and the two Panflex figures must be swapped. A difference of 0.01 in any figure means no pairing. An array on the centre line is never paired.

Fixations are part of the strict test: a pair needs the same count, and the fixations of one array, with the side letters swapped (Fr with Fl, Rr with Rl) and X negated, must equal those of the other as sorted lists, so a repeated name is matched one to one.

A card that stands for a pair says only `MIRRORED` and the name of the other array, on screen, on the printed pocket card and in the image. A checkbox above the cards shows the mirrored arrays as well. A mirrored array uses its partner's ground offset unless it has its own. The rigging summary lists every pickup and every fixation position of the arrays chosen for printing and of the mirrors their cards stand for, because mirrored arrays hang from different points and stand on different ones. The one on screen lists every array.

## Saved files

A saved file is JSON in the format `arraysheet/6`. It holds the report as read from the PDF (not the PDF), the problems found, the show details, one ground offset and one print choice per array, the status, the revision, the name of the PDF and the time it was saved. The schema is `src/schema/array-file.ts`.

Every opened file is treated as untrusted. In order, it must pass the size limit (8 MB), parse as JSON, say it is an `arraysheet` file, be no newer than this version, and pass the schema. The schema also caps the number of arrays, enclosures, pickups (8), fixations (16) and warnings, and the length of text, a fixation name included. Anything wrong stops the open with a plain-English message that names the field. Nothing is partly opened.

Each version has a migration to the next in `src/files/migrations.ts`. There are five steps so far. Version 2 added the print choices, so the first step turns a version 1 file into version 2 by choosing every array for printing, which is what a version 1 file did. Version 3 added the venue, so the second step gives a version 2 file an empty venue. Version 4 added the optional column of an enclosure row, and version 5 added the optional fixations of an array. Neither changes an older file, so the steps from 3 and from 4 only change the format number. Their purpose is to make older copies of the app refuse a file that may hold columns or fixations, because they would drop them without saying so. Version 6 added the origin note (P0) that the rigging plot prints, so the last step gives an older file a blank one and turns the side labels on; an older copy of the app would drop the note, so it refuses version 6 files. A file from a newer version is refused, not opened and silently trimmed.

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

`vite-plugin-pwa` builds the manifest and precaches the app with Workbox, using a custom service worker in `src/sw.ts` (strategy `injectManifest`). The precache includes the PDF reader's worker, so a PDF opens with no network. The icons in `public/` are rendered from `favicon.svg` by `npm run icons` and committed, so builds need no browser.

The service worker waits. A new version is used only after the person presses Reload in the update prompt (`src/ui/UpdatePrompt.tsx`), and the prompt mentions that unsaved changes are kept by autosave. The app checks for a new version every hour while it is open.

## File handler and share target

The manifest registers the app as a handler for `.json` files, so a saved file opens on double-click in the installed app (Chrome and Edge on a computer). It does not register for PDFs, because the app should not take over every PDF on the computer. `src/files/launch.ts` receives the file through `launchQueue`.

The manifest also declares a share target. On Android a saved file or a Soundvision PDF can be shared into the app. The service worker receives the POST, keeps the file in a cache, and sends the app to `?shared=1`, where `src/files/share-target.ts` takes it out and opens it. Playwright tests simulate the Android POST with `fetch`, because the app's strict CSP blocks form submissions.

## Autosave

While there are unsaved changes, a copy is written to IndexedDB (through idb-keyval) about a second after each edit. On the next visit the app offers to restore it. The offer says it is a safety net and not a save. The copy is checked like any opened file, and one that fails is thrown away. Saving, starting again, opening another file or declining the offer removes it. If the browser refuses IndexedDB (a private window, for example), saving to a file still works.

The `beforeunload` warning also fires while there are unsaved changes.

## Printing

`src/print/PrintSheet.tsx` renders the whole printed sheet off-screen at all times, so it can be measured, and `print.css` shows it only when printing. The editing screen is hidden in print. A draft is marked with DRAFT on every pocket panel, because a word across the whole A4 page would be cut up by the folds. The rigging page carries one.

Every card is laid out at a fixed width (half the page less padding), and its height comes from `layoutPocketCard` in `src/print/pdf-layout.ts`, the same function the PDF uses. The print view feeds it text widths measured on a canvas in the page font, and the PDF feeds it the widths of Helvetica, which match Arial. `planPages` in `src/print/layout.ts` then sorts them. A card no taller than a pocket panel (`CELL_H_MM`, 119.5 mm) stays in the panel at full size, four to a grid page. Any taller card goes in a long column (`LONG_H_MM`, 261.5 mm), two to a long page, and shrinks to fit down to 50%. A card that still does not fit at 50% has a long page to itself and is allowed to run on rather than be cut off. Long pages come first, then grid pages, each kind in report order, and the rigging summary page always comes last. The fold between two long columns is a single dashed vertical line at the 99 mm centre, drawn in the same dash, weight and grey as the grid page folds. In the print view it is the `::after` of `.as-long`, positioned absolutely so the columns keep their width and height; in the PDF it is `dashedCentre`. It is drawn even when the page holds one column.

The rigging page has a pickup table (`riggingRows`) and, when any printed array states fixations, a second table (`riggingFixations`) with the Z as the report prints it. `riggingNote` words the line under them so it names only what is listed. Both tables use fixed column widths from `pdf-layout.ts` and one line per row. `clipRiggingCell` cuts the middle out of a name that does not fit its column and keeps both ends, by the same rule in both tables, in the print view and the PDF. The fixation table gives the Array column 80 mm so the report's own derived names fit. `riggingSubtitle` builds the line under the heading (show, venue, Z-axis zero) for the print view and the PDF alike. The print stylesheet sets the row line height to 1.2 so a rigging row is the height the PDF draws. The pickup table keeps 8 pt text. The fixation table is the long one, so its rows follow the pocket card: 7 pt text in a row 10.5 pt (14.0625 CSS pixels) high, drawn by `layoutRiggingPage` and set in `print.css` (`.as-table-second`). With report E (12 pickups and 32 fixations) the page then needs about 1010 CSS pixels where 986 are free, so it is scaled to 0.975 and does not overflow. That leaves the fixation text at about 6.8 pt, the pickup text at about 7.8 pt, and the small print and the QR caption at about 6.3 pt and 5.4 pt. With the earlier 13 pt rows the scale was about 0.88. A unit test holds the PDF scale and an e2e test checks the print view row heights and scale. If a report ever needs the page scaled below about 0.9, the option is a second page for the fixations.

The rigging summary panel on screen (`RiggingSummary`) shows the same two tables and the same `riggingNote` line as the print, with every array listed and no name cut, because the screen always shows every array. The print and the PDF list only the arrays chosen for printing, plus the mirrors their cards stand for.

Only the rigging page is still measured in the browser. While printing, its measuring copy is hidden, so a measurement then would read zero. The measuring code ignores a hidden container and keeps the height it already has. A Playwright test covers this.

Each pocket panel has a header (`panelHeader` in `src/print/panel-header.ts`) and a footer of its own, because folded to A6 it is all you hold. The header names the app, the status, the show (or the Soundvision project if no show was typed) and the details that are filled in. Grid and long pages therefore have no page footer. Only the rigging page keeps one. The page planner takes the header and footer out of the height a card may use.

The footer is `printFooter`. It says which version, which Soundvision report, which file and when. A file that has changed since it was saved is marked. The last page carries the small print from `src/print/small-print.ts`. It is the approved wording of `DISCLAIMER.md`, and a test fails if the two differ by a word. Change them together, and only with the owner's approval.

The Playwright PDF tests check three things: the number of PDF pages, that every card sits inside its panel and every footer inside its page, and that the text is what the screen shows. PDF output is a Chromium feature, so those run on Chromium only.

## The rigging plot

The plot is a plan view of the flown and stacked arrays chosen for printing, drawn on a landscape A4 area and turned a quarter turn anticlockwise onto the portrait sheet, so it reads when the sheet is turned clockwise. It sits after the card pages and before the rigging summary, and a table longer than 24 points continues on further pages. A report with no drawable array has no plot page.

`src/engine/plot.ts` holds the geometry. `footprint` puts the middle of the front edge at Position and runs the box rearward by the depth, turned by the azimuth read as a compass bearing, clockwise from +Y. In samples A, C and E every pickup lies on the centre line of its box to within 0.02 m, and the front pickup lies forward of the rear one along the array axis; a test locks both. That shows the azimuth direction agrees with the report's own figures, but the distance of the front pickup from the front edge is not yet checked against a real hung array. `numberPickups` numbers the pickups: arrays are grouped in rows by Position Y, highest first, a row being arrays within 1 m of the first one in it; inside a row the highest X comes first; a front pickup comes before the rear one of its array. An array with no Position, spatial dimensions or azimuth is left off and named under the plot. A stacked array uses the same footprint and carries no pickups, so it is not numbered; in sample E the fixation positions of every stack lie on the front and rear edges of its box, and a test locks that, which confirms Position is the front edge for stacks too.

`src/print/plot-layout.ts` is one pure function, `layoutPlotPages`, that returns drawing steps in millimetres (lines, circles and text with colour roles). `PlotSvg.tsx` draws them for the print view (rotated) and the on-screen preview, and `plot-pdf.ts` draws them with pdf-lib, so the three agree. The screen palette has red and green axes and a red Position dot; the print palette is black and grey. The scale is the largest standard ratio (1:50 to 1:2500) at which everything, the origin included, fits. A pickup symbol is 250 mm across at scale but never under 2 mm on paper. The Position dot is 0.55 mm in radius at 1:150 and shrinks with the scale to a floor of 0.3 mm (`dotRadiusMm`). A stack is a solid box with crossed corners and a hollow square Position (`stackBox`, `stackPosition`). The plot shows no heights: array labels are the name alone and pickup labels are the number and the motor load, so the ground offset plays no part in it. The one figure the plot works out is the spacing between an array's front and rear pickups, `planSpacing` in `src/engine/plot.ts`, the distance on the plan from X and Y only, rounded to 2 decimals. It is on the line between the pickups next to the total weight and in the Spacing column on the front row. Array labels are placed in the best of nine fixed orders and six seeded shuffles, tried on copies, so the same report always gives the same drawing. Labels try the right of the marker first, then left, above and below, then further out with a thin leader line. The small print is `PLOT_SMALL_PRINT` in `small-print.ts`, locked by a test.

Known label clashes: labels keep clear of lines, markers, boxes and each other, but placement is greedy. In sample A one leader still runs through the label of a neighbouring array, because ten arrays and four stacks sit in a row about 12 mm apart. In sample C, at 1:400, the six KS28 and four KARA II stacks stand in pairs a few millimetres from the origin lines, so several leaders there cross an origin line or a neighbour's label, and a test allows up to ten such leaders on C. Sample E has none. A new clash on A or E fails a test.

Phase one draws the 1 ton circle with a cross on every pickup. Choosing other symbols, custom values, and the two print ticks come later.

## Choosing what to print

Each array has a Print this array checkbox. The choices are saved in the file as one true or false per array (`print`). Unticked arrays leave the print sheet and the image export, and the rigging page lists only the pickups and fixations of the printed arrays. A card that stands for a mirror image carries that mirror's pickups and fixations with it. With the mirrored arrays shown, each array is chosen on its own. The screen always shows every array.

An approved or superseded file cannot change, but it can still be printed in part. Its choices are held for the session only (`printOverride` in `src/files/doc.ts`), are never saved and do not count as a change. Create new revision starts from the choices in force. Update from PDF keeps a choice with the array of the same name. Print is off while no array is ticked.

## The one-click PDF

Download PDF builds the same sheet as the print view without opening the print window. `src/print/pdf-layout.ts` lays out one pocket card and the rigging page as drawing steps in points, and is pure, so it has ordinary unit tests. `src/print/pdf-export.ts` draws those steps with `pdf-lib` on A4 pages: long pages first (one or two full-height panels with a dashed centre fold line), then four panels to a page with dashed fold lines, a header and footer on every panel, a DRAFT word on every panel of a draft, and the rigging page with the QR code and the small print last. The page planner (`planPages`) and the card height (`layoutPocketCard`) are the same ones the print view uses, so both outputs plan every array from the same number. The only input that differs is the text width, which is measured on a canvas in the browser and read from Helvetica in the PDF. Those two agree for ordinary text, but a line that wraps differently in the two could still move a card by one line, and an array that lands within one line of the 119.5 mm limit could in principle be placed differently. The tests do not find such a case in the sample reports.

Text uses the PDF's built-in Helvetica, so nothing is fetched or embedded. Helvetica holds Western European characters only. Anything else, such as Greek or Japanese in a show name, is replaced with a question mark so the file can still be made.

`pdf-lib` is MIT licensed and has no network code. It is loaded only when the button is pressed, so it adds nothing to the first load. The tests build the PDF and read it back with the app's own PDF reader.

## Card size

A pocket panel has 119.5 mm for a card once its padding, header and footer are taken out. That holds 16 enclosure rows for a card that also has a mirror note and a motor load line, and a card without a mirror note has room for one or two rows more. Long warnings, extra motor lines, a long frame name that wraps onto a second line and a long title or group each take a line and can cost a row or two. Pocket cards always print at full size. A taller card goes in a long column with 261.5 mm, which holds about 54 rows at full size. The half-size limit of 50% is a backstop that holds about 120 rows, and no real array comes near it.

The card height in `pdf-layout.ts` reproduces the print stylesheet as Chromium lays it out: a fact row and a table row are each 14.0625 CSS pixels, a border of 0.25 or 0.4 mm is one pixel, and the title line height is 1.15. An end-to-end test measures the table rows and compares the height of every rendered card in the sample report with the height the page was planned from, to within 0.5 mm. Tests cover 12, 16, 17, 18 and 24 rows in both outputs, and a separate test checks that the warning banner appears for an array of 140 rows. That test checks the banner only, not the layout of such a card.

## Images

A stacked array that has fixations shows a small block under the facts: a heading row (`Fixations`, `X (m)`, `Y (m)`, `Z (m)`) and one row for each position, with the values as the report prints them. The Z is the report's own. The ground offset is not taken off it, which matches the pickup positions in the rigging summary and the Position X, Y, Z fact. The block is one heading row and one row for each position, plus a gap, so four positions cost about five rows and a gap. A stacked card with fixations can therefore be taller than a pocket panel, and a tall stack may need a long column. A name longer than 12 characters is cut with an ellipsis on the card, in the PDF and in the image. The cut keeps it inside its column and keeps the row height. The report's own names are two letters. `layoutPocketCard`, the print stylesheet (`.pc-fix`), the image layout and the screen card all draw it from the same data.

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
- Only Soundvision is supported. Other tools would need their own reader.
