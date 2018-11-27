const vscode = require('vscode');
const translate = require('node-google-translate-skidz');
const languages = require('./languages.js');

const BUY_ME_A_COFFEE = {
	name: 'Buy me a coffee ☕️',
	value: 'https://www.buymeacoffee.com/funkyremi',
};

let nbOfTranslations = 0;
const recentlyUsed = [];

function updateLanguageList(selectedLanguage) {
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
}

function getSelectedText(document, selection) {
	const charRange = new vscode.Range(
		selection.start.line,
		selection.start.character,
		selection.end.line,
		selection.end.character
	);
	return document.getText(charRange);
}

function getTranslationPromise(selectedText, selectedLanguage, selection) {
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
}

function getTranslationsPromiseArray(selections, document, selectedLanguage) {
	return selections.map(selection => {
		const selectedText = getSelectedText(document, selection);
		return getTranslationPromise(selectedText, selectedLanguage, selection);
	});
}

function activate(context) {
	let disposable = vscode.commands.registerCommand('extension.translateText', function() {
	const editor = vscode.window.activeTextEditor;
	const { document, selections } = editor;

	const quickPickData = recentlyUsed
		.map(r => ({
			name: r.name.includes('(recently used)') ? r.name : `${r.name} (recently used)`,
			value: r.value,
		}))
		.concat(languages);
	
	if (nbOfTranslations >= 3) { // Add the buy me a coffee link if user use the translator more than 3 times
		quickPickData.splice(0, 0, BUY_ME_A_COFFEE);
	}

	vscode.window.showQuickPick(quickPickData.map(l => l.name))
		.then(res => {
			if (!res) return;
			const selectedLanguage = quickPickData.find(t => t.name === res);
			if (selectedLanguage.value === BUY_ME_A_COFFEE.value) {
				vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(BUY_ME_A_COFFEE.value))
			} else {
				updateLanguageList(selectedLanguage);
				Promise.all(getTranslationsPromiseArray(selections, document, selectedLanguage))
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
