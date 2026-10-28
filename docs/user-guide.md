# User guide

RigPoint Array Sheet turns a Soundvision report PDF into pocket cards: one card for each array, with a rigging summary at the end. This guide covers what you need on the day.

## Open a report

1. Export the report from Soundvision as a PDF, in kilograms and metres.
2. Press Open and choose the PDF, or drop it anywhere on the page.

The PDF is read on your device. Nothing is uploaded.

You will see one of three messages above the cards:

- READ OK: every line in the array sections was understood and the report's own figures agree with each other. This does not check the design.
- CHECK: something looks odd, such as a line the app did not understand. Each item names the array. Compare it with the PDF.
- ERROR: the report cannot be relied on, for example because it is in pounds or feet. The cards are not shown.

## Fill in the show details

Show, venue, system engineer, company and Z-axis zero go on every pocket card, so a folded card still says whose it is. Soundvision does not state the venue, so type it. Origin (P0) says where the Soundvision origin is, for example DSE, Iron Line or Arena Centre. It is printed on the rigging plot. Type it in the row under the plot preview.

Show date is optional. Pick it with the date field and it prints day, month, year, for example 23/10/2026, beside the venue on every pocket card, on the rigging plot and on the rigging summary. It is separate from the date inside the Soundvision report. Leave it blank and nothing is printed.

Notes is a box for anything the whole crew needs to know about the show, up to 500 characters, with line breaks kept. It prints as a Notes paragraph under the heading of the rigging summary, and only there. Each array also has its own note on its card. Leave the box blank and the page is unchanged.

Ground offset is how far below the report's heights your floor is. A report height of 9.4 m with an offset of 0.3 m shows as 9.1 m. Set one offset for every array in the row under the rigging plot preview, or type a different one on a single card. If you leave it blank the heights are the report's own.

## The rigging plot

The rigging plot is under development and may include errors. Check it against the Soundvision report.

Below the cards, and on the page before the rigging summary, the app draws a plan view of the arrays that are on the plot. Stage is at the bottom of the page and the audience at the top. House left is on the right of the page, as Soundvision shows it, and +X and +Y are marked from the origin. The origin is drawn with a dash-dot line and labelled with the note you typed in Origin (P0), in the row under the plot preview. The grid is every 10 m. The plot names the sides of the plan (House left, House right, Stage and Audience). For a show in the round, untick Show side labels on the rigging plot in Settings and those four names are left off.

Each array is a dashed box. Its width and depth are the report's spatial dimensions. The Position is the middle of the front edge, the box runs back from there, and it turns by the azimuth. A small red dot (black in print) marks the Position, and it gets smaller as the scale gets smaller so it stays small against small boxes. An array with no pickup gets a solid box and no number. It is drawn where the report puts it in space, and the report does not say what holds it up. It may hang from something the report does not describe, or stand on a tripod, a yoke bracket or another item. Any array the report does not mark as stacked is drawn this way, whatever the report says about its mounting. The plot leaves an array off only when the report gives no Position, spatial dimensions or azimuth for it, and it then names that array under the plot. Each pickup has a circle with a cross, centred on its X and Y, and a label with its number (PA1, PA2 and so on) and its motor load. The plot shows no heights, so the ground offset does not change it. A plain line joins the front and rear pickups of an array. Each array is labelled with its name, then Total with the total weight the report states, then Spacing with the distance between its two pickups, for example Total 1332.6 kg and Spacing 1.01 m. The Total line is left out when the report states no total, and the Spacing line when the array has fewer than two pickups. The spacing is calculated from the X and Y positions in the report, as a distance on the plan, and ignores height. It is also in the table, on the front row of each array that has both pickups. The site angle and the heights are not on the plot, because they are on each card and in the rigging summary.

An array standing on the ground is drawn as a solid box with its corners joined by two thin lines, so it cannot be mistaken for an array with no pickup. Its Position is the same small dot as any other array, and the key has a single Position entry. It has no pickup, no number and no row in the table. Stacks often stand under other arrays, so the labels of a crowded row are placed to keep clear of each other, with a thin line to the box when one has to sit further away. On a busy plan a few labels may still touch a line, so check it against the report.

The rigging summary table has two more columns, To front and To rear, which say how far each pickup sits from the front and rear edge of its array's box. They are calculated from the report's Position, Spatial dimensions and Azimuth, measured along the array in metres. The Pickup column says Front or Rear for an array with two pickups and Single for an array with one. A front pickup shows its distance to the front edge, a rear pickup its distance to the rear edge, and an array with a single pickup shows both. A figure above zero means the pickup is inside the box. A figure below zero means it sits outside, in front of the front edge or behind the rear edge, which happens. A dash means the report does not give enough to work it out.

