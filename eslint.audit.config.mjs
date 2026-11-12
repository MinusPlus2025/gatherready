/* Static accessibility audit only (open source): eslint-plugin-jsx-a11y.
   Not part of the normal build; run with `npm run audit:lint`. */
import tseslint from 'typescript-eslint';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'docs/**'] },
  {
    files: ['src/web/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' },
    },
    plugins: { 'jsx-a11y': jsxA11y },
    rules: {
      ...jsxA11y.configs.recommended.rules,
      // This app deliberately uses focusable non-interactive status containers.
      'jsx-a11y/no-noninteractive-tabindex': 'off',
    },
  },
];
