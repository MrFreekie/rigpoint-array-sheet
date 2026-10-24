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

Show date is optional. Pick it with the date field and it prints day, month, year, for example 23/10/2026, beside the venue on every pocket card, on the rigging plot and on the rigging summary. It is separate from the date inside the Soundvision report. Leave it blank and nothing is printed.

Notes is a box for anything the whole crew needs to know about the show, up to 500 characters, with line breaks kept. It prints as a Notes paragraph under the heading of the rigging summary, and only there. Each array also has its own note on its card. Leave the box blank and the page is unchanged.

Ground offset is how far below the report's heights your floor is. A report height of 9.4 m with an offset of 0.3 m shows as 9.1 m. Set one offset for every array, or type a different one on a single card. If you leave it blank the heights are the report's own.

## The rigging plot

The rigging plot is under development and may include errors. Check it against the Soundvision report.

Below the cards, and on the page before the rigging summary, the app draws a plan view of the arrays chosen for printing. Stage is at the bottom of the page and the audience at the top. House left is on the right of the page, as Soundvision shows it, and +X and +Y are marked from the origin. The origin is drawn with a dash-dot line and labelled with the note you typed in Origin (P0). The grid is every 10 m. The plot names the sides of the plan (House left, House right, Stage and Audience). For a show in the round, untick Show side labels on the rigging plot in the show details and those four names are left off.

Each array is a dashed box. Its width and depth are the report's spatial dimensions. The Position is the middle of the front edge, the box runs back from there, and it turns by the azimuth. A small red dot (black in print) marks the Position, and it gets smaller as the scale gets smaller so it stays small against small boxes. An array with no pickup gets a solid box and no number. It is drawn where the report puts it in space, and the report does not say what holds it up. It may hang from something the report does not describe, or stand on a tripod, a yoke bracket or another item. Any array the report does not mark as stacked is drawn this way, whatever the report says about its mounting. The plot leaves an array off only when the report gives no Position, spatial dimensions or azimuth for it, and it then names that array under the plot. Each pickup has a circle with a cross, centred on its X and Y, and a label with its number (PA1, PA2 and so on) and its motor load. The plot shows no heights, so the ground offset does not change it. A plain line joins the front and rear pickups of an array. Each array is labelled with its name, then Total with the total weight the report states, then Spacing with the distance between its two pickups, for example Total 1332.6 kg and Spacing 1.01 m. The Total line is left out when the report states no total, and the Spacing line when the array has fewer than two pickups. The spacing is calculated from the X and Y positions in the report, as a distance on the plan, and ignores height. It is also in the table, on the front row of each array that has both pickups. The site angle and the heights are not on the plot, because they are on each card and in the rigging summary.

An array standing on the ground is drawn as a solid box with its corners joined by two thin lines, and its Position is a small hollow square, so it cannot be mistaken for an array with no pickup. It has no pickup, no number and no row in the table. Stacks often stand under other arrays, so the labels of a crowded row are placed to keep clear of each other, with a thin line to the box when one has to sit further away. On a busy plan a few labels may still touch a line, so check it against the report.

The rigging summary table has two more columns, To front and To rear, which say how far each pickup sits from the front and rear edge of its array's box. They are calculated from the report's Position, Spatial dimensions and Azimuth, measured along the array in metres. The Pickup column says Front or Rear for an array with two pickups and Single for an array with one. A front pickup shows its distance to the front edge, a rear pickup its distance to the rear edge, and an array with a single pickup shows both. A figure above zero means the pickup is inside the box. A figure below zero means it sits outside, in front of the front edge or behind the rear edge, which happens. A dash means the report does not give enough to work it out.

Pickups are numbered in rows from the audience end to the stage end, and from house left to house right inside a row. An array joins a row when its Position Y is within 1 m of the first array in that row. The front pickup of an array has the lower number.

The page also lists every point with its X and Y. The Pickup column says Front or Rear for an array with two pickups and Single for an array with one. The page also has a key, the scale and the small print. A bar 100 mm long lets you check the scale with a ruler. For the right scale, print the file from Download PDF at 100 percent. Above 24 points the table continues on a second page.

### Pickup symbols

Each pickup is drawn as a symbol that stands for a nominal rating in metric tonnes: a square with a cross for 2 t, a circle with a cross for 1 t, a triangle with a cross for 0.5 t and a diamond with a cross for 0.25 t. The circle is the default. Choose another on the card, under Plot symbol. An array with a front and a rear pickup has one choice for each. All the symbols are the same size, and the table gives each point's symbol in the Symbol column.

Every shape can be picked for any array, whatever its weight. The plot does not check a symbol against the weight of the array. If you type a value such as 1.5 t, it replaces the rating in the table and under the pickup label, and the symbol is drawn grey on the plot, with a note in the key that a custom value is noted on the plot. A mirror image that shares a card with its partner has the same symbols as that card. On an approved or superseded file you can still pick symbols for this session, but they are not saved. Update from PDF keeps a symbol when the array of the same name still has the same pickup, and tells you about any it cannot keep, which go back to 1 t.

The plot is drawn only from the report. It does not show shackles, slings, trusses, motors or any other rigging, and the pickup symbol is a nominal guide. It is a design aid, not a CAD drawing.

### Venue under the plot

Under the plot on screen is a Venue under the plot box. It takes the text file that SU4SV writes, the SketchUp to Soundvision converter, and draws the venue as a pale grey line drawing under the plot, to give the arrays some context. Choose Import venue and pick the file. It must be in metres. Choose Replace venue to use another file, or Remove venue to take it away again.