Pickups are numbered in rows from the audience end to the stage end, and from house left to house right inside a row. An array joins a row when its Position Y is within 1 m of the first array in that row. The front pickup of an array has the lower number.

The page also lists every point with its X and Y, and has a key, the scale and the small print. The scale is the largest standard ratio, from 1:50 to 1:2500, at which every array and the origin fit. If an array falls off the page at that scale, the page names it. A bar 100 mm long lets you check the scale with a ruler. For the right scale, print the file from Download PDF at 100 percent. Above 24 points the table continues on further pages. The credit line sits under the page footer.

### Pickup symbols

Each pickup is drawn as one of four symbols: a square with a cross, a circle with a cross, a triangle with a cross and a diamond with a cross. The circle is the default. Choose another on the card, under Plot symbol. An array with a front and a rear pickup has one choice for each. All the symbols are the same size.

Each shape has a value written for it, to start with 2 t for the square, 1 t for the circle, 0.5 t for the triangle and 0.25 t for the diamond. In Settings, under Rigging plot and Symbols, you can change any of them, for example to 1.5 t, up to 12 characters. A blank field goes back to the usual value, and Reset the symbols to the usual values puts all four back. The value is the same for every pickup that uses the shape. It shows in the Symbol column of the table, in the key under the table and in the list of shapes on each card, and it is kept in the saved file. It is a label and nothing more: the plot does not check it against the weight of the array.

Every shape can be picked for any array, whatever its weight. A mirror image that shares a card with its partner has the same symbols as that card. On an approved or superseded file you can still pick symbols for this session, but they are not saved. Update from PDF keeps a symbol when the array of the same name still has the same pickup, and tells you about any it cannot keep, which go back to 1 t.

The plot is drawn only from the report. It does not show shackles, slings, trusses, motors or any other rigging, and the pickup symbol is a nominal guide. It is a design aid, not a CAD drawing.

### Venue under the plot

Under the rigging plot preview, in the row with Origin (P0) and Download DXF, is the Venue button. It opens the Venue under the plot box. The box takes the text file that SU4SV writes, the SketchUp to Soundvision converter, and draws the venue as a pale grey line drawing under the plot, to give the arrays some context. Choose Import venue and pick the file. It must be in metres. The app says how many lines and layers it kept, and how many lines it could not read. Choose Replace venue to use another file, or Remove venue to take it away again. A file holds one venue.

Only the plan is kept. Every face in the model becomes lines, lines that are drawn twice are kept once, and the height is dropped, except that it picks the shade: the lowest parts are the darkest grey and the highest the lightest. All the lines are the same thin weight. The seats and everything else in the file are kept, so keep the SketchUp model basic. A model with more than 60,000 lines after duplicates are removed, more than 300 layers, or a file over 8 MB is refused with a message. Simplify the model in SketchUp, for example by deleting detail the plot does not need, and export it again.

The venue never changes the plot. The scale and the page come from the arrays and the origin only, so a venue much bigger than the arrays is cut at the edge of the plot, and a small one does not make the plot any bigger. The coordinates in the file are used as they are, because SU4SV writes them in the same axes as Soundvision, with the origin of the Soundvision report at 0,0.

The layers of the file are SketchUp layers, and each has a tick under Layers to show, in the same box. The button reads Venue until a venue is imported, and then says how many layers are on, for example Venue: 2 of 3 layers on. The box opens in an approved or superseded file too, so you can look at it, but its buttons and ticks are switched off. Every layer is on when a venue is imported, because the names are not the same in every model. Untick the ones you do not want, such as roof trusses that cover the arrays. Which layers are on is kept with the file. The converted lines are kept in the saved file too, not the original text, and Update from PDF keeps them. An approved or superseded file cannot have a venue imported, changed or removed.

Beside Download DXF, once a venue is imported, is an Include venue in the DXF tick, off to start with. The tick is not saved with the file. When it is on, the DXF carries the layers that are shown, every line of them and not only the part inside the plot page, at full size in millimetres like the rest of the file. Each SketchUp layer is a DXF layer of its own, named VENUE_ and the SketchUp layer name, so you can switch them off in your CAD program. The greys follow the height, and the height itself is not kept.

### Download DXF

