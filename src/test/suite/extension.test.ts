import * as assert from 'assert';
import { parseImportStatement, extractImportStrings } from '../../parser';
import { assignGroups } from '../../grouper';
import { sortImports } from '../../sorter';
import { formatImport, formatImports } from '../../formatter';
import { ImportGroup, SorterConfig } from '../../types';

// Default config used across all tests
const CONFIG: SorterConfig = {
  aliases: ['@/', '~/', '#'],
  separateGroups: true,
  multilineThreshold: 3,
  quoteStyle: 'single',
  trailingComma: true,
  semicolons: true,
};

// =============================================================================
// PARSER TESTS
// =============================================================================

suite('Parser — parseImportStatement', () => {

  test('parses default import', () => {
    const imp = parseImportStatement("import React from 'react';");
    assert.strictEqual(imp.defaultImport, 'React');
    assert.strictEqual(imp.source, 'react');
    assert.strictEqual(imp.isTypeImport, false);
    assert.strictEqual(imp.isSideEffect, false);
    assert.strictEqual(imp.hasSemicolon, true);
    assert.strictEqual(imp.namedImports.length, 0);
  });

  test('parses named imports', () => {
    const imp = parseImportStatement("import { useState, useEffect } from 'react';");
    assert.strictEqual(imp.namedImports.length, 2);
    assert.strictEqual(imp.namedImports[0].name, 'useState');
    assert.strictEqual(imp.namedImports[1].name, 'useEffect');
    assert.strictEqual(imp.defaultImport, undefined);
  });

  test('parses default + named imports', () => {
    const imp = parseImportStatement("import React, { useState, useEffect } from 'react';");
    assert.strictEqual(imp.defaultImport, 'React');
    assert.strictEqual(imp.namedImports.length, 2);
  });

  test('parses import type (fixes original plugin bug)', () => {
    const imp = parseImportStatement("import type { User, Profile } from '@/types';");
    assert.strictEqual(imp.isTypeImport, true);
    assert.strictEqual(imp.source, '@/types');
    assert.strictEqual(imp.namedImports.length, 2);
    // Should NOT have a defaultImport — this was the bug in the original plugin
    assert.strictEqual(imp.defaultImport, undefined);
  });

  test('parses inline type named import', () => {
    const imp = parseImportStatement("import { useEffect, type FC } from 'react';");
    assert.strictEqual(imp.isTypeImport, false);
    assert.strictEqual(imp.namedImports[0].name, 'useEffect');
    assert.strictEqual(imp.namedImports[0].isTypeOnly, false);
    assert.strictEqual(imp.namedImports[1].name, 'FC');
    assert.strictEqual(imp.namedImports[1].isTypeOnly, true);
  });

  test('parses side-effect import', () => {
    const imp = parseImportStatement("import './global.css';");
    assert.strictEqual(imp.isSideEffect, true);
    assert.strictEqual(imp.source, './global.css');
    assert.strictEqual(imp.namedImports.length, 0);
  });

  test('parses namespace import', () => {
    const imp = parseImportStatement("import * as path from 'path';");
    assert.strictEqual(imp.namespaceImport, 'path');
    assert.strictEqual(imp.source, 'path');
  });

  test('parses aliased named import', () => {
    const imp = parseImportStatement("import { useEffect as useEff } from 'react';");
    assert.strictEqual(imp.namedImports[0].name, 'useEffect');
    assert.strictEqual(imp.namedImports[0].alias, 'useEff');
  });

  test('parses double quote imports', () => {
    const imp = parseImportStatement('import React from "react";');
    assert.strictEqual(imp.quoteChar, '"');
    assert.strictEqual(imp.source, 'react');
  });

  test('parses multiline import', () => {
    const raw = "import {\n  useState,\n  useEffect,\n} from 'react';";
    const imp = parseImportStatement(raw);
    assert.strictEqual(imp.originalIsMultiline, true);
    assert.strictEqual(imp.namedImports.length, 2);
    assert.strictEqual(imp.source, 'react');
  });

});

