# Receipt printer plan

This is a plan, not a feature. Nothing here is built yet.

The idea is to print one array on a small thermal printer, as a narrow strip you can tape inside a case lid or keep on a clipboard. It sits next to the A4 pocket sheet and the PNG images and does not replace them.

## The printer to start with

The owner has an Able Systems printer, probably the AP1300BT, a Windows computer as the main machine, no phone, and wants Bluetooth with a low cost. Buying nothing is the lowest cost, so the plan starts from this printer.

What the published datasheet and distributor listings say about the AP1300BT:

- It is a portable thermal printer with a 48 mm print width and 384 dots per line (8 dots per mm). That is exactly the width this plan already assumes.
- It takes 57 mm paper rolls and runs on a rechargeable battery.
- Its Bluetooth is version 2.1, which is Bluetooth Classic with the serial port profile. It is not Bluetooth Low Energy, so Web Bluetooth cannot reach it. Web Serial can: Chrome 117 and later on desktop can talk to paired Bluetooth Classic serial devices.
- It also has a serial port on an RJ12 socket.
- Able offers free Windows and Linux drivers and an SDK.
- Its command language is not stated anywhere I could find. It may or may not understand ESC/POS. Able's programmer's guide settles it, and Able lists a contact address on the datasheet.
- A distributor lists the model as discontinued, so a replacement may be needed one day. Any 58 mm ESC/POS printer with Bluetooth Classic would do the same job.

Sources: the [Able AP1300 datasheet on Farnell](https://www.farnell.com/datasheets/3925195.pdf), the [RS listing](https://uk.rs-online.com/web/p/portable-printers/4804193), and Chrome's note on [serial over Bluetooth](https://developer.chrome.com/blog/serial-over-bluetooth).

## Short answer

- Printer: a 58 mm thermal receipt printer with a built-in rechargeable battery, USB-C and Bluetooth.
- Language: ESC/POS, not ZPL. ZPL is the Zebra label language. Receipt printers of this kind speak ESC/POS.
- Data: send a picture of the card, not text. The app already draws each array as an image, so the printer gets a 1-bit bitmap of that, 384 dots wide.
- Connection: start with the computer's normal print dialog, which needs no new browser features. Then add direct sending over Web Serial (USB, and Bluetooth printers that show up as a serial port) and Web Bluetooth (printers with Bluetooth Low Energy).

## Why ESC/POS and not ZPL

ZPL belongs to Zebra label printers. Some Zebra mobile printers speak ZPL or CPCL, but they cost several times more than a generic 58 mm printer, and Zebra's own forums show that the language depends on the model: the ZQ110 is reported to use ESC/POS and the iMZ220 to use CPCL and ZPL. A cheap battery receipt printer almost always understands ESC/POS, the command set that Epson made the standard.

If you already own a Zebra mobile printer, say so. Sending ZPL or CPCL is a small second output next to ESC/POS, and the picture stays the same.

## How the browser can reach a printer

| Route | Works on | Good | Bad |
|---|---|---|---|
| The print dialog and an installed driver | Windows, macOS, anything with a driver | Any printer with a driver. No new code beyond a narrow layout | Needs the driver installed. Print quality depends on the driver |
| Web Serial | Chrome and Edge on Windows, macOS, Linux | USB printers that act as a serial port. Paired Bluetooth printers often appear as a serial port too | Not in Safari or Firefox. Not on phones. I have not tested Bluetooth serial ports with Web Serial |
| Web Bluetooth | Chrome and Edge on Windows, macOS, Android | No driver. Works on Android | Bluetooth Low Energy only. Many cheap printers use classic Bluetooth, which Web Bluetooth cannot reach. Slow, so the data goes in small chunks |
| WebUSB | Chrome and Edge | Direct USB | On Windows it needs the printer's driver swapped for a generic one, which is awkward. Avoid |

Safari and iPhone support none of Web Serial, Web Bluetooth or WebUSB. On those, the options are the print dialog or saving the PNG and sending it with the printer's own app.

## Choosing a printer

I have not verified any specific model. Listings for cheap printers vary a lot and often overstate what they support. These are the checks that matter before buying:

1. It says ESC/POS, and it can print raster images (the `GS v 0` command). Almost all do.
2. Paper is 58 mm, with about 48 mm printable. That is 384 dots across at 203 dpi.
3. USB-C that carries data, not only power.
4. Bluetooth. For Web Bluetooth it must be Bluetooth Low Energy. Ask the seller or read the datasheet. A "dual mode" or "BLE" printer is the safe choice.
5. A built-in battery of 1500 mAh or more, which prints a few hundred short strips per charge.
6. A driver for Windows and macOS if you want the print dialog route.

Buy two inexpensive candidates and test both before committing to one. The class costs roughly the price of a nice lunch to a few dozen pounds, but check current prices yourself.

## What gets sent

1. Draw the card at 384 pixels wide, with the type size raised to about 20 pixels so it reads on paper. The existing image layout already takes a width, so this is a variation of it, not a new design.
2. Turn the picture into 1-bit black and white, with dithering so the grey watermark and thin lines survive.
3. Send ESC/POS: initialise (`ESC @`), the raster image in bands of a few hundred rows (`GS v 0`), a few blank lines, then a cut if the printer has a cutter.

A picture avoids code page trouble with the degree sign and keeps the same look as the PNG export. Plain text mode could print faster and sharper, but a 32 column line cannot hold the enclosure table cleanly.

The strip has the same content as a pocket card: the header with show, venue and revision, the array name, the facts, any Soundvision warnings, the enclosure table, and a short footer. A DRAFT mark is repeated down the strip for drafts.

## Steps

1. A 58 mm layout and a Print strip button that uses the print dialog (`@page { size: 58mm auto }`). With the Able Windows driver installed, this works with the AP1300BT and needs no knowledge of its command language. It is the first thing to build and the first thing to try.
2. Find out what the printer understands. Get Able's programmer's guide, or try an ESC/POS test: initialise, one raster image, feed. If it understands ESC/POS, build the bitmap builder with unit tests that check the exact bytes. If it speaks Able's own language, build a small writer for that instead. The picture stays the same either way.
3. Direct sending over Web Serial to the paired Bluetooth printer, with the port remembered between visits. This is the main route for the AP1300BT on Windows with Chrome or Edge.
4. Fall back to the PNG where none of this exists.
5. Web Bluetooth only if a Bluetooth Low Energy printer is bought later.

## Testing

The ESC/POS builder is pure, so unit tests can check exact bytes: the initialise command, the raster header, band sizes and the cut. A mock port checks the sending code. There is no printer in CI, so the connection steps need a hand test on real hardware, with a short checklist: pair, print a draft, print a tall array, print with the battery low, unplug mid-print and check the app says so.

## Decided

- Windows is the main computer, with no phone involved.
- Bluetooth is the preferred connection.
- Low cost, so the printer already owned is used.

## What is still open

- The exact model. It is usually on the sticker under the printer. The AP1300BT is a guess.
- Whether the Able driver is installed in Windows, and whether the printer is paired. A paired printer shows under Bluetooth settings. Device Manager may also show a Standard Serial over Bluetooth link with a COM number.
- Able's programmer's guide, or a test of ESC/POS on the printer, to learn its command language.
