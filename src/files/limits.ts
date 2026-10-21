// A PDF is untrusted input: refuse anything much bigger than a real Soundvision report.

export const MAX_PDF_BYTES = 30 * 1024 * 1024;
export const MAX_PDF_PAGES = 400;
