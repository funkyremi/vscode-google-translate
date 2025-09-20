/* global suite, test, setup */
const assert = require('assert');
const vscode = require('vscode');

suite("Extension Command Tests", function() {
    setup(async () => {
        // Set a preferred language to avoid the quick pick menu
        await vscode.workspace.getConfiguration('vscodeGoogleTranslate').update('preferredLanguage', 'French', vscode.ConfigurationTarget.Global);
    });

    test("Should translate selected text", async () => {
        const document = await vscode.workspace.openTextDocument({ content: 'Hello World' });
        const editor = await vscode.window.showTextDocument(document);
        
        const originalText = 'Hello World';
        editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, originalText.length));

        // Give a moment for the extension to activate if it hasn't already
        await new Promise(resolve => setTimeout(resolve, 1000));

        await vscode.commands.executeCommand('extension.translateTextPreferred');

        // Add a delay to allow for the translation and edit to occur
        await new Promise(resolve => setTimeout(resolve, 2000));

        const newText = editor.document.getText();

        // We don't know the exact translation, but it should not be the original text.
        assert.notStrictEqual(newText, originalText);
        // A very basic check to see if it could be the French translation
        assert.ok(newText.toLowerCase().includes('bonjour'));
    }).timeout(5000); // Increase timeout to allow for API calls
});
