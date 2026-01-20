import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import sonarjs from 'eslint-plugin-sonarjs'; // <-- 1. הוסף ייבוא
import unicorn from 'eslint-plugin-unicorn'; // <-- 2. הוסף ייבוא

export default tseslint.config(
  { ignores: ['dist'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  sonarjs.configs.recommended, // <-- 3. הפעל את חוקי SonarJS
  unicorn.configs.recommended, // <-- 4. הפעל את חוקי Unicorn
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // תוכל לבטל חוקים ספציפיים כאן אם הם מפריעים לך
      'unicorn/prevent-abbreviations': 'off',
      'unicorn/filename-case': 'off',
    },
  }
);
//