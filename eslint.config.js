// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

// PRD §4.1: never derive a calendar day from a UTC ISO string.
const noUtcDaySlice = {
  selector:
    "CallExpression[callee.property.name=/^(slice|split|substring)$/][callee.object.callee.property.name='toISOString']",
  message: 'Use src/lib/dates.ts (IST logical day), never toISOString().slice/split (PRD §4.1).',
};

// CLAUDE.md: UI uses src/ui/theme.ts tokens only; no hard-coded colours.
const noHexColour = {
  selector: 'Literal[value=/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]',
  message: 'No hard-coded colours. Use tokens from src/ui/theme.ts.',
};
const noRgbColour = {
  selector: 'Literal[value=/^rgba?\\(/]',
  message: 'No hard-coded colours. Use tokens from src/ui/theme.ts.',
};

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: [
      'node_modules/**',
      'reference/**',
      'design/**',
      '.expo/**',
      'dist/**',
      'coverage/**',
      'expo-env.d.ts',
      // Deno Edge Functions; their shared cores are copies of src/ files (tested there).
      'supabase/functions/**',
      // Scriptable (iOS) widget scripts: their own runtime globals.
      'widgets/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-restricted-syntax': ['error', noUtcDaySlice, noHexColour, noRgbColour],
    },
  },
  {
    // The token file is the one place colours are defined.
    files: ['src/ui/theme.ts'],
    rules: {
      'no-restricted-syntax': ['error', noUtcDaySlice],
    },
  },
  {
    files: ['**/__tests__/**', '**/*.test.{ts,tsx}', 'jest.setup.ts'],
    rules: {
      'no-restricted-syntax': ['error', noUtcDaySlice],
    },
  },
]);
