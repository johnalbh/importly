import * as path from 'path';
import * as vscode from 'vscode';

import { assignGroups } from './grouper';
import { formatImports } from './formatter';
import { extractImportStrings, parseImportStatement } from './parser';
import { sortImports } from './sorter';
import { SorterConfig } from './types';
import { SUPPORTED_EXTENSIONS } from './constants';

// ---------------------------------------------------------------------------
// getConfig
// ---------------------------------------------------------------------------

/**
 * Reads the user's VS Code settings and returns a SorterConfig object.
 * Falls back to sensible defaults if a setting is not configured.
 */
function getConfig(): SorterConfig {
  const cfg = vscode.workspace.getConfiguration('importly');

  return {
    aliases:            cfg.get<string[]>('aliases',          ['@/', '~/', '#']),
    separateGroups:     cfg.get<boolean>('separateGroups',    true),
    multilineThreshold: cfg.get<number>('multilineThreshold', 3),
    quoteStyle:         cfg.get<'single' | 'double'>('quoteStyle', 'single'),
    trailingComma:      cfg.get<boolean>('trailingComma',     true),
    semicolons:         cfg.get<boolean>('semicolons',        true),
  };
}

// ---------------------------------------------------------------------------
// sortText
// ---------------------------------------------------------------------------

/**
 * Core sorting pipeline: takes raw text, returns sorted text.
 * Returns null if no imports were found.
 *
 * Pipeline:
 *   raw text
 *     → extractImportStrings  (find all import statements)
 *     → parseImportStatement  (text → ParsedImport objects)
 *     → assignGroups          (classify each import)
 *     → sortImports           (order by group + alphabetical)
 *     → formatImports         (ParsedImport objects → text)
 *     → re-attach rest of file
 */
function sortText(text: string, config: SorterConfig): string | null {
  const { preamble, imports: importStrings, rest } = extractImportStrings(text);

  // Nothing to sort
  if (importStrings.length === 0) {
    return null;
  }

  const parsed    = importStrings.map(parseImportStatement);
  const grouped   = assignGroups(parsed, config);
  const sorted    = sortImports(grouped);
  const formatted = formatImports(sorted, config);

  // Rebuild file: preamble + imports + rest
  const parts: string[] = [];

  if (preamble.trimEnd().length > 0) {
    parts.push(preamble.trimEnd());
    parts.push(''); // blank line between directive and imports
  }

  parts.push(formatted);

  const trimmedRest = rest.trimStart();
  if (trimmedRest.length > 0) {
    parts.push(''); // blank line between imports and rest of file
    parts.push(trimmedRest);
  }

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// getEdits
// ---------------------------------------------------------------------------

/**
 * Computes the VS Code text edits needed to sort the imports.
 *
 * If the editor has a non-empty selection → sort only that selection.
 * Otherwise → sort the entire file.
 *
 * Returns null if:
 *   - The file extension is not supported
 *   - No imports were found
 *   - The result is identical to the original (nothing changed)
 */
function getEdits(
  document: vscode.TextDocument,
  editor?: vscode.TextEditor,
): vscode.TextEdit[] | null {
  // Only run on supported file types
  const ext = path.extname(document.fileName);
  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    return null;
  }

  const config = getConfig();

  // ── Selection mode ────────────────────────────────────────────────────
  // If the user has text selected, sort only within that selection
  if (editor && !editor.selection.isEmpty) {
    const selectedText = document.getText(editor.selection);
    const sorted = sortText(selectedText, config);

    if (sorted === null || sorted === selectedText) {
      return null;
    }

    return [vscode.TextEdit.replace(editor.selection, sorted)];
  }

  // ── Full file mode ────────────────────────────────────────────────────
  const fullText = document.getText();
  const sorted = sortText(fullText, config);

  if (sorted === null || sorted === fullText) {
    return null;
  }

  // Replace the entire file content
  const fullRange = new vscode.Range(
    document.positionAt(0),
    document.positionAt(fullText.length),
  );

  return [vscode.TextEdit.replace(fullRange, sorted)];
}

// ---------------------------------------------------------------------------
// activate
// ---------------------------------------------------------------------------

/**
 * Called by VS Code when the extension is first activated.
 * Activation happens when the user opens a supported file (see activationEvents in package.json).
 *
 * Registers:
 *   1. The manual "Sort Imports" command (Cmd/Ctrl+Shift+Alt+S)
 *   2. The auto-sort on save listener
 */
export function activate(context: vscode.ExtensionContext): void {

  // ── Manual command ────────────────────────────────────────────────────
  // Triggered by: command palette, keyboard shortcut, or context menu
  const sortCommand = vscode.commands.registerCommand(
    'importly.sortImports',
    () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      const edits = getEdits(editor.document, editor);

      if (!edits || edits.length === 0) {
        vscode.window.showInformationMessage(
          'Importly: No imports found to sort.',
        );
        return;
      }

      // Apply the edits to the document
      editor.edit((editBuilder) => {
        for (const edit of edits) {
          editBuilder.replace(edit.range, edit.newText);
        }
      });
    },
  );

  // ── Auto-sort on save ─────────────────────────────────────────────────
  // onWillSaveTextDocument fires BEFORE the file is written to disk.
  // We pass our edits via event.waitUntil() so VS Code applies them
  // atomically as part of the save — the user sees the sorted result directly.
  const onSave = vscode.workspace.onWillSaveTextDocument((event) => {
    const sortOnSave = vscode.workspace
      .getConfiguration('importly')
      .get<boolean>('sortOnSave', true);

    if (!sortOnSave) {
      return;
    }

    const edits = getEdits(event.document);

    if (edits && edits.length > 0) {
      // waitUntil tells VS Code to apply these edits before saving
      event.waitUntil(Promise.resolve(edits));
    }
  });

  // Register both so VS Code cleans them up when the extension is deactivated
  context.subscriptions.push(sortCommand, onSave);
}

// ---------------------------------------------------------------------------
// deactivate
// ---------------------------------------------------------------------------

/**
 * Called by VS Code when the extension is deactivated.
 * Cleanup is handled automatically via context.subscriptions.
 */
export function deactivate(): void {}
