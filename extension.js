const vscode = require('vscode');
const translate = require('node-google-translate-skidz');
const languages = require('./languages.js');

const BUY_ME_A_COFFEE = {
	name: 'Buy me a coffee ☕️',
	value: 'Buy me a coffee ☕️',
	link: 'https://www.buymeacoffee.com/funkyremi',
};

let nbOfTranslations = 0;
const recentlyUsed = [];

function activate(context) {
	let disposable = vscode.commands.registerCommand('extension.translateText', function() {
	const editor = vscode.window.activeTextEditor;
	const { document, selections } = editor;

	const newLanguagesArray = recentlyUsed.concat(languages);
	// Add the buy me a coffee link if user use the translator more than 3 times
	if (nbOfTranslations >= 3) {
		newLanguagesArray.splice(0, 0, BUY_ME_A_COFFEE);
	}

	vscode.window.showQuickPick(newLanguagesArray.map(l => l.name))
		.then(res => {
			if (!res) return;
			const selectedLanguage = newLanguagesArray.find(t => t.name === res);
			if (selectedLanguage.value === BUY_ME_A_COFFEE.value) {
				// Buy me a coffee
				vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(BUY_ME_A_COFFEE.link))
			} else {
				if (recentlyUsed.find(r => r.value === selectedLanguage.value)) {
					// Remove the recently used language from the list
					const index = recentlyUsed.findIndex(r => r.value === selectedLanguage.value);
					recentlyUsed.splice(index, 1);
				}
				if (languages.find(r => r.value === selectedLanguage.value)) {
					// Remove the recently used language from languages list
					const index = languages.findIndex(r => r.value === selectedLanguage.value);
					languages.splice(index, 1);
				}
				// Add the language in recently used languages
				recentlyUsed.splice(0, 0, selectedLanguage);

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
							target: selectedLanguage.value,
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
						nbOfTranslations += 1;
						editor.edit(builder => {
							results.forEach(r => {
								if (!!r.translation) {
									builder.replace(r.selection, r.translation);
								}
							})
						});
					});
			}
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
