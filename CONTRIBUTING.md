# Contributing

## Reading a new kind of report line

The reader is built from two sample reports. A different Soundvision version or a different layout will show up as problems with the message "A line was not understood". When you add support for one:

1. Put the PDF in `reference/` (it stays out of git) and add its anonymised text to `fixtures/` with `npm run extract:fixtures`.
2. Read the expected values from the PDF by hand and add them to the tests.
3. Never edit an expected value to make a test pass. If the parser and the PDF disagree, raise it.
4. Check that no real name, venue or author is in anything you commit.

## Code

- UK English everywhere.
- Kilograms and metres only.
- `src/engine/` stays pure: no DOM, storage, framework or pdf.js code.
- Every new dependency needs a reason in the pull request.

Run everything CI runs with:

```bash
npm run ci
```
