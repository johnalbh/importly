import { ImportGroup, NamedImport, ParsedImport } from './types';

/**
 * Detects the start of an import statement.
 * Matches lines that begin with the word "import".
 */
const IMPORT_START_RE = /^import\b/;

/**
 * Detects the end of an import statement.
 * Two valid endings:
 *   1. from 'module' or from "module"  ← regular import
 *   2. import 'module' or import "module"  ← side-effect import
 */
const IMPORT_END_RE = /from\s*(['"])[^'"]+\1\s*;?\s*$|^import\s*(['"])[^'"]+\2\s*;?\s*$/;

/**
 * Matches React/Next.js file directives that appear before imports.
 * Examples: 'use client';  'use server';
 */
const DIRECTIVE_RE = /^['"]use \w+['"]\s*;?\s*$/;

// ---------------------------------------------------------------------------
// extractImportStrings
// ---------------------------------------------------------------------------

/**
 * Scans raw file text and extracts all import statement strings.
 * Handles both single-line and multiline imports.
 * Preserves leading directives like 'use client' and 'use server'.
 *
 * Returns:
 *   preamble → directives/blank lines before the import block (e.g. 'use client';)
 *   imports  → array of raw import strings (one per statement)
 *   rest     → everything after the import block
 *
 * Example input:
 *   'use client';
 *
 *   import React from 'react';
 *   const x = 1;
 *
 * Example output:
 *   preamble: "'use client';\n"
 *   imports:  ["import React from 'react';"]
 *   rest:     "const x = 1;"
 */
export function extractImportStrings(text: string): {
  preamble: string;
  imports: string[];
  rest: string;
} {
  const lines = text.split('\n');
  const preambleLines: string[] = [];
  const imports: string[] = [];
  let i = 0;
  let inImport = false;
  let currentImport: string[] = [];

  // ── Collect preamble (directives and blank lines before imports) ──────────
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (trimmed === '' || DIRECTIVE_RE.test(trimmed)) {
      preambleLines.push(lines[i]);
      i++;
    } else {
      break;
    }
  }

  // ── Collect import statements ─────────────────────────────────────────────
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!inImport) {
      if (IMPORT_START_RE.test(trimmed)) {
        inImport = true;
        currentImport = [line];

        if (IMPORT_END_RE.test(trimmed)) {
          imports.push(currentImport.join('\n'));
          currentImport = [];
          inImport = false;
        }
      } else if (trimmed === '') {
        // Skip blank lines between imports
      } else {
        // Non-import, non-blank line → end of import block
        const rest = lines.slice(i).join('\n');
        return { preamble: preambleLines.join('\n'), imports, rest };
      }
    } else {
      currentImport.push(line);

      if (IMPORT_END_RE.test(trimmed)) {
        imports.push(currentImport.join('\n'));
        currentImport = [];
        inImport = false;
      }
    }

    i++;
  }

  if (currentImport.length > 0) {
    imports.push(currentImport.join('\n'));
  }

  return { preamble: preambleLines.join('\n'), imports, rest: '' };
}

// ---------------------------------------------------------------------------
// parseNamedImports
// ---------------------------------------------------------------------------

/**
 * Parses the content inside { } into an array of NamedImport objects.
 *
 * Handles:
 *   useState                   → { name: 'useState', isTypeOnly: false }
 *   useEffect as useEff        → { name: 'useEffect', alias: 'useEff', isTypeOnly: false }
 *   type FC                    → { name: 'FC', isTypeOnly: true }
 *   type ReactNode as Node     → { name: 'ReactNode', alias: 'Node', isTypeOnly: true }
 */
function parseNamedImports(content: string): NamedImport[] {
  return content
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      // Check for inline "type" keyword: import { type FC }
      const typeMatch = s.match(/^type\s+(.+)$/);
      const isTypeOnly = Boolean(typeMatch);
      const nameStr = typeMatch ? typeMatch[1].trim() : s;

      // Check for alias: useEffect as useEff
      const aliasMatch = nameStr.match(/^(\S+)\s+as\s+(\S+)$/);
      if (aliasMatch) {
        return { name: aliasMatch[1], alias: aliasMatch[2], isTypeOnly };
      }

      return { name: nameStr, isTypeOnly };
    });
}

