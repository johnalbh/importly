import { ImportGroup, ParsedImport, SorterConfig } from './types';
import { NODE_BUILTINS, REACT_PACKAGES } from './constants';

/**
 * Assigns the correct ImportGroup to each ParsedImport based on its source path.
 * Returns a new array — does not mutate the originals.
 *
 * Classification order (first match wins):
 *   1. import type { }     → Types      (regardless of source)
 *   2. side-effect import  → SideEffect (regardless of source)
 *   3. node: prefix        → NodeBuiltin
 *   4. known Node built-in → NodeBuiltin
 *   5. React core package  → React
 *   6. starts with ./      → SameLevel
 *   7. starts with ../     → ParentRelative
 *   8. matches user alias  → InternalAlias
 *   9. everything else     → External
 */
export function assignGroups(
  imports: ParsedImport[],
  config: SorterConfig,
): ParsedImport[] {
  return imports.map((imp) => ({
    ...imp,
    group: resolveGroup(imp, config),
  }));
}

/**
 * Determines the ImportGroup for a single ParsedImport.
 */
function resolveGroup(imp: ParsedImport, config: SorterConfig): ImportGroup {
  // Type imports always go to the Types group regardless of their source.
  // This fixes the bug in the original plugin where "import type" was
  // misclassified and ended up mixed with other groups.
  if (imp.isTypeImport) {
    return ImportGroup.Types;
  }

  // Side-effect imports always go last.
  // Example: import './global.css'
  if (imp.isSideEffect) {
    return ImportGroup.SideEffect;
  }

  const source = imp.source;

  // Node built-ins with the modern "node:" prefix.
  // Example: import path from 'node:path'
  if (source.startsWith('node:')) {
    return ImportGroup.NodeBuiltin;
  }

  // Node built-ins without prefix.
  // We check only the root module name to handle sub-paths like 'fs/promises'.
  // Example: import { readFile } from 'fs/promises'  →  root = 'fs' → NodeBuiltin
  const rootModule = source.split('/')[0];
  if (NODE_BUILTINS.has(rootModule)) {
    return ImportGroup.NodeBuiltin;
  }

  // React core packages.
  // Example: import { createRoot } from 'react-dom/client'
  if (REACT_PACKAGES.has(source)) {
    return ImportGroup.React;
  }

  // Same-level relative imports.
  // Example: import utils from './utils'
  if (source.startsWith('./')) {
    return ImportGroup.SameLevel;
  }

  // Parent relative imports.
  // Example: import Header from '../Header'
  if (source.startsWith('../')) {
    return ImportGroup.ParentRelative;
  }

  // Internal alias imports — configured by the user.
  // Default aliases: '@/', '~/', '#'
  // Example: import Layout from '@/components/Layout'
  for (const alias of config.aliases) {
    if (source.startsWith(alias)) {
      return ImportGroup.InternalAlias;
    }
  }

  // Everything else is an external library from npm.
  // Example: import axios from 'axios'
  // Example: import { Button } from '@mui/material'
  return ImportGroup.External;
}