Under the plot on screen is a Download DXF button. It saves the same plot as a DXF file that CAD programs open. The units are millimetres at full size (1:1), and the app says so beside the button and inside the file. The origin of the Soundvision report is 0,0, +X is towards house left and +Y is towards the audience, so every coordinate is the report's figure in metres times 1000. A 1.2 m wide array is 1200 units wide. When you bring the file into your CAD program, choose millimetres if it asks.

The file has the same arrays, pickups, labels and axes as the plot, drawn on separate layers: ARRAYS for arrays with pickups, ARRAYS_NO_PICKUP, STACKS and STACK_DIAGONALS, POSITIONS, PICKUPS, PICKUP_LINKS, LABELS and LEADERS, ORIGIN, AXIS_X and AXIS_Y, SIDES and NOTES. Pickup symbols are 250 mm across. Labels are plain text with no formatting, placed where the plot page puts them and sized so they read at the scale of the plot page, so at a different scale in your CAD program you may want to resize them. The notes under the drawing give the unit, the origin, the value written for each symbol and the small print of the plot page, all as text.

The DXF has no scale bar, because it is already full size. It is a design aid and not a definitive CAD drawing. Check every figure against the Soundvision report.

## Check the cards

Each card shows what the report states: weights, motor loads, heights, site angles, azimuth, frame, pickups, Soundvision's warnings, the fixation positions of a stacked array when the report lists them (X, Y and Z as the report prints them, with no ground offset taken off), and a row for each enclosure with its Panflex label (for example 90 On). A ground stack that Soundvision lays out in columns or in rows keeps its own labels in the first column, such as `C1 #1` or `R2 #1`, under the heading Col # or Row #.

Arrays that are exact mirror images of each other show once, whether the mirror runs left to right or front to back. The card has a small line under its title that reads `Also mirrored with: <name>`, with the name of the other array. The wording is the same for both kinds. Choose Show them, in the line above the cards or in Settings, to see both. Only the Soundvision report decides which arrays are mirror images. What you typed on an array, such as its title, note, ground offset, cable patch or carts, never splits a pair. The card that stands for a pair shows and prints its own title, note, offset, patch and carts, and what you typed on the other array is kept in the file but not printed. Choose Show them to see, edit and print the other array on its own card. If the shown card has no ground offset of its own, it uses the one typed on its partner. An azimuth of 180 and an azimuth of -180 are the same heading, so two arrays that both face 180 can be a pair. Soundvision names the copies it makes with YZ Sym of or XZ Sym of in front of a group name, and that prefix is ignored when two arrays are compared. Everything else must match exactly, so two arrays that differ only in the text of their Configuration, such as a left and a right high frequency setting, are not paired. A front to back pair is only found when the arrays have no fixations and the same Panflex figures, because those have not been checked for such a pair.

## Carts

An array is built from carts, usually three or four enclosures to a cart and sometimes six for a small format box. On a hand drawn card you might draw a line between the carts, or shade the rows of every other one. Each card here has a Carts line that says how the enclosures are grouped, for example Carts: 4 + 4 + 3 + 3, and whether the carts were cut by the app (automatic) or by you (set by hand).

The app cuts the carts from a size for each type of enclosure. The sizes are in Settings, under Cards: K2 starts at four to a cart, and KARA II and KARA at three. A type with no size is not cut, so its enclosures stay one block until you cut them. A new cart always starts where the type changes, so eight K2 above six KARA II come out as 4 + 4 + 3 + 3. A flown array is counted from the top, so a short cart is the last one. A stack is counted from the bottom, so a short cart is the first one at the top. Where a stack is laid out in columns, a cart never runs from one column into the next.

The sizes come from Settings. To change one array by hand, choose the small break button in the first column between two rows to start a new cart there, and choose it again to take the break out. Where the type changes there is a fixed line instead of a button, because a new cart always starts there. Once you have cut an array by hand it stays as you cut it, even if you change the sizes, and a Back to automatic button appears on its card. Choose it to put the array back to the sizes in Settings.

On the printed card, the PDF and the image, every other cart is shaded a light grey, counted from the top, and the first cart is left white. The Feeder and Way cells are never shaded, so the chips and the empty boxes stay clean. The grey prints the same in black and white. Shading changes nothing about the size of a card. On screen the same carts are banded and marked with a solid line where each begins.

