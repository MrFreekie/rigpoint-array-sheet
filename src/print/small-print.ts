// The small print on the last page of every printout. This is fixed text: it must match
// DISCLAIMER.md word for word (small-print.test.ts checks it). Change DISCLAIMER.md and this together,
// and only with the owner's approval.

export const SMALL_PRINT: { label: string | null; text: string }[] = [
  {
    label: null,
    text: 'RigPoint Array is provided as it is, without warranty. It reads a Soundvision report and shows the array and rigging information that report states. It is a reading aid. It does not replace the report, a rigging plan, or assessment by a competent person.',
  },
  {
    label: 'What it shows.',
    text: 'Every figure comes from the PDF you give it, in kilograms and metres. The app does not calculate loads, check ratings or test whether a rig is safe. Where it cannot read something, it says so.',
  },
  {
    label: 'What you must do.',
    text: "Compare any sheet you rely on with the original Soundvision report and with the equipment's current manufacturer data. Soundvision's own mechanical warnings are passed on as printed, and the app adds none of its own. A missing warning does not mean a rig is safe.",
  },
  {
    label: 'Weights and loads.',
    text: 'Weights and motor loads are the ones Soundvision states for the design. They do not include cables, bridles, hoists, steel or anything else the report leaves out.',
  },
  {
    label: 'Trademarks.',
    text: 'Soundvision and L-Acoustics are trademarks of their owners. This project is independent and is not made, approved or supported by them.',
  },
];

/**
 * The small print on the rigging plot page, in the owner's approved words. small-print.test.ts holds the literal text.
 * The page carries the ordinary small print on the last page as well. Change this only with the owner's approval.
 */
export const PLOT_SMALL_PRINT =
  'This plot is drawn only from the Soundvision report. It shows array positions, pickups and loads as the report states them. It does not include shackles, slings, bridles, spreaders, trusses, motors or any other rigging component. Marker symbols show a nominal rating and are a guide only. Use this plot as a visual guide when developing the final rigging plot, check the scale bar against a ruler, and check every figure against the Soundvision report. It is a design aid, not a definitive CAD drawing.';

/**
 * The one sentence added to the plot small print when any additional weight is typed in the app, so the page does not say
 * its loads are only the report's. It follows the approved words and is printed only when a weight is in use.
 */
export const PLOT_EXTRA_WEIGHT_SENTENCE = 'Loads include any additional weight typed in the app.';

/** The small print of the plot page: the approved words, then the added sentence when an additional weight is in use. */
export const plotSmallPrint = (additionalWeightUsed: boolean): string => (additionalWeightUsed ? `${PLOT_SMALL_PRINT} ${PLOT_EXTRA_WEIGHT_SENTENCE}` : PLOT_SMALL_PRINT);
