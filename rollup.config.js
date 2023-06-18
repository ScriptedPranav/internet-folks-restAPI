import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';

export default {
  input: 'src/index.ts', // Entry point of your TypeScript code
  output: {
    file: 'dist/bundle.js', // Output file path and name
    format: 'cjs', // Output format (CommonJS module)
    sourcemap: true, // Generate sourcemaps for debugging
  },
  plugins: [
    resolve(), // Resolve external dependencies
    commonjs(), // Convert CommonJS modules to ES modules
    typescript(), // Transpile TypeScript code
    json(),
  ],
  external: [], // Specify any external dependencies to exclude from the bundle
};
