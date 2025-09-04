const vscode = require('vscode');
const he = require("he");
const languages = require('../languages.js');
const {
    recentlyUsed,
    updateLanguageList,
    getSelectedText,
    getSelectedLineText,
    getPreferredLanguage,
    setPreferredLanguage,
} = require('./utils');
const { getTranslationPromise } = require('./translate');

function getTranslationsPromiseArray(selections, document, selectedLanguage) {
    return selections.map((selection) => {
      const selectedText = getSelectedText(document, selection);
      return getTranslationPromise(selectedText, selectedLanguage, selection);
    });
  }
  
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

function initializeCommands(context) {
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
}

module.exports = { initializeCommands };
