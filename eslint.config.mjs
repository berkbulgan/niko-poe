// ABOUTME: ESLint flat config for the React/TypeScript frontend.
// ABOUTME: typescript-eslint recommended rules plus the classic React hooks rules.

import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['dist/**', 'src-tauri/**'] },
  ...tseslint.configs.recommended,
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
);
