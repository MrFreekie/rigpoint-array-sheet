import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseSoundvision } from '../engine/parse';
import type { ParseResult, TextItem } from '../engine/types';

const root = fileURLToPath(new URL('../../', import.meta.url));

export function loadItems(name: 'a' | 'b' | 'c' | 'd' | 'e'): TextItem[] {
  return JSON.parse(readFileSync(`${root}fixtures/soundvision-${name}.items.json`, 'utf8')) as TextItem[];
}

export function parseFixture(name: 'a' | 'b' | 'c' | 'd' | 'e'): ParseResult {
  return parseSoundvision(loadItems(name));
}