suite('Parser — extractImportStrings', () => {

  test('extracts single-line imports', () => {
    const text = [
      "import React from 'react';",
      "import axios from 'axios';",
      '',
      'const x = 1;',
    ].join('\n');

    const { imports, rest } = extractImportStrings(text);
    assert.strictEqual(imports.length, 2);
    assert.ok(rest.includes('const x = 1;'));
  });

  test('extracts multiline imports', () => {
    const text = [
      'import {',
      '  useState,',
      '  useEffect,',
      "} from 'react';",
      "import axios from 'axios';",
    ].join('\n');

    const { imports } = extractImportStrings(text);
    assert.strictEqual(imports.length, 2);
    assert.ok(imports[0].includes('useState'));
    assert.ok(imports[0].includes('useEffect'));
  });

  test('returns empty imports for text with no imports', () => {
    const { imports, rest } = extractImportStrings('const x = 1;\nconst y = 2;');
    assert.strictEqual(imports.length, 0);
    assert.ok(rest.includes('const x = 1;'));
  });

  test("preserves 'use client' directive as preamble", () => {
    const text = [
      "'use client';",
      '',
      "import React from 'react';",
      "import axios from 'axios';",
      '',
      'export default function Page() {}',
    ].join('\n');

    const { preamble, imports, rest } = extractImportStrings(text);
    assert.ok(preamble.includes("'use client'"), 'Preamble should contain the directive');
    assert.strictEqual(imports.length, 2);
    assert.ok(rest.includes('export default function Page()'));
  });

  test("preserves 'use server' directive as preamble", () => {
    const text = [
      "'use server';",
      "import { cache } from 'react';",
    ].join('\n');

    const { preamble, imports } = extractImportStrings(text);
    assert.ok(preamble.includes("'use server'"), 'Preamble should contain the directive');
    assert.strictEqual(imports.length, 1);
  });

  test('handles directive without blank line before imports', () => {
    const text = "'use client';\nimport React from 'react';";
    const { preamble, imports } = extractImportStrings(text);
    assert.ok(preamble.includes("'use client'"));
    assert.strictEqual(imports.length, 1);
  });

  test('handles directive with double quotes', () => {
    const text = '"use client";\nimport React from \'react\';';
    const { preamble, imports } = extractImportStrings(text);
    assert.ok(preamble.includes('"use client"'));
    assert.strictEqual(imports.length, 1);
  });

});

// =============================================================================
// GROUPER TESTS
// =============================================================================

suite('Grouper — assignGroups', () => {

  test('assigns NodeBuiltin to fs', () => {
    const imp = parseImportStatement("import fs from 'fs';");
    const [grouped] = assignGroups([imp], CONFIG);
    assert.strictEqual(grouped.group, ImportGroup.NodeBuiltin);
  });

  test('assigns NodeBuiltin to node: prefix', () => {
    const imp = parseImportStatement("import path from 'node:path';");
    const [grouped] = assignGroups([imp], CONFIG);
    assert.strictEqual(grouped.group, ImportGroup.NodeBuiltin);
  });

  test('assigns NodeBuiltin to fs/promises subpath', () => {
    const imp = parseImportStatement("import { readFile } from 'fs/promises';");
    const [grouped] = assignGroups([imp], CONFIG);
    assert.strictEqual(grouped.group, ImportGroup.NodeBuiltin);
  });

  test('assigns React group to react', () => {
    const imp = parseImportStatement("import React from 'react';");
    const [grouped] = assignGroups([imp], CONFIG);
    assert.strictEqual(grouped.group, ImportGroup.React);
  });

  test('assigns React group to react-dom/client', () => {
    const imp = parseImportStatement("import { createRoot } from 'react-dom/client';");
    const [grouped] = assignGroups([imp], CONFIG);
    assert.strictEqual(grouped.group, ImportGroup.React);
  });

  test('assigns External to axios', () => {
    const imp = parseImportStatement("import axios from 'axios';");
    const [grouped] = assignGroups([imp], CONFIG);
    assert.strictEqual(grouped.group, ImportGroup.External);
  });

  test('assigns InternalAlias to @/ path', () => {
    const imp = parseImportStatement("import Layout from '@/components/Layout';");
    const [grouped] = assignGroups([imp], CONFIG);
    assert.strictEqual(grouped.group, ImportGroup.InternalAlias);
  });

  test('assigns ParentRelative to ../ path', () => {
    const imp = parseImportStatement("import Header from '../Header';");
    const [grouped] = assignGroups([imp], CONFIG);
    assert.strictEqual(grouped.group, ImportGroup.ParentRelative);
  });

  test('assigns SameLevel to ./ path', () => {
    const imp = parseImportStatement("import utils from './utils';");
    const [grouped] = assignGroups([imp], CONFIG);
    assert.strictEqual(grouped.group, ImportGroup.SameLevel);
  });

  test('assigns Types to import type regardless of source', () => {
    const imp = parseImportStatement("import type { User } from '@/types';");
    const [grouped] = assignGroups([imp], CONFIG);
    // Must be Types, NOT InternalAlias — this was the bug in the original plugin
    assert.strictEqual(grouped.group, ImportGroup.Types);
  });

  test('assigns SideEffect to side-effect import', () => {
    const imp = parseImportStatement("import './global.css';");
    const [grouped] = assignGroups([imp], CONFIG);
    assert.strictEqual(grouped.group, ImportGroup.SideEffect);
  });

});

// =============================================================================
// SORTER TESTS
// =============================================================================

