const vscode = require("vscode");
const translate = require("google-translate-query");
const languages = require("./languages.js");

const recentlyUsed = [];

function updateLanguageList(selectedLanguage) {
  if (recentlyUsed.find(r => r.value === selectedLanguage.value)) {
    // Remove the recently used language from the list
    const index = recentlyUsed.findIndex(
      r => r.value === selectedLanguage.value
    );
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

/**
 * Gets the first line from active selection as a Range
 *
 * @param {vscode.TextDocument} document
 * @param {vscode.Selection} selection
 * @returns {vscode.Range}
 */
function getSelectedLineText(document, selection) {
  return document.getText(
    document.lineAt(selection.start.line).rangeIncludingLineBreak
  );
}

function getTranslationPromise(selectedText, selectedLanguage, selection) {
  return new Promise((resolve, reject) => {
    translate(selectedText, { to: selectedLanguage })
      .then(res => {
        if (!!res && !!res.text) {
          resolve({
            selection,
            translation: res.text
          });
        } else {
          reject(new Error("Google Translation API issue"));
        }
      })
      .catch(e => {
        reject(new Error("Google Translation API issue", e));
      });
  });
}

function getTranslationsPromiseArray(selections, document, selectedLanguage) {
  return selections.map(selection => {
    const selectedText = getSelectedText(document, selection);
    return getTranslationPromise(selectedText, selectedLanguage, selection);
  });
}

/**
 * Gets arrays of Translation Promises based on the first lines under the cursor.
 *
 * @param {vscode.Selection} selections
 * @param {vscode.TextDocument} document
 * @param {string} selectedLanguage
 * @returns {Array.<Promise>}
 */
function getTranslationsPromiseArrayLine(
  selections,
  document,
  selectedLanguage
) {
  return selections.map(selection => {
    const selectedLineText = getSelectedLineText(document, selection);
    return getTranslationPromise(selectedLineText, selectedLanguage, selection);
  });
}

function getPreferredLanguage() {
  return vscode.workspace
    .getConfiguration("vscodeGoogleTranslate")
    .get("preferredLanguage");
}

function activate(context) {
  let translateText = vscode.commands.registerCommand(
    "extension.translateText",
    function() {
      const editor = vscode.window.activeTextEditor;
      const { document, selections } = editor;

      const quickPickData = recentlyUsed
        .map(r => ({
          name: r.name.includes("(recently used)")
            ? r.name
            : `${r.name} (recently used)`,
          value: r.value
        }))
        .concat(languages);

      vscode.window
        .showQuickPick(quickPickData.map(l => l.name))
        .then(res => {
          if (!res) return;
          const selectedLanguage = quickPickData.find(t => t.name === res);
          updateLanguageList(selectedLanguage);
          const translationsPromiseArray = getTranslationsPromiseArray(
            selections,
            document,
            selectedLanguage.value
          );
          Promise.all(translationsPromiseArray)
            .then(function(results) {
              editor.edit(builder => {
                results.forEach(r => {
                  if (!!r.translation) {
                    builder.replace(r.selection, r.translation);
                  }
                });
              });
            })
            .catch(e => vscode.window.showErrorMessage(e));
        })
        .catch(err => {
          vscode.window.showErrorMessage(err);
        });
    }
  );
  context.subscriptions.push(translateText);

  let translateTextPreferred = vscode.commands.registerCommand(
    "extension.translateTextPreferred",
    function() {
      const editor = vscode.window.activeTextEditor;
      const { document, selections } = editor;

      // vscodeTranslate.preferredLanguage
      let locale = getPreferredLanguage();
      if (!locale) {
        return;
      }

      const translationsPromiseArray = getTranslationsPromiseArray(
        selections,
        document,
        locale
      );
      Promise.all(translationsPromiseArray)
        .then(function(results) {
          editor.edit(builder => {
            results.forEach(r => {
              if (!!r.translation) {
                builder.replace(r.selection, r.translation);
              }
            });
          });
        })
        .catch(e => vscode.window.showErrorMessage(e));
    }
  );
  context.subscriptions.push(translateTextPreferred);

  let translateLinesUnderCursor = vscode.commands.registerCommand(
    'extension.translateLinesUnderCursor',
    function translateLinesUnderCursorcallback() {
      const editor = vscode.window.activeTextEditor;
      const { document, selections } = editor;

      const quickPickData = recentlyUsed
      .map(r => ({
        name: r.name.includes("(recently used)")
          ? r.name
          : `${r.name} (recently used)`,
        value: r.value
      }))
      .concat(languages);

      vscode.window
        .showQuickPick(quickPickData.map(l => l.name))
        .then(res => {
          if (!res) return;
          const selectedLanguage = quickPickData.find(t => t.name === res);
          updateLanguageList(selectedLanguage);
          const translationsPromiseArray = getTranslationsPromiseArrayLine(
            selections,
            document,
            selectedLanguage.value
          );
          Promise.all(translationsPromiseArray)
            .then(function(results) {
              editor.edit(builder => {
                results.forEach(r => {
                  if (!!r.translation) {
                    const ffix = ['', '\n'];
                    if (editor.document.lineCount - 1 === r.selection.start.line)
                      [ffix[0], ffix[1]] = [ffix[1], ffix[0]];
                    const p = new vscode.Position(r.selection.start.line + 1);
                    builder.insert(p, `${ffix[0]}${r.translation}${ffix[1]}`);
                  }
                });
              });
            })
          .catch(e => vscode.window.showErrorMessage(e));
        })
        .catch(err => {
          vscode.window.showErrorMessage(err);
        });
    }
  );

  context.subscriptions.push(translateLinesUnderCursor);

  let translateLinesUnderCursorPreferred = vscode.commands.registerCommand(
    'extension.translateLinesUnderCursorPreferred',
    function translateLinesUnderCursorPreferredcallback() {
      const editor = vscode.window.activeTextEditor;
      const { document, selections } = editor;
      let locale = getPreferredLanguage();
      if (!locale) {
        vscode.window.showWarningMessage(
          'Prefered language is requeried for this feature! Please set this in the settings.'
          );
        return;
      }

      const translationsPromiseArray = getTranslationsPromiseArrayLine(
        selections,
        document,
        locale
      );

      Promise.all(translationsPromiseArray)
        .then(function(results) {
          editor.edit(builder => {
            results.forEach(r => {
              if (!!r.translation) {
                const ffix = ['', '\n'];
                if (editor.document.lineCount - 1 === r.selection.start.line)
                  [ffix[0], ffix[1]] = [ffix[1], ffix[0]];
                const p = new vscode.Position(r.selection.start.line + 1);
                builder.insert(p, `${ffix[0]}${r.translation}${ffix[1]}`);
              }
            });
          });
        })
        .catch(e => vscode.window.showErrorMessage(e));
    }
  );

  context.subscriptions.push(translateLinesUnderCursorPreferred);
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {}
exports.deactivate = deactivate;
