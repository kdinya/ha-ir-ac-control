// Minimal ESLint setup for this repo.
// The card file runs in a browser (as a plain <script>, not a module — see
// the IIFE wrapper at the top of air-conditioner-card.js), so it needs
// browser globals. The test script runs under Node.
module.exports = [
  {
    files: ['air-conditioner-card.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        window: 'readonly',
        document: 'readonly',
        customElements: 'readonly',
        HTMLElement: 'readonly',
        CustomEvent: 'readonly',
        ResizeObserver: 'readonly',
        requestAnimationFrame: 'readonly',
        console: 'readonly',
        FileReader: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        alert: 'readonly',
        IntersectionObserver: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-undef': 'error',
    },
  },
  {
    files: ['test/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'readonly',
        process: 'readonly',
        console: 'readonly',
        __dirname: 'readonly',
      },
    },
  },
  {
    ignores: ['node_modules/**'],
  },
];
