/**
 * Defines the order of import groups.
 * The numeric value determines the final sort order (lower = first).
 */
export const enum ImportGroup {
  NodeBuiltin    = 0, // import fs from 'fs'
  React          = 1, // import React from 'react'
  External       = 2, // import axios from 'axios'
  InternalAlias  = 3, // import Layout from '@/components/Layout'
  ParentRelative = 4, // import Header from '../Header'
  SameLevel      = 5, // import utils from './utils'
  Types          = 6, // import type { User } from '@/types'
  SideEffect     = 7, // import './global.css'
}

/**
 * Represents a single named (destructured) import item.
 *
 * Examples:
 *   import { useState }            → { name: 'useState', isTypeOnly: false }
 *   import { useEffect as useEff } → { name: 'useEffect', alias: 'useEff', isTypeOnly: false }
 *   import { type FC }             → { name: 'FC', isTypeOnly: true }
 */
export interface NamedImport {
  /** The original exported name */
  name: string;
  /** Local alias when using "as", e.g. useEffect as useEff */
  alias?: string;
  /** True when using inline type keyword: import { type FC } */
  isTypeOnly: boolean;
}

/**
 * Represents a fully parsed import statement with all its parts.
 *
 * Examples:
 *   import React from 'react'
 *     → defaultImport: 'React', source: 'react'
 *
 *   import React, { useState, useEffect } from 'react'
 *     → defaultImport: 'React', namedImports: [useState, useEffect]
 *
 *   import type { User } from '@/types'
 *     → isTypeImport: true, namedImports: [User]
 *
 *   import './global.css'
 *     → isSideEffect: true, source: './global.css'
 *
 *   import * as path from 'path'
 *     → namespaceImport: 'path', source: 'path'
 */
export interface ParsedImport {
  /** Original raw text, preserved for fallback */
  raw: string;
  /** True when the whole import uses "import type { }" syntax */
  isTypeImport: boolean;
  /** True when it is a side-effect import: import './file' */
  isSideEffect: boolean;
  /** Default import name, e.g. React in: import React from 'react' */
  defaultImport?: string;
  /** Namespace import name, e.g. path in: import * as path from 'path' */
  namespaceImport?: string;
  /** Named/destructured imports inside { } */
  namedImports: NamedImport[];
  /** The module path: 'react', './utils', '@/types' */
  source: string;
  /** Assigned import group (set by grouper) */
  group: ImportGroup;
  /** Whether the original statement spanned multiple lines */
  originalIsMultiline: boolean;
  /** Quote character used in the original: ' or " */
  quoteChar: string;
  /** Whether the original had a trailing semicolon */
  hasSemicolon: boolean;
}

/**
 * User-facing configuration for the sorter,
 * mapped from VS Code workspace settings.
 */
export interface SorterConfig {
  /** Alias prefixes treated as internal imports: ['@/', '~/', '#'] */
  aliases: string[];
  /** Add a blank line between each import group */
  separateGroups: boolean;
  /** Number of named imports before switching to multiline format */
  multilineThreshold: number;
  /** Quote style for regenerated imports */
  quoteStyle: 'single' | 'double';
  /** Add trailing comma in multiline imports */
  trailingComma: boolean;
  /** Add semicolons at end of import statements */
  semicolons: boolean;
}
