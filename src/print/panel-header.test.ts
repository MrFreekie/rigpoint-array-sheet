import { describe, expect, it } from 'vitest';
import { parseFixture } from '../testing/fixtures';
import { newDoc } from '../ui/document';
import { panelHeader, projectName } from './panel-header';

const doc = () => newDoc(parseFixture('a'), 'a.pdf');

describe('panelHeader', () => {
  it('names the app, the status and the Soundvision project when no show is typed', () => {
    expect(panelHeader(doc())).toEqual({
      brand: 'RigPoint Array',
      status: 'Draft',
      title: 'Example Arena - Example Show',
      details: '',
    });
  });

  it('puts the show first and keeps the project, engineer, company and Z-axis zero beneath it', () => {
    const d = doc();
    d.job = { show: 'Main stage', engineer: 'Sam', company: 'Acme Audio', zAxisZero: 'Arena floor', defaultOffset: '' };
    d.status = 'issued';
    d.revision = 'B';
    expect(panelHeader(d)).toEqual({
      brand: 'RigPoint Array',
      status: 'Issued Rev B',
      title: 'Main stage',
      details: 'Example Arena - Example Show · Sam · Acme Audio · Z-axis zero: Arena floor',
    });
  });

  it('leaves out anything not typed, and does not repeat the project as the show', () => {
    const d = doc();
    d.job.show = 'Example Arena - Example Show';
    d.job.company = 'Acme Audio';
    expect(panelHeader(d).details).toBe('Acme Audio');
    d.job.company = '  ';
    expect(panelHeader(d).details).toBe('');
  });

  it('falls back to the name of the PDF when the report names no project', () => {
    const d = doc();
    d.result.report.document.fileName = null;
    expect(projectName(d)).toBe('');
    expect(panelHeader(d).title).toBe('a.pdf');
  });

  it('drops the Soundvision file extension', () => {
    const d = doc();
    d.result.report.document.fileName = 'Some Venue 2026 v3.xmlp';
    expect(projectName(d)).toBe('Some Venue 2026 v3');
  });
});
