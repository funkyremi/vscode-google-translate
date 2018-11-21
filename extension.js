const vscode = require('vscode');
const translate = require('node-google-translate-skidz');
const languages = require('./languages.js');

function activate(context) {
	let disposable = vscode.commands.registerCommand('extension.translateText', function() {
	const editor = vscode.window.activeTextEditor;
	const { document, selection } = editor;
	const charRange = new vscode.Range(
		selection.start.line,
		selection.start.character,
		selection.end.line,
		selection.end.character
	);
	const selectedText = document.getText(charRange);

	if (selectedText.length > 0) {
		vscode.window.showQuickPick(languages.map(l => l.name))
			.then(res => {
				if (!res) return;
				const { value } = languages.find(t => t.name === res);
				translate({
					text: selectedText,
					source: 'auto',
					target: value
				}, (result) => {
					if (!!result && !!result.translation) {
						editor.edit(builder => {
							builder.replace(selection, result.translation);
						});
					} else {
						vscode.window.showErrorMessage('Google Translate API issue');
					}
				});
			})
			.catch(err => {
				vscode.window.showErrorMessage(err);
			});
		} else {
			vscode.window.showErrorMessage('No text selected');
		}
	});
	context.subscriptions.push(disposable);
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {
}
exports.deactivate = deactivate;
