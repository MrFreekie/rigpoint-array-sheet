# RigPoint Array

Turn a Soundvision report PDF into a short, readable page of the array and rigging information, and print it.

RigPoint Array is the second app in the RigPoint family, after [RigPoint Load Sheet](https://github.com/MrFreekie/rigpoint-load-sheet). It follows the same rules: everything runs in the browser, nothing is sent anywhere, and the app is honest about what it has and has not checked.

## Where it is

This is phase 2 of 5. You can open a Soundvision PDF and see a fly sheet card for every array plus a rigging summary. You can type the show details and a ground offset. Saving, printing, offline use and installing come in later phases, so nothing you type is kept yet.

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

Read the [disclaimer](DISCLAIMER.md) before relying on any sheet.

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

Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0). See [LICENCE](LICENCE).
