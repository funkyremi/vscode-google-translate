const vscode = require('vscode');
const translate = require('node-google-translate-skidz');
const languages = require('./languages.js');

function activate(context) {
	let disposable = vscode.commands.registerCommand('extension.translateText', function() {
	const editor = vscode.window.activeTextEditor;
	const { document, selections } = editor;
	
	vscode.window.showQuickPick(languages.map(l => l.name))
		.then(res => {
			if (!res) return;
			const { value } = languages.find(t => t.name === res);
			const promiseResult = selections.map(selection => {
				const charRange = new vscode.Range(
					selection.start.line,
					selection.start.character,
					selection.end.line,
					selection.end.character
				);
				const selectedText = document.getText(charRange);
				return new Promise((resolve, reject) => {
					translate({
						text: selectedText,
						source: 'auto',
						target: value
					}, result => {
						if (!!result && !!result.translation) {
							resolve({
								selection,
								translation: result.translation,
							})
						} else {
							reject(new Error('Google Translation API issue'));
						}
					});
				});
			});
			Promise.all(promiseResult)
				.then(function(results) {
					editor.edit(builder => {
						results.forEach(r => {
							if (!!r.translation) {
								builder.replace(r.selection, r.translation);
							}
						})
					});
				});
		})
		.catch(err => {
			vscode.window.showErrorMessage(err);
		});

	});
	context.subscriptions.push(disposable);
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {
}
exports.deactivate = deactivate;
