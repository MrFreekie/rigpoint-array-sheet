# RigPoint Array Sheet

Turn a Soundvision report PDF into a short, readable page of the array and rigging information, and print it.

RigPoint Array Sheet is the second app in the RigPoint family, after [RigPoint Load Sheet](https://github.com/MrFreekie/rigpoint-load-sheet). It follows the same rules: everything runs in the browser, nothing is sent anywhere, and the app is honest about what it has and has not checked.

## Where it is

You can open a Soundvision PDF and see a fly sheet card for every array, a rigging plot and a rigging summary. You can type the show details and a ground offset, give an array a title (up to 60 characters) and a note for the crew (up to 300), choose a feeder and a way for each enclosure, group the enclosures of an array into carts, delete an array and bring it back, save the lot as a file, open it again later, print it, save it as a PDF, and save each array as an image. The rigging plot can be downloaded as a DXF, and a venue can be drawn under it. The app installs on a computer or phone and works with no signal once it has been opened once.

## The rigging plot

The rigging plot is under development and may include errors. Check it against the Soundvision report.

It is a plan view of the arrays chosen for printing, drawn from the report's Position, spatial dimensions and azimuth. Stage is at the bottom and the audience at the top. House left is on the right of the page, as Soundvision shows it. The origin is labelled with the note you type in Origin (P0). The Show side labels on the rigging plot tick names the four sides, and can be unticked for a show in the round. Pickups are numbered, each array is labelled with its total weight and the distance between its two pickups, and a table lists every point with its X and Y. A bar 100 mm long lets you check the scale on paper. A stacked array is drawn too. So is an array with no pickup, but the report does not say what holds that one up. The plot has a credit line under its footer.

Each pickup has a symbol for a nominal rating: 2 t, 1 t, 0.5 t or 0.25 t. You pick the shape on the card. A value you type, up to 12 characters, replaces the rating and the symbol is drawn grey. Any shape can be picked for any array, whatever its weight.

Download DXF saves the plot for a CAD program, in millimetres at full size (1:1), with the origin at 0,0 and the elements on separate layers.

In Settings you can import a venue from the text file that SU4SV, the SketchUp to Soundvision converter, writes. It is drawn as pale grey lines under the plot, shaded by height, with a tick for each SketchUp layer. A model over 60,000 lines, 300 layers or 8 MB is refused. A file holds one venue. The venue never changes the scale or the page, and it goes into the DXF only if you tick Include venue in the DXF.

An array is built from carts of three or four enclosures, sometimes six. Each card shows its carts and prints every other cart shaded, so a crew can see where one cart ends and the next begins. The carts are cut from a size for each type of enclosure (the Settings button holds the table, and it starts with K2 four to a cart and KARA II and KARA three), and a new cart always starts where the type changes. A flown array is counted from the top and a stack from the bottom. You can cut any array by hand with a break between two rows, and the app keeps what you did until you choose Back to automatic. Settings also holds the origin note, the side labels of the plot, the venue, the ground offset every array uses, and whether the exact mirror images are shown.

## Printing, PDF and images

Download PDF makes the PDF in one click, with no print window. Print / PDF opens the print window instead, for printing on paper straight away.

Type the show, the venue, the engineer and the company once, and they go on every pocket card. Every array card has a Print this array checkbox, ticked to begin with. Only the ticked arrays are printed or saved as images, and the rigging page lists only their pickups and fixation positions. The choice is saved with the file.

Each A4 page holds four arrays in a two by two grid, in the order of the report. Fold the page in half twice and every array is on its own A6 panel, small enough for a pocket. Dashed lines mark the folds. An array taller than a panel goes in a long column instead. A panel holds 20 rows with a mirror note, and long warnings, a long frame name or a long title can cost a row or two. A stacked array with fixation positions costs about five more rows and a gap, so a tall stack may need a long column. A long column is the full height of the page, two to a page, folded once, with a dashed line down the middle at the fold, as on the pages of four. Long pages come first, then the pages of four, then the rigging plot, and the last page is the rigging summary, with a QR code at its foot that opens this app. It lists the pickups, then the fixation positions, of the arrays chosen for printing and of the mirrors their cards stand for. The rigging summary on screen lists every array.

Every pocket panel carries its own header and footer, so a folded card still says whose it is. The header has the show and venue (or the Soundvision project if none is typed) and the status and revision. Under that come the show date, the project, the engineer, the company and the Z-axis zero, whichever are filled in. The footer has the app version, the Soundvision version, the file name (marked when it is unsaved), the time it was printed and the page number, with a credit line under it. An array with a single pickup shows its position in a Frame/Bar Hole row. The rigging summary also gives each pickup's distance to the front and rear edge of its array. Drafts carry a DRAFT watermark on every pocket panel, so each folded card is marked. The sheet is black on white whatever theme the screen is in.

Save image on a card saves that array as a PNG. Save selected as images saves one for every ticked array. Your browser may ask whether to allow several downloads.

## Install it, and use it with no signal

In Chrome or Edge, click the install icon at the end of the address bar and choose Install. On Android, use Add to home screen. On iPhone, use Share, then Add to Home Screen.

Once you have opened the app once, it works offline, installed or not, including opening a Soundvision PDF. When there is a new version, the app shows "Update available, reload". Press Reload when it suits you. The app never updates in the middle of an edit, and unsaved changes are offered back after the reload.

See the [user guide](docs/user-guide.md) for a short walk through. A plan for printing one array on a small battery receipt printer is in [docs/receipt-printer-plan.md](docs/receipt-printer-plan.md).

## Saving and files

Save writes a file named like `Main stage - Rev B.arraysheet.json`. In every browser it arrives as a download. In Chrome and Edge on a computer, Open and Save use the browser's own file picker, so Save writes back to the same file each time, Save As picks a new one, and Recent lists the files you used last. A new revision never writes over the file it came from. The file holds what the PDF said, what you typed, the status and the revision, so it reopens exactly as saved, without the PDF. Open takes either a PDF or one of these files. In the installed app on a computer, double-clicking one of these files opens it. On Android you can share one of these files, or a Soundvision PDF, straight into the app.

The file format is `arraysheet/12`. Older files are upgraded when opened, and a file from a newer version of the app is refused rather than opened and trimmed. Each step added something: formats 6 to 12 added the origin note and side labels, card titles, notes, deleted arrays and the show notes and date, the plot symbols, the venue, the cable patch, the carts, and the rows of a ground stack.

Each file has a status: Draft, Issued, Approved or Superseded. Approved and superseded files open read-only. To change one, press Create new revision. That starts a draft with the next revision letter (blank, then A, B, C), which you save under its new name.

If you have a saved file open and a newer PDF arrives, press Update from PDF. The app lists exactly what differs, and you choose Update from new PDF or Keep as saved. Your show details, offsets, print choices, titles, notes, plot symbols, cable patches and venue stay with the arrays of the same name. A symbol goes back to 1 t if its pickup is gone. A cable patch is cleared, and listed, if the array has a different number of enclosures. An array you deleted comes back if the new PDF has it.

While you have unsaved changes, this browser also keeps a copy and offers it back after a crash or an accidental close. That copy is a safety net. Save to a file to keep your work.

To try it, run `npm install` and `npm run dev`, then open the address it prints.

## What it reads

Soundvision reports from L-Acoustics, version 2026.3.1 so far. For each array (Soundvision calls them sources) it takes:

- the array name, the groups it sits in, and whether it is flown or stacked
- the enclosure type, angle, site angle and top and bottom heights of each row, plus the Panflex setting
- the bumper, the number of motors, each pickup position and its coordinates
- the fixation positions of a stacked array, when the report states them
- the position, site, azimuth, size, bottom elevation, top site and bottom site
- the total weight, the enclosure weight and the motor loads
- the mechanical warnings Soundvision prints

Figures are shown as the PDF prints them, in kilograms and metres. The acoustic settings (filters, gain, delay, air compensation) are not read.

## What it does not do

It does not calculate anything. Totals, loads and angles come from the PDF and nothing else. If the PDF and your own sums disagree, the PDF is what the app shows.

The cable patch is only what you type: a feeder and a way digit for each enclosure. It does not count them, check them or work out a length or a load.

It does not check that a rig is safe. Soundvision's own warnings are passed through, and that is all.

When something cannot be read, the app says so and names the array. It never fills the gap with a guess. A report in pounds or feet is refused, because the app reads kilograms and metres only.

When two arrays are exact mirror images, left to right or front to back, the fly sheet shows one and says `Also mirrored with: <name>` under its title. A button above the cards, and a tick in Settings, show both. Only the report decides which arrays are mirrors, so a title, note, ground offset, cable patch or carts you typed never splits a pair. A card that stands for a pair prints its own. A front to back pair is only found when the arrays have no fixations and the same Panflex figures.

The one value it works out itself is the Panflex label on a fly sheet (for example 90 On). That rule is described in [docs/development.md](docs/development.md).

Read the [disclaimer](DISCLAIMER.md) before relying on any sheet. It is printed word for word on the last page of every printout.

## Privacy

The PDF is opened on your device. There is no server, no account, no tracking and no outside network call.

## For developers

Node.js 24 or later.

```bash
npm install
npm run ci
```

See [docs/development.md](docs/development.md) for the layout and how the tests work.

## Licence

Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0). See [LICENCE](LICENCE) for the full text.
