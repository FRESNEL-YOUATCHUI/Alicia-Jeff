import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  {ignores:['node_modules/**','dist/**','.vercel/**','.wedding-data/**','.qa-artifacts/**','previews-v3/**']},
  js.configs.recommended,
  {
    files:['**/*.{js,mjs,cjs}'],
    languageOptions:{ecmaVersion:'latest',sourceType:'module',globals:globals.node},
    rules:{'no-unused-vars':['error',{argsIgnorePattern:'^_',caughtErrors:'none',varsIgnorePattern:'^_'}]}
  },
  ...tseslint.configs.recommended.map(config=>({...config,files:['src/**/*.{ts,tsx}','vite.config.ts']})),
  {
    files:['src/**/*.{ts,tsx}'],
    languageOptions:{globals:globals.browser},
    plugins:{'react-hooks':reactHooks,'react-refresh':reactRefresh},
    rules:{...reactHooks.configs.recommended.rules,'react-refresh/only-export-components':['warn',{allowConstantExport:true}],
      '@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_',caughtErrors:'none',varsIgnorePattern:'^_'}]}
  },
  {files:['vite.config.ts'],languageOptions:{globals:globals.node}}
);
