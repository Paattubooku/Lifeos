import { strFromU8, unzipSync } from 'fflate';

import { buildExport, csvZip, EXPORT_TABLES, sizeText, toCsv } from '../lib/exportData';

describe('export (F23 AC: valid JSON containing every table)', () => {
  it('covers every table in the database types', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest-only file read
    const { readFileSync } = require('fs') as { readFileSync: (p: string, e: 'utf8') => string };
    const types = readFileSync('src/types/supabase.ts', 'utf8');
    const tablesBlock = types.slice(types.indexOf('Tables: {'), types.indexOf('Views: {'));
    const names = [...tablesBlock.matchAll(/^ {6}(\w+): \{$/gm)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(25);
    expect([...EXPORT_TABLES].sort()).toEqual([...names].sort());
  });

  it('valid JSON with every table, counts, token hashes left out', () => {
    const doc = buildExport(
      {
        water_log: [{ date: '2026-11-24', amount_ml: 500 }],
        api_token: [{ name: 'iPhone', last4: 'ab12', token_hash: 'secret' }],
      },
      '2026-11-24T10:00:00.000Z',
      'me@x',
    );
    const parsed = JSON.parse(JSON.stringify(doc)) as typeof doc;
    expect(Object.keys(parsed.tables).sort()).toEqual([...EXPORT_TABLES].sort());
    expect(parsed.counts.water_log).toBe(1);
    expect(parsed.counts.task).toBe(0);
    expect(parsed.tables.api_token[0]).toEqual({ name: 'iPhone', last4: 'ab12' });
    expect(JSON.stringify(parsed)).not.toContain('secret');
  });

  it('CSV escaping and a zip with one CSV per table', () => {
    expect(
      toCsv([
        { a: 1, b: 'x,y' },
        { a: null, b: 'say "hi"\nok', c: { k: 1 } },
      ]),
    ).toBe('a,b,c\r\n1,"x,y",\r\n,"say ""hi""\nok","{""k"":1}"');
    expect(toCsv([])).toBe('');
    const doc = buildExport({ task: [{ title: 'Pay bill' }] }, '2026-11-24T10:00:00.000Z', null);
    const files = unzipSync(csvZip(doc, '2026-11-24'));
    expect(Object.keys(files)).toHaveLength(EXPORT_TABLES.length + 1);
    expect(strFromU8(files['lifeos-2026-11-24/task.csv']!)).toBe('title\r\nPay bill');
    expect(sizeText(500)).toBe('500 B');
    expect(sizeText(2048)).toBe('~2 KB');
    expect(sizeText(1.25 * 1024 * 1024)).toBe('~1.3 MB');
  });
});
