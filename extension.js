const vscode = require("vscode");
const languages = require("./languages.js");
const gti = require("@vitalets/google-translate-api");
const tunnel = require('tunnel');
const he = require("he");
const path = require("path");
const vscodeLanguageClient = require("vscode-languageclient");
const humanizeString = require("humanize-string");
const camelcase = require("camelcase");

function translate(text, options) {
  const gotopts = {};
  if (options && options.proxy) {
    const proxy = {
      host: options.proxy.host,
      port: options.proxy.port,
      headers: {
        "User-Agent": "Node",
      },
    };
    if (options.proxy.auth) {
      proxy.proxyAuth = `${options.proxy.auth.username}:${options.proxy.auth.password}`;
    }

    gotopts.agent = tunnel.httpsOverHttp({
      proxy: proxy,
    });
  }
  return gti(text, options, gotopts).then((res) => {
    res.data = [res.text];
    return res;
  });
}

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

let client = null;

/**
 * Updates languages lists for the convenience of users
 *
 * @param {string} selectedLanguage The language code to update
 * @returns {undefined}
 */
function updateLanguageList(selectedLanguage) {
  const index = recentlyUsed.findIndex((r) => r === selectedLanguage);
  if (index !== -1) {
    // Remove the recently used language from the list
    recentlyUsed.splice(index, 1);
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
      };
      if (!!username) {
        translationConfiguration.proxy.auth = {
          username,
          password,
        };
      }
    }
    translate(selectedText, translationConfiguration)
      .then((res) => {
        if (!!res && !!res.data) {
          // If google rejects the string it will return the same string as input
          // We can try to split the string into parts, then translate again. Then return it to a
          // camel style casing
          if (res.data[0] === selectedText) {
            translate(
              humanizeString(selectedText),
              translationConfiguration
            ).then((res) => {
              if (!!res && !!res.data) {
                resolve(
                  /** @type {TranslateRes} */ {
                    selection,
                    translation: camelcase(res.data[0]),
                  }
                );
              } else {
                reject(new Error("Google Translation API issue"));
              }
            });
          } else {
            resolve(
              /** @type {TranslateRes} */ {
                selection,
                translation: res.data[0],
              }
            );
          }
        } else {
          reject(new Error("Google Translation API issue"));
        }
      })
      .catch((e) =>
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
  return selections.map((selection) => {
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
  return selections.map((selection) => {
    const selectedLineText = getSelectedLineText(document, selection);
    return getTranslationPromise(selectedLineText, selectedLanguage, selection);
  });
}

/**
 * Returns user settings Preferred language.
 * If user hasn't set preferred lang. Prompt to set.
 */
function getPreferredLanguage() {
  return (
    vscode.workspace
      .getConfiguration("vscodeGoogleTranslate")
      .get("preferredLanguage") || setPreferredLanguage()
  );
}

async function setPreferredLanguage() {
  const quickPickData = recentlyUsed
    .map((r) => ({
      label: r,
      description: "(recently used)",
    }))
    .concat(languages.map((r) => ({ label: r.name })));

  const selectedLanguage = await vscode.window.showQuickPick(quickPickData);
  if (!selectedLanguage) {
    return;
  }
  vscode.workspace
    .getConfiguration()
    .update(
      "vscodeGoogleTranslate.preferredLanguage",
      selectedLanguage.label,
      vscode.ConfigurationTarget.Global
    );
  return selectedLanguage.label;
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
  };
}

/**
 * Platform binding function
 *
 * @param {vscode.ExtensionContext} context
 * @returns {undefined} There is no an API public surface now (7/3/2019)
 */
async function activate(context) {
  const translateText = vscode.commands.registerCommand(
    "extension.translateText",
    function () {
      const editor = vscode.window.activeTextEditor;
      const { document, selections } = editor;

      const quickPickData = recentlyUsed
        .map((r) => ({
          label: r,
          description: "(recently used)",
        }))
        .concat(languages.map((r) => ({ label: r.name })));

      vscode.window
        .showQuickPick(quickPickData)
        .then((selectedLanguage) => {
          if (!selectedLanguage) return;
          updateLanguageList(selectedLanguage.label);
          const translationsPromiseArray = getTranslationsPromiseArray(
            selections,
            document,
            languages.find((r) => r.name === selectedLanguage.label).value
          );
          Promise.all(translationsPromiseArray)
            .then(function (results) {
              editor.edit((builder) => {
                results.forEach((r) => {
                  if (!!r.translation) {
                    builder.replace(r.selection, he.decode(r.translation));
                  }
                });
              });
            })
            .catch((e) => vscode.window.showErrorMessage(e.message));
        })
        .catch((err) => {
          vscode.window.showErrorMessage(err.message);
        });
    }
  );
  context.subscriptions.push(translateText);

  const setPreferredLanguageFnc = vscode.commands.registerCommand(
    "extension.setPreferredLanguage",
    setPreferredLanguage
  );
  context.subscriptions.push(setPreferredLanguageFnc);

  const translateTextPreferred = vscode.commands.registerCommand(
    "extension.translateTextPreferred",
    async function () {
      const editor = vscode.window.activeTextEditor;
      const { document, selections } = editor;

      // vscodeTranslate.preferredLanguage
      const preferredLanguage = await getPreferredLanguage();
      const locale = languages.find(
        (element) => element.name === preferredLanguage
      ).value;
      if (!locale) {
        return;
      }

      const translationsPromiseArray = getTranslationsPromiseArray(
        selections,
        document,
        locale
      );
      Promise.all(translationsPromiseArray)
        .then(function (results) {
          editor.edit((builder) => {
            results.forEach((r) => {
              if (!!r.translation) {
                builder.replace(r.selection, he.decode(r.translation));
              }
            });
          });
        })
        .catch((e) => vscode.window.showErrorMessage(e.message));
    }
  );
  context.subscriptions.push(translateTextPreferred);

  const translateLinesUnderCursor = vscode.commands.registerCommand(
    "extension.translateLinesUnderCursor",
    function translateLinesUnderCursorcallback() {
      const editor = vscode.window.activeTextEditor;
      const { document, selections } = editor;

      const quickPickData = recentlyUsed
        .map((r) => ({
          label: r.name,
          description: "(recently used)",
        }))
        .concat(languages.map((r) => ({ label: r.name })));

      vscode.window
        .showQuickPick(quickPickData)
        .then((selectedLanguage) => {
          if (!selectedLanguage) return;
          updateLanguageList(selectedLanguage.label);
          const translationsPromiseArray = getTranslationsPromiseArrayLine(
            selections,
            document,
            languages.find((r) => r.name === selectedLanguage.label).value
          );
          Promise.all(translationsPromiseArray)
            .then(function (results) {
              editor.edit((builder) => {
                results.forEach((r) => {
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
            .catch((e) => vscode.window.showErrorMessage(e.message));
        })
        .catch((err) => {
          vscode.window.showErrorMessage(err.message);
        });
    }
  );

  context.subscriptions.push(translateLinesUnderCursor);

  const translateLinesUnderCursorPreferred = vscode.commands.registerCommand(
    "extension.translateLinesUnderCursorPreferred",
    async function translateLinesUnderCursorPreferredcallback() {
      const editor = vscode.window.activeTextEditor;
      const { document, selections } = editor;
      const preferredLanguage = await getPreferredLanguage();
      const locale = languages.find(
        (element) => element.name === preferredLanguage
      ).value;
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
        .then(function (results) {
          editor.edit((builder) => {
            results.forEach((r) => {
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
        .catch((e) => vscode.window.showErrorMessage(e.message));
    }
  );
  context.subscriptions.push(translateLinesUnderCursorPreferred);

  // Don't initialize the server if it's not wanted
  if (
    !vscode.workspace
      .getConfiguration("vscodeGoogleTranslate")
      .get("HoverTranslations")
  ) {
    return;
  }

  // All Below code initializes the Comment Hovering Translation feature
  let serverModule = context.asAbsolutePath(
    path.join("server", "out", "server.js")
  );
  // The debug options for the server
  // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
  let debugOptions = { execArgv: ["--nolazy", "--inspect=16009"] };
  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  let serverOptions = {
    run: {
      module: serverModule,
      transport: vscodeLanguageClient.TransportKind.ipc,
    },
    debug: {
      module: serverModule,
      transport: vscodeLanguageClient.TransportKind.ipc,
      options: debugOptions,
    },
  };
  let extAll = vscode.extensions.all;
  let languageId = 2;
  let grammarExtensions = [];
  let canLanguages = [];
  extAll.forEach((extension) => {
    if (
      !(
        extension.packageJSON.contributes &&
        extension.packageJSON.contributes.grammars
      )
    )
      return;
    let languages = [];
    (
      (extension.packageJSON.contributes &&
        extension.packageJSON.contributes.languages) ||
      []
    ).forEach((language) => {
      languages.push({
        id: languageId++,
        name: language.id,
      });
    });
    grammarExtensions.push({
      languages: languages,
      value:
        extension.packageJSON.contributes &&
        extension.packageJSON.contributes.grammars,
      extensionLocation: extension.extensionPath,
    });
    canLanguages = canLanguages.concat(
      extension.packageJSON.contributes.grammars.map((g) => g.language)
    );
  });
  let BlackLanguage = ["log", "Log"];
  let userLanguage = vscode.env.language;
  // Options to control the language client
  let clientOptions = {
    // Register the server for plain text documents
    revealOutputChannelOn: 4,
    initializationOptions: {
      grammarExtensions,
      appRoot: vscode.env.appRoot,
      userLanguage,
    },
    documentSelector: canLanguages
      .filter((v) => v)
      .filter((v) => BlackLanguage.indexOf(v) < 0),
  };
  // Create the language client and start the client.
  client = new vscodeLanguageClient.LanguageClient(
    "CommentTranslate",
    "Comment Translate",
    serverOptions,
    clientOptions
  );
  // Start the client. This will also launch the server
  client.start();
  await client.onReady();
  client.onRequest("selectionContains", (textDocumentPosition) => {
    let editor = vscode.window.activeTextEditor;
    if (
      editor &&
      editor.document.uri.toString() === textDocumentPosition.textDocument.uri
    ) {
      let position = new vscode.Position(
        textDocumentPosition.position.line,
        textDocumentPosition.position.character
      );
      let selection = editor.selections.find((selection) => {
        return !selection.isEmpty && selection.contains(position);
      });
      if (selection) {
        return {
          range: selection,
          comment: editor.document.getText(selection),
        };
      }
    }
    return null;
  });
}
exports.activate = activate;

/**
 * Platform binding function
 * this method is called when your extension is deactivated
 *
 * @param {vscode.ExtensionContext} context
 * @returns {undefined} There is no an API public surface now (7/3/2019)
 */
function deactivate() {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
exports.deactivate = deactivate;
