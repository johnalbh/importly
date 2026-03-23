/**
 * All known Node.js built-in module names (without the node: prefix).
 * Used by the grouper to distinguish built-ins from external packages.
 *
 * Both forms are valid in modern Node.js:
 *   import fs from 'fs'       ← matched by this Set
 *   import fs from 'node:fs'  ← matched by the 'node:' prefix check
 */
export const NODE_BUILTINS = new Set([
  'assert',
  'async_hooks',
  'buffer',
  'child_process',
  'cluster',
  'console',
  'constants',
  'crypto',
  'dgram',
  'diagnostics_channel',
  'dns',
  'domain',
  'events',
  'fs',
  'http',
  'http2',
  'https',
  'inspector',
  'module',
  'net',
  'os',
  'path',
  'perf_hooks',
  'process',
  'punycode',
  'querystring',
  'readline',
  'repl',
  'stream',
  'string_decoder',
  'sys',
  'timers',
  'tls',
  'trace_events',
  'tty',
  'url',
  'util',
  'v8',
  'vm',
  'wasi',
  'worker_threads',
  'zlib',
]);

/**
 * React core packages that should always be placed in the React group.
 * Covers React, ReactDOM and their modern sub-paths.
 */
export const REACT_PACKAGES = new Set([
  'react',
  'react-dom',
  'react-dom/client',
  'react-dom/server',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
]);

/**
 * File extensions supported by the extension.
 * Used to decide whether to activate auto-sort on save.
 */
export const SUPPORTED_EXTENSIONS = [
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
];

/**
 * Total number of import groups.
 * Must match the number of values in the ImportGroup enum.
 */
export const GROUP_COUNT = 8;
