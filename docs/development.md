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
| `npm run typecheck` | TypeScript in strict mode |
| `npm run lint` | ESLint, including the rule that keeps the engine pure |
| `npm test` | All tests |
| `npm run ci` | Typecheck, lint and tests, as CI runs them |
| `npm run extract:fixtures` | Rebuilds the anonymised fixtures from the PDFs in `reference/` |

## Layout

| Path | Contents |
|---|---|
| `src/engine/` | Pure parser: lines of positioned text in, a report and a list of problems out |
| `src/schema/` | Zod schema for the report, with plain-English errors that name the field |
| `src/files/` | Reading a PDF with pdf.js, size and page limits, and the single import function |
| `src/testing/` | A seeded random generator, a report renderer and a tiny PDF builder for tests |
| `fixtures/` | Anonymised text extracted from the two sample reports |
| `reference/` | The sample PDFs (kept out of git, see below) |

The engine may not touch the DOM, storage, pdf.js or other layers. ESLint enforces this.

## How reading works

pdf.js gives each piece of text with its page and position. The engine groups pieces into lines by height, then walks the lines in order. Group headings, source headings and the physical configuration section are read. The acoustic configuration section is skipped.

The enclosure table is read by column position, not by order, because some cells are blank (a sub has no angle) and values are right aligned under their headings. A page break repeats the table heading and the parser carries on.

Group nesting is not printed, only a number. A group numbered 1 starts a deeper level, and a group numbered n replaces the group numbered n minus 1 at the same level. This reproduces the nesting in both samples. If the numbering ever fails to follow that rule, the parser reports a problem and the group names may be wrong.

## Checks on what was read

Two levels of problem come back with the report.

An error means the figures cannot be relied on: no text, not a Soundvision report, or units other than kilograms and metres.

A check means something looks wrong and should be compared with the PDF: a line the parser did not understand, an unreadable cell, a motor count that does not match the pickups, or enclosures out of order. For flown arrays it also compares figures the PDF prints against each other. Each site angle should equal the one above minus its angle, and each top height should match the bottom of the row above. Stacked arrays in the samples break those two rules legitimately, so only their numbering and top and bottom site are checked.

## Tests

Expected values in `src/engine/parse.test.ts` were read by hand from the sample PDFs. Do not edit an expected value to make a test pass. Raise it instead.

The property tests draw 300 random reports in the Soundvision layout, with page breaks in random places, and require that they read back exactly with no problems. Other tests cover empty and non-report PDFs, pounds and feet, unreadable cells, unknown lines, shuffled input and garbage.

The two sample PDFs carry real venue and author names, so they are listed in `.gitignore`. The committed fixtures replace those names. When the PDFs are present in `reference/`, extra tests check that pdf.js still produces exactly the committed fixtures. Without them those tests skip, which is what happens in CI.

## Panflex label

A fly sheet shows a label next to each enclosure: 70, 110, or 90 with On or Off. `panflexLabel` in `src/engine/panflex.ts` produces it. It is the one value the engine derives, so the rule is written out there and tested against the owner's sample output.

The two Panflex figures are added together. When they differ, the wider side is On if it points towards the stage centre and Off if it points away, seen from the box. In the samples the first figure points towards negative X and the second towards positive X, so the answer depends on which side of X = 0 the array sits. Left-hand arrays match the sample output. Right-hand arrays follow by mirroring and are not yet checked against a reference.

## Fields for phase 2

The editing interface needs these inputs, which the PDF does not hold: show name, system engineer, company, Z-axis zero, and a ground offset per array. Heights on the sheet are the report's heights minus the ground offset. The array's Position Z is its top height and its Bottom elevation is its bottom height.

## Not done yet

- The editing interface, print view, files, offline use and deploy are later phases.
- The cabling and folding sheets from other tools are out of scope.
- pdf.js needs its worker file bundled when the interface exists. Phase 2 decides how.
- Only Soundvision is supported. Other tools would need their own reader.
