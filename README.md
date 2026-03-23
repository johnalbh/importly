# Importly

> VS Code extension that automatically sorts JavaScript and TypeScript imports following modern standards.

## Features

- **Auto-sort on save** — imports are sorted every time you save a file
- **Manual command** — sort on demand via command palette or keyboard shortcut
- **8 import groups** — organized by type with blank lines between groups
- **`import type` support** — correctly handles TypeScript type imports
- **Alphabetical sorting** — both imports and named imports sorted alphabetically
- **Multiline formatting** — automatically formats long imports across multiple lines
- **Configurable** — quotes, semicolons, aliases, and more

---

## Result Example

**Before:**

```typescript
import './global.css';
import { Modal, Button, Input } from '@mui/material';
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import fs from 'fs';
import type { User } from '@/types';
import Header from '../Header';
import utils from './utils';
```

**After:**

```typescript
import fs from 'fs';

import React, { useCallback, useEffect, useState } from 'react';

import axios from 'axios';
import { Button, Input, Modal } from '@mui/material';

import Header from '../Header';

import utils from './utils';

import type { User } from '@/types';

import './global.css';
```

---

## Import Groups

Importly organizes imports into 8 groups in this order:

| # | Group | Example |
|---|---|---|
| 0 | Node built-ins | `import fs from 'fs'` |
| 1 | React / ReactDOM | `import React from 'react'` |
| 2 | External libraries | `import axios from 'axios'` |
| 3 | Internal aliases | `import Layout from '@/components/Layout'` |
| 4 | Parent relative | `import Header from '../Header'` |
| 5 | Same-level relative | `import utils from './utils'` |
| 6 | Type imports | `import type { User } from '@/types'` |
| 7 | Side effects | `import './global.css'` |

---

## Usage

### Auto-sort on save
Importly sorts your imports automatically every time you save a `.js`, `.ts`, `.jsx`, `.tsx`, `.mjs` or `.cjs` file.

### Manual sort
Three ways to trigger a manual sort:

**1. Command palette**
```
Cmd+Shift+P → Importly: Sort Imports
```

**2. Keyboard shortcut**
```
Mac:     Cmd+Shift+Alt+S
Windows: Ctrl+Shift+Alt+S
```

**3. Right-click context menu**

Right-click anywhere in the editor → **Sort Imports**

### Sort selected imports only
Select a block of imports and trigger the command — only the selected text will be sorted.

---

## Configuration

All settings are available under `Importly` in VS Code settings (`Cmd+,`).

| Setting | Type | Default | Description |
|---|---|---|---|
| `importly.aliases` | `string[]` | `["@/", "~/", "#"]` | Path alias prefixes treated as internal imports |
| `importly.separateGroups` | `boolean` | `true` | Add a blank line between each import group |
| `importly.multilineThreshold` | `number` | `3` | Named imports count before switching to multiline |
| `importly.sortOnSave` | `boolean` | `true` | Auto-sort imports on file save |
| `importly.quoteStyle` | `string` | `"single"` | Quote style: `"single"` or `"double"` |
| `importly.trailingComma` | `boolean` | `true` | Add trailing comma in multiline imports |
| `importly.semicolons` | `boolean` | `true` | Add semicolons at end of import statements |

### Example `settings.json`

```json
{
  "importly.aliases": ["@/", "~/", "#", "src/"],
  "importly.separateGroups": true,
  "importly.multilineThreshold": 3,
  "importly.sortOnSave": true,
  "importly.quoteStyle": "single",
  "importly.trailingComma": true,
  "importly.semicolons": true
}
```

---

## Project Structure

```
src/
├── types.ts        — Data structures (ImportGroup, ParsedImport, SorterConfig)
├── constants.ts    — Node built-ins list and React packages list
├── parser.ts       — Converts raw import text into ParsedImport objects
├── grouper.ts      — Assigns each import to its group
├── sorter.ts       — Sorts imports by group and alphabetically
├── formatter.ts    — Converts ParsedImport objects back to formatted text
├── extension.ts    — VS Code entry point (commands and save listener)
└── test/
    └── suite/
        └── extension.test.ts  — 36 tests covering the full pipeline
```

### How the pipeline works

```
Raw file text
    ↓
parser.ts       →  Finds all import statements, parses each one into an object
    ↓
grouper.ts      →  Assigns the correct group (NodeBuiltin, React, External, etc.)
    ↓
sorter.ts       →  Orders by group number, then alphabetically by source
    ↓
formatter.ts    →  Rebuilds the import strings with correct formatting
    ↓
Sorted imports written back to the file
```

---

## Supported File Types

`.js` `.jsx` `.ts` `.tsx` `.mjs` `.cjs`

---

## License

MIT © [johnalbh](https://github.com/johnalbh)