The carts are saved with the file. An approved or superseded file shows them but cannot change them. Deleting an array and restoring it keeps its carts. Update from PDF keeps the carts you cut by hand when the array of the same name has the same enclosures in the same order. If the enclosures differ, that array goes back to automatic and the comparison lists it. The sizes in Settings are not touched.

## Settings

The Settings button in the toolbar opens a box with the choices that belong to the whole job and not to one card. Escape or Close shuts it. Under Cards are the sizes of the carts, one field for each type of enclosure in the report, and a button to bring back the usual sizes. Leave a field blank to keep that type as one block. Under Rigging plot are the tick for the side labels and the four Symbols with the value written for each. Under Display is the tick that shows the exact mirror images too. The Origin (P0) note, the ground offset every array uses and the venue are not in Settings: they are in the row under the rigging plot preview, with Print rigging plot and Download DXF. An approved or superseded file shows all of it but cannot change it.

## Cable patch

Every card has two dropdowns on each enclosure row, Feeder and Way, as the last two columns of the table. Each offers 1 to 9, then 0, or a blank. They are notes for the crew. The app does not count feeders or ways, does not check them and does not work out a length or a load. There is no copy down and no range fill: pick the value for each row.

The digit shows on a colour chip that follows the resistor code: 1 brown, 2 red, 3 orange, 4 yellow, 5 green, 6 blue, 7 violet, 8 grey, 9 white (with a thin dark outline) and 0 black. The printed pocket card, the PDF and the image show the same chips, in colour, with the digit on each so it still reads on a black and white print. The Feeder and Way columns always print. When nothing is chosen they print as empty boxes with a thin black outline, so you can fill them in with a pencil. The card table no longer has a Site column; the array's own top and bottom site are still in the facts above it.

For a 12 box array you might give boxes 1 to 3 feeder 1 way 1, boxes 4 to 6 feeder 1 way 2, boxes 7 to 9 feeder 2 way 1 and boxes 10 to 12 feeder 2 way 2. Or give all twelve feeder 1 with ways 1 to 4 in threes. Both are only what you type.

The cable patch is saved with the file. An approved or superseded file cannot change it, and its dropdowns are switched off until you create a new revision. Deleting an array and restoring it keeps its patch. Update from PDF keeps an array's patch row for row while the array of the same name has the same number of enclosures. When the number differs, that array's patch is cleared and the list of differences says so. The patch does not appear on the rigging summary, the rigging plot or the DXF.

## Choose what to print

Each card has a Print this array checkbox. Unticked arrays are left out of the printout, the images and the pickups and fixation positions on the rigging page. The choice is saved with the file.

Each card also has an Include on rigging plot checkbox. It is ticked to begin with. An array that is not ticked is not drawn on the plot, is not numbered, is not in its table, and is not in the DXF, and the pickup numbers close up over the gap. The plot has its own choice: unticking Print this array does not take the array off the plot, and unticking Include on rigging plot does not take its card off the printout. On a card that stands for a mirrored pair, the tick decides for both arrays. Tick Show the mirrored arrays too in Settings to give each its own. If no array is ticked, the plot has nothing to draw and the preview says so.

Beside the plot preview is Print rigging plot, also ticked to begin with. Untick it and the plot page is left out of the printout and the Download PDF, and the page numbers run on without a gap. The preview and Download DXF stay. It switches itself off, and cannot be ticked, while no array is on the plot. Both choices are saved with the file. On an approved or superseded file they can still be changed for this session, as Print this array can, and they are not saved.

## Print, download or save images

- Print / PDF opens your print window. Choose a printer, or Save as PDF.
- Download PDF makes the PDF in one click, with no print window.
- Save image on a card saves that array as a PNG. Save selected as images saves one for every ticked array.

