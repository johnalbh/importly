import * as path from 'path';
import { runTests } from '@vscode/test-electron';

/**
 * Entry point for the test runner.
 * Launches a VS Code instance, installs the extension, and runs the test suite.
 */
async function main(): Promise<void> {
  try {
    // The folder containing the extension's package.json
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');

    // The path to the test suite
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    await runTests({ extensionDevelopmentPath, extensionTestsPath });
  } catch (err) {
    console.error('Failed to run tests:', err);
    process.exit(1);
  }
}

main();
