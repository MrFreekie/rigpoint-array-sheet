// The identity at the top of every pocket panel. Folded to A6, a panel is all you hold, so it must say
// whose it is: the app, the show, the Soundvision project, who made it and which revision it is.

import { STATUS_LABELS, type Doc } from '../files/doc';

export interface PanelHeader {
  /** e.g. "Draft Rev B". */
  status: string;
  /** The show and venue, or the Soundvision project when neither was typed. */
  title: string;
  /** Project (if it is not already the title), engineer, company and Z-axis zero, with the empty ones left out. */
  details: string;
}

export function projectName(doc: Doc): string {
  return (doc.result.report.document.fileName ?? '').replace(/\.xmlp$/i, '').trim();
}

export function panelHeader(doc: Doc): PanelHeader {
  const project = projectName(doc);
  const title = [doc.job.show.trim(), doc.job.venue.trim()].filter(Boolean).join(' · ') || project || doc.sourceName;
  const zero = doc.job.zAxisZero.trim();
  return {
    status: `${STATUS_LABELS[doc.status]}${doc.revision ? ` Rev ${doc.revision}` : ''}`,
    title,
    details: [project !== title ? project : '', doc.job.engineer.trim(), doc.job.company.trim(), zero ? `Z-axis zero: ${zero}` : '']
      .filter(Boolean)
      .join(' · '),
  };
}