The PDF has four arrays on each A4 page. Fold the page in half twice and each array is on its own A6 panel, with dashed lines marking the folds. A panel holds an array of up to 20 rows, with its mirror note. A long warning, a long frame name or a long title can take a row or two of that room. The fixation positions of a stacked array take about five rows and a gap, so a tall stack may move to a long column. An array that is taller goes in a long column that runs the full height of the page. Two long columns share a page, which you fold once, and a dashed line down the middle shows where, as on the pages of four. The line is there even when a page holds only one column. Long pages come first. Every panel and column carries a header and a footer, so it still says what it is when folded. The header has the show and venue (or the Soundvision project if none is typed) and the status and revision, then the show date, project, engineer, company and Z-axis zero that are filled in. The footer has a credit line under it. An array with a single pickup shows its frame and the position number in one Frame/Bar Hole row, such as the frame name, a slash and the hole number. The card has no position row and no bottom site row, and the ground offset row is there only when an offset is in use. The rigging plot comes next, drawn across the page, so turn the sheet to read it. The last page is the rigging summary and the small print, with a QR code at its foot that opens this app. It has a table of every pickup and, below it, a table of every fixation position (array, fixation, X, Y and Z as the report prints them). Mirrored arrays are listed too, because their positions differ. A report with eight stacks has 32 fixation positions, so its rigging page is printed about 2.5 per cent smaller to fit on one sheet. The fixation rows are set in the same compact type as the pocket cards to keep that reduction small. The rigging summary on screen lists every array and never cuts a name. The printed page and the PDF list only the arrays chosen for printing, plus the mirrors that their cards stand for. A name too long for its column in print or the PDF loses its middle to an ellipsis, so the end of the name stays readable.

A draft has DRAFT on every panel. Set the status to Issued or Approved when the sheet is final.

## Save your work

Save writes a file such as `Main stage - Rev B.arraysheet.json`. It holds what the PDF said and what you typed, so you can reopen it later without the PDF.

Files saved by an older version of the app open fine and are upgraded. A file saved by a newer version is refused, because an older copy would drop what it does not know about. Reload the app to get the new version, then open the file again.

In Chrome and Edge on a computer, Save writes back to the same file, Save As picks a new one, and Recent lists your last files. In other browsers Save downloads a new file each time.

While you have unsaved changes the app also keeps a copy in the browser and offers it back after a crash. That copy is a safety net. Save to a file to keep your work.

## Status and revisions

Draft, Issued, Approved and Superseded are the four statuses. Approved and superseded files open read-only. You can still choose what to print, but nothing is saved.

To change an approved file, press Create new revision. It starts a draft with the next letter (blank, then A, B, C) and never writes over the old file. Setting the old one to Superseded is up to you.

## Card title and notes for the crew

Each card has a Card title box, one line of up to 60 characters. Type a name there and it replaces the array name on the card, the printed sheet, the PDF, the images, the rigging plot, the DXF and the rigging summary. Clear the box to go back to the name in the report. The card then carries a small line, Soundvision name, with the name from the report, so the two can always be matched. The title is kept with the file, and Update from PDF still finds the array by its report name, so the title survives an update.

Each card also has a Notes for the crew box for instructions, up to 300 characters, with the line breaks you type. The note prints on the card under the mirror line, after the word Note. It is not shown on the rigging plot, the DXF or the rigging summary. An approved or superseded file cannot be changed, so both boxes are switched off there.

## Deleting an array

Each card has a Delete array button. A deleted array leaves the cards, the printed sheet, the PDF, the rigging plot, the DXF and the rigging summary, and the checks that concern only that array are hidden. Mirrored arrays stay together until one is deleted, and then the other has a card of its own.

Undo delete, beside Save selected as images, brings back the last array you deleted, and it can be pressed again for the one before. The undo list lasts for the session only. A list under the cards shows what is deleted, each with a Restore button, and that list is saved with the file, so you can restore an array after reopening it.

A deleted array stays in the file, marked as deleted. The file holds the report as read either way, so deleting and restoring does not make it any bigger. An approved or superseded file cannot be changed, so nothing can be deleted or restored in it.

## A newer PDF arrives

With your file open, press Update from PDF and choose the newer report. The app lists exactly what differs. Choose Update from new PDF or Keep as saved. Your show details, offsets, print choices, titles, notes, plot symbols, cable patches and venue stay with the arrays of the same name. A cable patch stays while the array has the same number of enclosures, and is cleared and listed when it does not. A symbol stays when the array still has the same pickup and goes back to 1 t when it does not, and the list says so. An array you deleted comes back if the new PDF has it, and the list marks it as restored.

## Install it and use it offline

In Chrome or Edge, use the install icon in the address bar. On Android, use Add to home screen. On iPhone, use Share, then Add to Home Screen. Open the app once with a signal, and after that it works with none, including opening a PDF.

When there is a new version the app shows Update available. Press Reload when it suits you. It never updates in the middle of an edit.

## Things worth knowing

- Everything shown comes from the PDF. The app does not calculate loads or check that a rig is safe.
- Read the [disclaimer](../DISCLAIMER.md). It is printed on the last page of every printout.
- Soundvision report version 2026.3.1 has been tested. If a newer version changes the layout, lines the app does not understand appear as CHECK items.
