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
