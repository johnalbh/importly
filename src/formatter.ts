import { ParsedImport, SorterConfig } from './types';
import { groupByType } from './sorter';

// ---------------------------------------------------------------------------
// formatImport
// ---------------------------------------------------------------------------

/**
 * Converts a single ParsedImport back into a formatted import string.
 * Respects user configuration for quotes, semicolons, and multiline threshold.
 *
 * Examples:
 *   side-effect  → import './global.css';
 *   namespace    → import * as path from 'path';
 *   default      → import React from 'react';
 *   named        → import { useState, useEffect } from 'react';
 *   default+named → import React, { useState } from 'react';
 *   type         → import type { User } from '@/types';
 *   multiline    → import {\n  Button,\n  Input,\n} from '@mui/material';
 */
export function formatImport(imp: ParsedImport, config: SorterConfig): string {
  const q = config.quoteStyle === 'double' ? '"' : "'";
  const semi = config.semicolons ? ';' : '';
  const typeKeyword = imp.isTypeImport ? 'type ' : '';

  // ── Side-effect import ──────────────────────────────────────────────────
  // import './global.css';
  if (imp.isSideEffect) {
    return `import ${q}${imp.source}${q}${semi}`;
  }

  // ── Namespace import ────────────────────────────────────────────────────
  // import * as path from 'path';
  if (imp.namespaceImport) {
    return `import ${typeKeyword}* as ${imp.namespaceImport} from ${q}${imp.source}${q}${semi}`;
  }

  // ── Decide: single line or multiline ────────────────────────────────────
  // Switch to multiline when named imports exceed the threshold
  const shouldBeMultiline = imp.namedImports.length > config.multilineThreshold;

  if (shouldBeMultiline) {
    return formatMultiline(imp, config);
  }

  return formatSingleLine(imp, config);
}

// ---------------------------------------------------------------------------
// formatSingleLine
// ---------------------------------------------------------------------------

/**
 * Formats an import as a single line.
 *
 * Examples:
 *   import React from 'react';
 *   import { useState, useEffect } from 'react';
 *   import React, { useState } from 'react';
 *   import type { User } from '@/types';
 */
function formatSingleLine(imp: ParsedImport, config: SorterConfig): string {
  const q = config.quoteStyle === 'double' ? '"' : "'";
  const semi = config.semicolons ? ';' : '';
  const typeKeyword = imp.isTypeImport ? 'type ' : '';

  // Build the named imports string: { Button, Input, Modal }
  const namedStr =
    imp.namedImports.length > 0
      ? `{ ${imp.namedImports
          .map((n) => {
            const typePrefix = n.isTypeOnly ? 'type ' : '';
            return n.alias
              ? `${typePrefix}${n.name} as ${n.alias}`
              : `${typePrefix}${n.name}`;
          })
          .join(', ')} }`
      : null;

  // Build the full specifier: default, { named }, or both
  let specifier = '';
  if (imp.defaultImport && namedStr) {
    specifier = `${imp.defaultImport}, ${namedStr}`;
  } else if (imp.defaultImport) {
    specifier = imp.defaultImport;
  } else if (namedStr) {
    specifier = namedStr;
  }

  return `import ${typeKeyword}${specifier} from ${q}${imp.source}${q}${semi}`;
}

// ---------------------------------------------------------------------------
// formatMultiline
// ---------------------------------------------------------------------------

/**
 * Formats an import across multiple lines when named imports exceed the threshold.
 *
 * Example (threshold = 3, this import has 4 named):
 *   import {
 *     Button,
 *     Input,
 *     Modal,
 *     Select,
 *   } from '@mui/material';
 *
 * With a default import:
 *   import React, {
 *     useCallback,
 *     useEffect,
 *     useState,
 *   } from 'react';
 */
function formatMultiline(imp: ParsedImport, config: SorterConfig): string {
  const q = config.quoteStyle === 'double' ? '"' : "'";
  const semi = config.semicolons ? ';' : '';
  const typeKeyword = imp.isTypeImport ? 'type ' : '';
  const defaultPart = imp.defaultImport ? `${imp.defaultImport}, ` : '';

  // Each named import on its own indented line.
  // Only the last item respects config.trailingComma; all others always have a comma.
  const namedLines = imp.namedImports
    .map((n, index, arr) => {
      const typePrefix = n.isTypeOnly ? 'type ' : '';
      const nameStr = n.alias
        ? `${typePrefix}${n.name} as ${n.alias}`
        : `${typePrefix}${n.name}`;
      const isLast = index === arr.length - 1;
      const comma = !isLast || config.trailingComma ? ',' : '';
      return `  ${nameStr}${comma}`;
    })
    .join('\n');

  return [
    `import ${typeKeyword}${defaultPart}{`,
    namedLines,
    `} from ${q}${imp.source}${q}${semi}`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// formatImports
// ---------------------------------------------------------------------------

/**
 * Converts the full sorted array of ParsedImports into the final output string.
 *
 * Groups are separated by a blank line when config.separateGroups is true.
 *
 * Example output (separateGroups: true):
 *   import fs from 'fs';
 *
 *   import React, { useCallback, useEffect, useState } from 'react';
 *
 *   import axios from 'axios';
 *   import { Button, Input } from '@mui/material';
 *
 *   import type { User } from '@/types';
 *
 *   import './global.css';
 */
export function formatImports(
  imports: ParsedImport[],
  config: SorterConfig,
): string {
  // Split into buckets by group (empty groups excluded)
  const groups = groupByType(imports);

  // Format each group, then join with blank lines between groups
  return groups
    .map((group) =>
      group.map((imp) => formatImport(imp, config)).join('\n'),
    )
    .join(config.separateGroups ? '\n\n' : '\n');
}