suite('Sorter — sortImports', () => {

  test('sorts by group number', () => {
    const imports = [
      "import axios from 'axios';",
      "import fs from 'fs';",
      "import React from 'react';",
    ].map(parseImportStatement);

    const grouped = assignGroups(imports, CONFIG);
    const sorted = sortImports(grouped);

    assert.strictEqual(sorted[0].source, 'fs');     // group 0
    assert.strictEqual(sorted[1].source, 'react');  // group 1
    assert.strictEqual(sorted[2].source, 'axios');  // group 2
  });

  test('sorts alphabetically within the same group', () => {
    const imports = [
      "import lodash from 'lodash';",
      "import axios from 'axios';",
      "import clsx from 'clsx';",
    ].map(parseImportStatement);

    const grouped = assignGroups(imports, CONFIG);
    const sorted = sortImports(grouped);

    assert.strictEqual(sorted[0].source, 'axios');
    assert.strictEqual(sorted[1].source, 'clsx');
    assert.strictEqual(sorted[2].source, 'lodash');
  });

  test('sorts named imports alphabetically', () => {
    const imp = parseImportStatement(
      "import { useState, useCallback, useEffect } from 'react';"
    );
    const [grouped] = assignGroups([imp], CONFIG);
    const [sorted] = sortImports([grouped]);

    assert.strictEqual(sorted.namedImports[0].name, 'useCallback');
    assert.strictEqual(sorted.namedImports[1].name, 'useEffect');
    assert.strictEqual(sorted.namedImports[2].name, 'useState');
  });

  test('side-effects always go last', () => {
    const imports = [
      "import './global.css';",
      "import React from 'react';",
      "import fs from 'fs';",
    ].map(parseImportStatement);

    const grouped = assignGroups(imports, CONFIG);
    const sorted = sortImports(grouped);

    assert.strictEqual(sorted[sorted.length - 1].source, './global.css');
  });

});

// =============================================================================
// FORMATTER TESTS
// =============================================================================

suite('Formatter — formatImport', () => {

  test('formats default import', () => {
    const imp = parseImportStatement("import React from 'react';");
    const [grouped] = assignGroups([imp], CONFIG);
    const result = formatImport(grouped, CONFIG);
    assert.strictEqual(result, "import React from 'react';");
  });

  test('formats named imports', () => {
    const imp = parseImportStatement("import { useState } from 'react';");
    const [grouped] = assignGroups([imp], CONFIG);
    const result = formatImport(grouped, CONFIG);
    assert.strictEqual(result, "import { useState } from 'react';");
  });

  test('formats import type correctly (no comma bug)', () => {
    const imp = parseImportStatement("import type { User } from '@/types';");
    const [grouped] = assignGroups([imp], CONFIG);
    const result = formatImport(grouped, CONFIG);
    // Must be "import type { User }" NOT "import type, { User }"
    assert.strictEqual(result, "import type { User } from '@/types';");
    assert.ok(!result.includes('type,'), 'Must not contain "type,"');
  });

  test('formats side-effect import', () => {
    const imp = parseImportStatement("import './global.css';");
    const [grouped] = assignGroups([imp], CONFIG);
    const result = formatImport(grouped, CONFIG);
    assert.strictEqual(result, "import './global.css';");
  });

  test('switches to multiline when named imports exceed threshold', () => {
    // threshold = 3, this has 4 named → multiline
    const imp = parseImportStatement(
      "import { Button, Input, Modal, Select } from '@mui/material';"
    );
    const [grouped] = assignGroups([imp], CONFIG);
    const result = formatImport(grouped, CONFIG);
    assert.ok(result.includes('\n'), 'Result should be multiline');
    assert.ok(result.includes('  Button,'));
    assert.ok(result.includes('  Input,'));
  });

  test('uses double quotes when configured', () => {
    const imp = parseImportStatement("import React from 'react';");
    const [grouped] = assignGroups([imp], CONFIG);
    const result = formatImport(grouped, { ...CONFIG, quoteStyle: 'double' });
    assert.ok(result.includes('"react"'));
  });

  test('omits semicolon when configured', () => {
    const imp = parseImportStatement("import React from 'react';");
    const [grouped] = assignGroups([imp], CONFIG);
    const result = formatImport(grouped, { ...CONFIG, semicolons: false });
    assert.ok(!result.endsWith(';'));
  });

  test('omits trailing comma on last item in multiline when trailingComma is false', () => {
    // threshold = 3, this has 4 named → multiline
    const imp = parseImportStatement(
      "import { Button, Input, Modal, Select } from '@mui/material';"
    );
    const [grouped] = assignGroups([imp], CONFIG);
    const result = formatImport(grouped, { ...CONFIG, trailingComma: false });
    const lines = result.split('\n');
    // The line with "Select" (last named import) must NOT end with comma
    const selectLine = lines.find((l) => l.includes('Select'));
    assert.ok(selectLine && !selectLine.trimEnd().endsWith(','), 'Last item must not have trailing comma');
    // But intermediate items still have commas
    const buttonLine = lines.find((l) => l.includes('Button'));
    assert.ok(buttonLine && buttonLine.trimEnd().endsWith(','), 'Intermediate items must still have commas');
  });

});