Only the plan is kept. Every face in the model becomes lines, lines that are drawn twice are kept once, and the height is dropped, except that it picks the shade: the lowest parts are the darkest grey and the highest the lightest. All the lines are the same thin weight. The seats and everything else in the file are kept, so keep the SketchUp model basic. A model with more than 60,000 lines after duplicates are removed, more than 300 layers, or a file over 8 MB is refused with a message. Simplify the model in SketchUp, for example by deleting detail the plot does not need, and export it again.

The venue never changes the plot. The scale and the page come from the arrays and the origin only, so a venue much bigger than the arrays is cut at the edge of the plot, and a small one does not make the plot any bigger. The coordinates in the file are used as they are, because SU4SV writes them in the same axes as Soundvision, with the origin of the Soundvision report at 0,0.

The layers of the file are SketchUp layers, and each has a tick under Layers to show. Every layer is on when a venue is imported, because the names are not the same in every model. Untick the ones you do not want, such as roof trusses that cover the arrays. Which layers are on is kept with the file. The converted lines are kept in the saved file too, not the original text, and Update from PDF keeps them. An approved or superseded file cannot have a venue imported, changed or removed.

Under Download DXF is an Include venue in the DXF tick, off to start with. When it is on, the DXF carries the layers that are shown, every line of them and not only the part inside the plot page, at full size in millimetres like the rest of the file. Each SketchUp layer is a DXF layer of its own, named VENUE_ and the SketchUp layer name, so you can switch them off in your CAD program. The greys follow the height, and the height itself is not kept.

### Download DXF

Under the plot on screen is a Download DXF button. It saves the same plot as a DXF file that CAD programs open. The units are millimetres at full size (1:1), and the app says so beside the button and inside the file. The origin of the Soundvision report is 0,0, +X is towards house left and +Y is towards the audience, so every coordinate is the report's figure in metres times 1000. A 1.2 m wide array is 1200 units wide. When you bring the file into your CAD program, choose millimetres if it asks.

The file has the same arrays, pickups, labels and axes as the plot, drawn on separate layers: ARRAYS for arrays with pickups, ARRAYS_NO_PICKUP, STACKS and STACK_DIAGONALS, POSITIONS, PICKUPS, PICKUP_LINKS and PICKUPS_CUSTOM (symbols with a typed value, which are grey on the plot), LABELS and LEADERS, ORIGIN, AXIS_X and AXIS_Y, SIDES and NOTES. Pickup symbols are 250 mm across. Labels are plain text with no formatting, placed where the plot page puts them and sized so they read at the scale of the plot page, so at a different scale in your CAD program you may want to resize them. The small print of the plot page is in the file as text under the drawing.

The DXF has no scale bar, because it is already full size. It is a design aid and not a definitive CAD drawing. Check every figure against the Soundvision report.

## Check the cards

Each card shows what the report states: weights, motor loads, heights, site angles, azimuth, frame, pickups, Soundvision's warnings, the fixation positions of a stacked array when the report lists them (X, Y and Z as the report prints them, with no ground offset taken off), and a row for each enclosure with its Panflex label (for example 90 On).

Arrays that are exact mirror images of each other show once, whether the mirror runs left to right or front to back. The card has a small line under its title that says Also mirrored with and the name of the other array. Tick Show the mirrored arrays too to see both. Two arrays with different notes keep a card each, so no instruction is hidden. A front to back pair is only found when the arrays have no fixations and the same Panflex figures, because those have not been checked for such a pair.

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

## Card title and notes for the crew

Each card has a Card title box. Type a name there and it replaces the array name on the card, the printed sheet, the PDF, the images, the rigging plot, the DXF and the rigging summary. Clear the box to go back to the name in the report. The card then carries a small line, Soundvision name, with the name from the report, so the two can always be matched. The title is kept with the file, and Update from PDF still finds the array by its report name, so the title survives an update.

Each card also has a Notes for the crew box for instructions, up to 300 characters, with the line breaks you type. The note prints on the card under the mirror line, after the word Note. It is not shown on the rigging plot, the DXF or the rigging summary. An approved or superseded file cannot be changed, so both boxes are switched off there.

## Deleting an array

Each card has a Delete array button. A deleted array leaves the cards, the printed sheet, the PDF, the rigging plot, the DXF and the rigging summary, and the checks that concern only that array are hidden. Mirrored arrays stay together until one is deleted, and then the other has a card of its own.

Undo delete, beside Save selected as images, brings back the last array you deleted, and it can be pressed again for the one before. The undo list lasts for the session only. A list under the cards shows what is deleted, each with a Restore button, and that list is saved with the file, so you can restore an array after reopening it.

A deleted array stays in the file, marked as deleted. The file holds the report as read either way, so deleting and restoring does not make it any bigger. An approved or superseded file cannot be changed, so nothing can be deleted or restored in it.

## A newer PDF arrives

With your file open, press Update from PDF and choose the newer report. The app lists exactly what differs. Choose Update from new PDF or Keep as saved. Your show details, offsets, print choices, titles and notes stay with the arrays of the same name. An array you deleted comes back if the new PDF has it, and the list marks it as restored.

## Install it and use it offline

In Chrome or Edge, use the install icon in the address bar. On Android, use Add to home screen. On iPhone, use Share, then Add to Home Screen. Open the app once with a signal, and after that it works with none, including opening a PDF.

When there is a new version the app shows Update available. Press Reload when it suits you. It never updates in the middle of an edit.

## Things worth knowing

- Everything shown comes from the PDF. The app does not calculate loads or check that a rig is safe.
- Read the [disclaimer](../DISCLAIMER.md). It is printed on the last page of every printout.
- Soundvision report version 2026.3.1 has been tested. If a newer version changes the layout, lines the app does not understand appear as CHECK items.
