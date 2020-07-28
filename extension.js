const vscode = require("vscode");
const languages = require("./languages.js");
const translate = require("google-translate-open-api").default;
const he = require("he");

/**
 * @typedef TranslateRes
 * @property {vscode.Selection} selection Selection
 * @property {string} translation Result
 */

/**
 * The list of recently used languages
 *
 * @type {Array.<string>}
 */
const recentlyUsed = [];

/**
 * Updates languages lists for the convenience of users
 *
 * @param {string} selectedLanguage The language code to update
 * @returns {undefined}
 */
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

/**
 * Extracts a text from the active document selection
 *
 * @param {vscode.TextDocument} document The current document
 * @param {vscode.Selection} selection The current selection
 * @returns {string} A text
 */
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
 * Gets a text of the first line from active selection
 *
 * @param {vscode.TextDocument} document The current document
 * @param {vscode.Selection} selection The current selection
 * @returns {string}
 */
function getSelectedLineText(document, selection) {
  return document.getText(
    document.lineAt(selection.start.line).rangeIncludingLineBreak
  );
}

/**
 * Translates the selectedText to the selectedLanguage like a Promise
 *
 * @param {string} selectedText Text
 * @param {string} selectedLanguage Language
 * @param {vscode.Selection} selection Selection
 * @returns {Promise.<TranslateRes>}
 */
function getTranslationPromise(selectedText, selectedLanguage, selection) {
  return new Promise((resolve, reject) => {
    const { host, port, username, password } = getProxyConfig();
    const translationConfiguration = {
      to: selectedLanguage,
    };
    if (!!host) {
      translationConfiguration.proxy = {
        host,
        port: Number(port),
      }
      if (!!username) {
        translationConfiguration.proxy.auth = {
          username,
          password,
        }
      }
    }
    translate(selectedText, translationConfiguration)
      .then(res => {
        if (!!res && !!res.data) {
          resolve(
            /** @type {TranslateRes} */ {
              selection,
              translation: res.data[0]
            }
          );
        } else {
          reject(new Error("Google Translation API issue"));
        }
      })
      .catch(e =>
        reject(new Error("Google Translation API issue: " + e.message))
      );
  });
}

/**
 * Generates the array of promises based on selections
 *
 * @param {Array.<vscode.Selection>} selections Array of selections
 * @param {vscode.TextDocument} document The current document
 * @param {string} selectedLanguage The current language
 * @returns {Array.<Promise<TranslateRes>>}
 */
function getTranslationsPromiseArray(selections, document, selectedLanguage) {
  return selections.map(selection => {
    const selectedText = getSelectedText(document, selection);
    return getTranslationPromise(selectedText, selectedLanguage, selection);
  });
}

/**
 * Gets arrays of Translation Promises based on the first lines under the cursor.
 *
 * @param {vscode.Selection} selections The current selection
 * @param {vscode.TextDocument} document The current document
 * @param {string} selectedLanguage
 * @returns {Array.<Promise<TranslateRes>>}
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

/**
 * Returns user settings Preferred language
 *
 * @returns {string}
 */
function getPreferredLanguage() {
  return vscode.workspace
    .getConfiguration("vscodeGoogleTranslate")
    .get("preferredLanguage");
}

/**
 * Returns user settings proxy config
 *
 * @returns {string}
 */
function getProxyConfig() {
  const config = vscode.workspace.getConfiguration("vscodeGoogleTranslate");
  return {
    host: config.get("proxyHost"),
    port: config.get("proxyPort"),
    username: config.get("proxyUsername"),
    password: config.get("proxyPassword"),
  }
}

/**
 * Platform binding function
 *
 * @param {vscode.ExtensionContext} context
 * @returns {undefined} There is no an API public surface now (7/3/2019)
 */
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
                    builder.replace(r.selection, he.decode(r.translation));
                  }
                });
              });
            })
            .catch(e => vscode.window.showErrorMessage(e.message));
        })
        .catch(err => {
          vscode.window.showErrorMessage(err.message);
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
      let locale = languages.find(element => element.name === getPreferredLanguage()).value;
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
                builder.replace(r.selection, he.decode(r.translation));
              }
            });
          });
        })
        .catch(e => vscode.window.showErrorMessage(e.message));
    }
  );
  context.subscriptions.push(translateTextPreferred);

  let translateLinesUnderCursor = vscode.commands.registerCommand(
    "extension.translateLinesUnderCursor",
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
                    const ffix = ["", "\n"];
                    if (
                      editor.document.lineCount - 1 ===
                      r.selection.start.line
                    )
                      [ffix[0], ffix[1]] = [ffix[1], ffix[0]];
                    const p = new vscode.Position(r.selection.start.line + 1);
                    builder.insert(p, `${ffix[0]}${r.translation}${ffix[1]}`);
                  }
                });
              });
            })
            .catch(e => vscode.window.showErrorMessage(e.message));
        })
        .catch(err => {
          vscode.window.showErrorMessage(err.message);
        });
    }
  );

  context.subscriptions.push(translateLinesUnderCursor);

  let translateLinesUnderCursorPreferred = vscode.commands.registerCommand(
    "extension.translateLinesUnderCursorPreferred",
    function translateLinesUnderCursorPreferredcallback() {
      const editor = vscode.window.activeTextEditor;
      const { document, selections } = editor;
      let locale = languages.find(element => element.name === getPreferredLanguage()).value;
      if (!locale) {
        vscode.window.showWarningMessage(
          "Prefered language is requeried for this feature! Please set this in the settings."
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
                const ffix = ["", "\n"];
                if (editor.document.lineCount - 1 === r.selection.start.line)
                  [ffix[0], ffix[1]] = [ffix[1], ffix[0]];
                const p = new vscode.Position(r.selection.start.line + 1);
                builder.insert(p, `${ffix[0]}${r.translation}${ffix[1]}`);
              }
            });
          });
        })
        .catch(e => vscode.window.showErrorMessage(e.message));
    }
  );

  context.subscriptions.push(translateLinesUnderCursorPreferred);
}
exports.activate = activate;

/**
 * Platform binding function
 * this method is called when your extension is deactivated
 *
 * @param {vscode.ExtensionContext} context
 * @returns {undefined} There is no an API public surface now (7/3/2019)
 */
function deactivate() {}
exports.deactivate = deactivate;
