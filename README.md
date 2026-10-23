# RigPoint Array

Turn a Soundvision report PDF into a short, readable page of the array and rigging information, and print it.

RigPoint Array is the second app in the RigPoint family, after [RigPoint Load Sheet](https://github.com/MrFreekie/rigpoint-load-sheet). It follows the same rules: everything runs in the browser, nothing is sent anywhere, and the app is honest about what it has and has not checked.

## Where it is

You can open a Soundvision PDF and see a fly sheet card for every array plus a rigging summary. You can type the show details and a ground offset, save the lot as a file, open it again later, print it, save it as a PDF, and save each array as an image. The app installs on a computer or phone and works with no signal once it has been opened once.

## Printing, PDF and images

Download PDF makes the PDF in one click, with no print window. Print / PDF opens the print window instead, for printing on paper straight away.

Type the show, the venue, the engineer and the company once, and they go on every pocket card. Every array card has a Print this array checkbox, ticked to begin with. Only the ticked arrays are printed or saved as images, and the rigging page lists only their pickups. The choice is saved with the file.

Each A4 page holds four arrays in a two by two grid, in the order of the report. Fold the page in half twice and every array is on its own A6 panel, small enough for a pocket. Dashed lines mark the folds. An array too tall for a panel gets a page of its own. The last page is the rigging summary, with a QR code that opens this app.

Every pocket panel carries its own header and footer, so a folded card still says whose it is. The header has the app name, the status and revision, the show, and the Soundvision project with the engineer, company and Z-axis zero. The footer has the app version, the Soundvision version, the file name (marked when it is unsaved), the time it was printed and the page number. Drafts carry a DRAFT watermark on every pocket panel, so each folded card is marked. The sheet is black on white whatever theme the screen is in.

Save image on a card saves that array as a PNG. Save selected as images saves one for every ticked array. Your browser may ask whether to allow several downloads.

## Install it, and use it with no signal

In Chrome or Edge, click the install icon at the end of the address bar and choose Install. On Android, use Add to home screen. On iPhone, use Share, then Add to Home Screen.

Once you have opened the app once, it works offline, installed or not, including opening a Soundvision PDF. When there is a new version, the app shows "Update available, reload". Press Reload when it suits you. The app never updates in the middle of an edit, and unsaved changes are offered back after the reload.

See the [user guide](docs/user-guide.md) for a short walk through. A plan for printing one array on a small battery receipt printer is in [docs/receipt-printer-plan.md](docs/receipt-printer-plan.md).

## Saving and files

Save writes a file named like `Main stage - Rev B.arraysheet.json`. In every browser it arrives as a download. In Chrome and Edge on a computer, Open and Save use the browser's own file picker, so Save writes back to the same file each time, Save As picks a new one, and Recent lists the files you used last. A new revision never writes over the file it came from. The file holds what the PDF said, what you typed, the status and the revision, so it reopens exactly as saved, without the PDF. Open takes either a PDF or one of these files. In the installed app on a computer, double-clicking one of these files opens it. On Android you can share one of these files, or a Soundvision PDF, straight into the app.

Each file has a status: Draft, Issued, Approved or Superseded. Approved and superseded files open read-only. To change one, press Create new revision. That starts a draft with the next revision letter (blank, then A, B, C), which you save under its new name.

If you have a saved file open and a newer PDF arrives, press Update from PDF. The app lists exactly what differs, and you choose Update from new PDF or Keep as saved. Your show details and offsets stay.

While you have unsaved changes, this browser also keeps a copy and offers it back after a crash or an accidental close. That copy is a safety net. Save to a file to keep your work.

To try it, run `npm install` and `npm run dev`, then open the address it prints.

## What it reads

Soundvision reports from L-Acoustics, version 2026.3.1 so far. For each array (Soundvision calls them sources) it takes:

- the array name, the groups it sits in, and whether it is flown or stacked
- the enclosure type, angle, site angle and top and bottom heights of each row, plus the Panflex setting
- the bumper, the number of motors, each pickup position and its coordinates
- the position, site, azimuth, size, bottom elevation, top site and bottom site
- the total weight, the enclosure weight and the motor loads
- the mechanical warnings Soundvision prints

Figures are shown as the PDF prints them, in kilograms and metres. The acoustic settings (filters, gain, delay, air compensation) are not read.

## What it does not do

It does not calculate anything. Totals, loads and angles come from the PDF and nothing else. If the PDF and your own sums disagree, the PDF is what the app shows.

It does not check that a rig is safe. Soundvision's own warnings are passed through, and that is all.

When something cannot be read, the app says so and names the array. It never fills the gap with a guess. A report in pounds or feet is refused, because the app reads kilograms and metres only.

When two arrays are exact left-right mirror images, the fly sheet shows one and says so on its card. A checkbox shows both.

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
