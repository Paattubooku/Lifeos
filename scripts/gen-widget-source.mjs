// Embeds widgets/scriptable/Life.js in the app so Integrations can copy it.
// Run after editing the script: node scripts/gen-widget-source.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('widgets/scriptable/Life.js', 'utf8');
writeFileSync(
  'src/features/widgets/scriptSource.ts',
  `// Generated from widgets/scriptable/Life.js by scripts/gen-widget-source.mjs. Do not edit.\n` +
    `export const WIDGET_SCRIPT: string = ${JSON.stringify(src)};\n`,
);
