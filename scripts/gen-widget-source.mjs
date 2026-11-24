// Embeds widgets/scriptable/LifeOS.js in the app so Integrations can copy it.
// Run after editing the script: node scripts/gen-widget-source.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('widgets/scriptable/LifeOS.js', 'utf8');
writeFileSync(
  'src/features/widgets/scriptSource.ts',
  `// Generated from widgets/scriptable/LifeOS.js by scripts/gen-widget-source.mjs. Do not edit.\n` +
    `export const WIDGET_SCRIPT: string = ${JSON.stringify(src)};\n`,
);
