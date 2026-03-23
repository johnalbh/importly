import { ParsedImport } from './types';
import { GROUP_COUNT } from './constants';

/**
 * Sorts an array of ParsedImports by:
 *   1. Group (ascending — lower group number goes first)
 *   2. Source path alphabetically within each group
 *   3. Named imports alphabetically within each import
 *
 * Does not mutate the original array — returns a new sorted array.
 *
 * Example input (after grouper):
 *   { source: 'react',   group: 1 }
 *   { source: 'axios',   group: 2 }
 *   { source: 'fs',      group: 0 }
 *
 * Example output:
 *   { source: 'fs',      group: 0 }  ← NodeBuiltin first
 *   { source: 'react',   group: 1 }  ← React second
 *   { source: 'axios',   group: 2 }  ← External third
 */
export function sortImports(imports: ParsedImport[]): ParsedImport[] {
  // Step 1: sort named imports alphabetically within each import
  const withSortedNamed = imports.map((imp) => ({
    ...imp,
    namedImports: [...imp.namedImports].sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
    ),
  }));

  // Step 2: sort imports by group, then alphabetically by source
  return withSortedNamed.sort((a, b) => {
    // Different groups → sort by group number
    if (a.group !== b.group) {
      return a.group - b.group;
    }

    // Same group → sort alphabetically by source path
    return a.source.toLowerCase().localeCompare(b.source.toLowerCase());
  });
}

/**
 * Splits a sorted array of imports into buckets, one per group.
 * Empty groups are excluded from the result.
 *
 * Used by the formatter to add blank lines between groups.
 *
 * Example input:
 *   [
 *     { source: 'fs',    group: 0 },
 *     { source: 'react', group: 1 },
 *     { source: 'axios', group: 2 },
 *     { source: 'clsx',  group: 2 },
 *   ]
 *
 * Example output:
 *   [
 *     [{ source: 'fs',    group: 0 }],            ← bucket 0
 *     [{ source: 'react', group: 1 }],            ← bucket 1
 *     [{ source: 'axios', group: 2 },             ← bucket 2
 *      { source: 'clsx',  group: 2 }],
 *   ]
 */
export function groupByType(imports: ParsedImport[]): ParsedImport[][] {
  // Create one empty bucket per group
  const buckets: ParsedImport[][] = Array.from(
    { length: GROUP_COUNT },
    () => [],
  );

  // Place each import in its bucket
  for (const imp of imports) {
    buckets[imp.group].push(imp);
  }

  // Return only non-empty buckets so the formatter
  // doesn't add blank lines for groups that don't exist
  return buckets.filter((bucket) => bucket.length > 0);
}