// ---------------------------------------------------------------------------
// parseImportStatement
// ---------------------------------------------------------------------------

/**
 * Converts a raw import string (single or multiline) into a ParsedImport object.
 *
 * Handles all valid import forms:
 *
 *   import 'module'                          → side-effect
 *   import defaultExport from 'module'       → default
 *   import * as name from 'module'           → namespace
 *   import { a, b } from 'module'            → named
 *   import Default, { a, b } from 'module'   → default + named
 *   import type { A, B } from 'module'       → type import
 *   import { type A, b } from 'module'       → inline type + named
 */
export function parseImportStatement(raw: string): ParsedImport {
  const originalIsMultiline = raw.includes('\n');

  // Normalize multiline to single line for easier parsing
  const normalized = raw.replace(/\s+/g, ' ').trim();

  // Detect original quote character (' or ")
  const quoteMatch = normalized.match(/from\s*(['"])/);
  const quoteChar = quoteMatch ? quoteMatch[1] : "'";

  // Detect trailing semicolon
  const hasSemicolon = normalized.trimEnd().endsWith(';');

  // Strip semicolon for cleaner parsing
  const withoutSemi = hasSemicolon
    ? normalized.trimEnd().slice(0, -1).trim()
    : normalized;

  // ── Side-effect import ──────────────────────────────────────────────────
  // import './global.css'  or  import "module"
  const sideEffectMatch = withoutSemi.match(/^import\s+(['"])([^'"]+)\1\s*$/);
  if (sideEffectMatch) {
    return {
      raw,
      isTypeImport: false,
      isSideEffect: true,
      namedImports: [],
      source: sideEffectMatch[2],
      group: ImportGroup.SideEffect,
      originalIsMultiline,
      quoteChar: sideEffectMatch[1],
      hasSemicolon,
    };
  }

  // ── Detect "import type" ────────────────────────────────────────────────
  // import type { User } from '@/types'
  const isTypeImport = /^import\s+type\s+/.test(withoutSemi);

  // Remove the "type" keyword so the rest of the parsing is uniform
  const withoutType = isTypeImport
    ? withoutSemi.replace(/^import\s+type\s+/, 'import ')
    : withoutSemi;

  // ── Extract source path ─────────────────────────────────────────────────
  const sourceMatch = withoutType.match(/from\s+(['"])([^'"]+)\1\s*$/);
  const source = sourceMatch ? sourceMatch[2] : '';

  // ── Extract specifier (everything between "import" and "from '...'") ───
  const specifierStr = withoutType
    .replace(/^import\s+/, '')
    .replace(/\s+from\s+(['"])[^'"]+\1\s*$/, '')
    .trim();

  // ── Namespace import ────────────────────────────────────────────────────
  // import * as path from 'path'
  const namespaceMatch = specifierStr.match(/^\*\s+as\s+(\S+)$/);
  if (namespaceMatch) {
    return {
      raw,
      isTypeImport,
      isSideEffect: false,
      namespaceImport: namespaceMatch[1],
      namedImports: [],
      source,
      group: ImportGroup.External, // grouper will reassign
      originalIsMultiline,
      quoteChar,
      hasSemicolon,
    };
  }

  // ── Default and/or named imports ────────────────────────────────────────
  let defaultImport: string | undefined;
  let namedImports: NamedImport[] = [];

  const braceMatch = specifierStr.match(/\{([^}]*)\}/);
  if (braceMatch) {
    // Has named imports inside { }
    namedImports = parseNamedImports(braceMatch[1]);

    // Anything before { is the default import
    const beforeBrace = specifierStr
      .slice(0, specifierStr.indexOf('{'))
      .replace(/,\s*$/, '')
      .trim();

    if (beforeBrace) {
      defaultImport = beforeBrace;
    }
  } else {
    // No braces → only a default import
    defaultImport = specifierStr || undefined;
  }

  return {
    raw,
    isTypeImport,
    isSideEffect: false,
    defaultImport,
    namedImports,
    source,
    group: ImportGroup.External, // grouper will reassign
    originalIsMultiline,
    quoteChar,
    hasSemicolon,
  };
}
