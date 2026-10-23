# User guide

RigPoint Array turns a Soundvision report PDF into pocket cards: one card for each array, with a rigging summary at the end. This guide covers what you need on the day.

## Open a report

1. Export the report from Soundvision as a PDF, in kilograms and metres.
2. Press Open and choose the PDF, or drop it anywhere on the page.

The PDF is read on your device. Nothing is uploaded.

You will see one of three messages above the cards:

- READ OK: every line in the array sections was understood and the report's own figures agree with each other. This does not check the design.
- CHECK: something looks odd, such as a line the app did not understand. Each item names the array. Compare it with the PDF.
- ERROR: the report cannot be relied on, for example because it is in pounds or feet. The cards are not shown.

## Fill in the show details

Show, venue, system engineer, company and Z-axis zero go on every pocket card, so a folded card still says whose it is. Soundvision does not state the venue, so type it. Origin (P0) says where the Soundvision origin is, for example DSE, Iron Line or Arena Centre. It is printed on the rigging plot.

Ground offset is how far below the report's heights your floor is. A report height of 9.4 m with an offset of 0.3 m shows as 9.1 m. Set one offset for every array, or type a different one on a single card. If you leave it blank the heights are the report's own.

## The rigging plot

The rigging plot is under development and may include errors. Check it against the Soundvision report.

Below the cards, and on the page before the rigging summary, the app draws a plan view of the flown and stacked arrays chosen for printing. Stage is at the bottom of the page and the audience at the top. House left is on the right of the page, as Soundvision shows it, and +X and +Y are marked from the origin. The origin is drawn with a dash-dot line and labelled with the note you typed in Origin (P0). The grid is every 10 m. The plot names the sides of the plan (House left, House right, Stage and Audience). For a show in the round, untick Show side labels on the rigging plot in the show details and those four names are left off.

Each array is a dashed box. Its width and depth are the report's spatial dimensions. The Position is the middle of the front edge, the box runs back from there, and it turns by the azimuth. A small red dot (black in print) marks the Position, and it gets smaller as the scale gets smaller so it stays small against small boxes. A flown array with no pickup gets a solid box and no number. Each pickup has a circle with a cross, centred on its X and Y, and a label with its number (PA1, PA2 and so on), its motor load, and its height. When you have set a ground offset, the height after the offset is shown in brackets after the report's own, for example 9.40 m (8.90 m). A line joins the front and rear pickups of an array and carries the total weight.

An array standing on the ground is drawn as a solid box with its corners joined by two thin lines, and its Position is a small hollow square, so it cannot be mistaken for a flown array. It has no pickup, no number and no row in the table. Its label gives its name, and its Position Z when that is not zero, exactly as the report prints it with no ground offset taken off. Stacks often stand under flown arrays, so the labels of a crowded row are placed to keep clear of each other, with a thin line to the box when one has to sit further away. On a busy plan a few labels may still touch a line, so check it against the report.

Pickups are numbered in rows from the audience end to the stage end, and from house left to house right inside a row. An array joins a row when its Position Y is within 1 m of the first array in that row. The front pickup of an array has the lower number.

The page also lists every point with its X and Y, a key, the scale and the small print. A bar 100 mm long lets you check the scale with a ruler. For the right scale, print the file from Download PDF at 100 percent. Above 24 points the table continues on a second page.

The plot is drawn only from the report. It does not show shackles, slings, trusses, motors or any other rigging, and the pickup symbol is a nominal guide. It is a design aid, not a CAD drawing.

## Check the cards

Each card shows what the report states: weights, motor loads, heights, site angles, azimuth, frame, pickups, Soundvision's warnings, the fixation positions of a stacked array when the report lists them (X, Y and Z as the report prints them, with no ground offset taken off), and a row for each enclosure with its Panflex label (for example 90 On).

Arrays that are exact left-right copies show once. The card says MIRRORED and the name of the other array. Tick Show the mirrored arrays too to see both.

## Choose what to print

Each card has a Print this array checkbox. Unticked arrays are left out of the printout, the images and the pickups and fixation positions on the rigging page. The choice is saved with the file.

## Print, download or save images

- Print / PDF opens your print window. Choose a printer, or Save as PDF.
- Download PDF makes the PDF in one click, with no print window.
- Save image on a card saves that array as a PNG. Save selected as images saves one for every ticked array.

The PDF has four arrays on each A4 page. Fold the page in half twice and each array is on its own A6 panel, with dashed lines marking the folds. A panel holds an array of up to 16 rows, with its mirror note. A long warning, a long frame name or a long title can take a row or two of that room. The fixation positions of a stacked array take about five rows and a gap, so a tall stack may move to a long column. An array that is taller goes in a long column that runs the full height of the page. Two long columns share a page, which you fold once, and a dashed line down the middle shows where, as on the pages of four. The line is there even when a page holds only one column. Long pages come first. Every panel and column carries a header and a footer, so it still says what it is when folded. The rigging plot comes next, drawn across the page, so turn the sheet to read it. The last page is the rigging summary and the small print. It has a table of every pickup and, below it, a table of every fixation position (array, fixation, X, Y and Z as the report prints them). Mirrored arrays are listed too, because their positions differ. A report with eight stacks has 32 fixation positions, so its rigging page is printed about 2.5 per cent smaller to fit on one sheet. The fixation rows are set in the same compact type as the pocket cards to keep that reduction small. The rigging summary on screen lists every array and never cuts a name. The printed page and the PDF list only the arrays chosen for printing, plus the mirrors that their cards stand for. A name too long for its column in print or the PDF loses its middle to an ellipsis, so the end of the name stays readable.

A draft has DRAFT on every panel. Set the status to Issued or Approved when the sheet is final.

## Save your work

Save writes a file such as `Main stage - Rev B.arraysheet.json`. It holds what the PDF said and what you typed, so you can reopen it later without the PDF.

In Chrome and Edge on a computer, Save writes back to the same file, Save As picks a new one, and Recent lists your last files. In other browsers Save downloads a new file each time.

While you have unsaved changes the app also keeps a copy in the browser and offers it back after a crash. That copy is a safety net. Save to a file to keep your work.

## Status and revisions

Draft, Issued, Approved and Superseded are the four statuses. Approved and superseded files open read-only. You can still choose what to print, but nothing is saved.

To change an approved file, press Create new revision. It starts a draft with the next letter (blank, then A, B, C) and never writes over the old file. Setting the old one to Superseded is up to you.

## A newer PDF arrives

With your file open, press Update from PDF and choose the newer report. The app lists exactly what differs. Choose Update from new PDF or Keep as saved. Your show details, offsets and print choices stay with the arrays of the same name.

## Install it and use it offline

In Chrome or Edge, use the install icon in the address bar. On Android, use Add to home screen. On iPhone, use Share, then Add to Home Screen. Open the app once with a signal, and after that it works with none, including opening a PDF.

When there is a new version the app shows Update available. Press Reload when it suits you. It never updates in the middle of an edit.

## Things worth knowing

- Everything shown comes from the PDF. The app does not calculate loads or check that a rig is safe.
- Read the [disclaimer](../DISCLAIMER.md). It is printed on the last page of every printout.
- Soundvision report version 2026.3.1 has been tested. If a newer version changes the layout, lines the app does not understand appear as CHECK items.
