module.exports = {
  root: true,
  extends: ['eslint:recommended'],
  env: {
    es2021: true,
    node: true
  },
  parserOptions: {
    sourceType: 'module'
  },
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint'],
      extends: ['plugin:@typescript-eslint/recommended'],
      parserOptions: {
        project: ['./tsconfig.json']
      }
    }
  ]
};