// =============================================================================
// INTEGRATION TEST
// =============================================================================

suite('Integration — full sort pipeline', () => {

  test('sorts a realistic import block correctly', () => {
    const input = [
      "import './global.css';",
      "import { Modal, Button, Input } from '@mui/material';",
      "import React, { useState, useEffect, useCallback } from 'react';",
      "import axios from 'axios';",
      "import fs from 'fs';",
      "import type { User } from '@/types';",
      "import Header from '../Header';",
      "import utils from './utils';",
    ].join('\n');

    const { imports } = extractImportStrings(input);
    const parsed  = imports.map(parseImportStatement);
    const grouped = assignGroups(parsed, CONFIG);
    const sorted  = sortImports(grouped);
    const output  = formatImports(sorted, CONFIG);
    const lines   = output.split('\n').filter((l) => l.trim());

    // First import must be fs (NodeBuiltin = group 0)
    assert.ok(lines[0].includes("'fs'"), `Expected fs first, got: ${lines[0]}`);

    // React before axios
    const reactIdx = lines.findIndex((l) => l.includes("'react'"));
    const axiosIdx = lines.findIndex((l) => l.includes("'axios'"));
    assert.ok(reactIdx < axiosIdx, 'React should come before axios');

    // Types before side-effects
    const typesIdx  = lines.findIndex((l) => l.includes("'@/types'"));
    const cssIdx    = lines.findIndex((l) => l.includes("'./global.css'"));
    assert.ok(typesIdx < cssIdx, 'Types should come before side-effects');

    // global.css must be last
    assert.ok(
      lines[lines.length - 1].includes("'./global.css'"),
      'global.css should be last',
    );
  });

  test("preserves 'use client' directive through full pipeline", () => {
    const input = [
      "'use client';",
      '',
      "import { useRouter } from 'next/navigation';",
      "import React, { useState } from 'react';",
      "import type { FC } from 'react';",
      '',
      'export default function Page() { return null; }',
    ].join('\n');

    const { preamble, imports, rest } = extractImportStrings(input);
    const parsed    = imports.map(parseImportStatement);
    const grouped   = assignGroups(parsed, CONFIG);
    const sorted    = sortImports(grouped);
    const formatted = formatImports(sorted, CONFIG);

    // Reconstruct (same logic as sortText in extension.ts)
    const parts: string[] = [];
    if (preamble.trimEnd().length > 0) {
      parts.push(preamble.trimEnd());
      parts.push('');
    }
    parts.push(formatted);
    const trimmedRest = rest.trimStart();
    if (trimmedRest.length > 0) {
      parts.push('');
      parts.push(trimmedRest);
    }
    const output = parts.join('\n');

    // Directive must be the very first line
    assert.ok(output.startsWith("'use client';"), `Directive must be first, got: ${output.slice(0, 30)}`);

    // React group before External (next/navigation)
    const lines = output.split('\n').filter((l) => l.trim());
    const reactIdx = lines.findIndex((l) => l.includes("'react'"));
    const nextIdx  = lines.findIndex((l) => l.includes("'next/navigation'"));
    assert.ok(reactIdx < nextIdx, 'React should come before next/navigation');

    // Type import comes after react/external (group Types = 6)
    const typeIdx = lines.findIndex((l) => l.includes('import type'));
    assert.ok(typeIdx > nextIdx, 'Type import should come after external imports');

    // Rest of file is preserved
    assert.ok(output.includes('export default function Page()'), 'Rest of file must be preserved');
  });

  test("'use client' is placed before a blank line and then imports", () => {
    // Verifies the blank line normalization: directive → blank line → imports
    const input = "'use client';\nimport axios from 'axios';";

    const { preamble, imports } = extractImportStrings(input);
    const parsed    = imports.map(parseImportStatement);
    const grouped   = assignGroups(parsed, CONFIG);
    const sorted    = sortImports(grouped);
    const formatted = formatImports(sorted, CONFIG);

    const parts: string[] = [];
    if (preamble.trimEnd().length > 0) {
      parts.push(preamble.trimEnd());
      parts.push('');
    }
    parts.push(formatted);
    const output = parts.join('\n');

    // Should be: 'use client';\n\nimport axios...
    assert.strictEqual(output, "'use client';\n\nimport axios from 'axios';");
  });

});
