// Files are untrusted input: refuse anything much bigger than a real report or saved file.

export const MAX_PDF_BYTES = 30 * 1024 * 1024;
export const MAX_PDF_PAGES = 400;

/** A saved file is the report as text plus a few settings, so a few MB is already very large. */
export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_SOURCES = 500;
export const MAX_CABINETS_PER_SOURCE = 200;
export const MAX_WARNINGS_PER_SOURCE = 50;
export const MAX_PICKUPS_PER_SOURCE = 8;
export const MAX_PROBLEMS = 2000;
export const MAX_TEXT_LENGTH = 2000;
