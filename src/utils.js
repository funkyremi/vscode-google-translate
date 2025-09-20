const vscode = require('vscode');
const languages = require('../languages.js');

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

module.exports = {
    recentlyUsed,
    updateLanguageList,
    getSelectedText,
    getSelectedLineText,
    getPreferredLanguage,
    setPreferredLanguage,
    getProxyConfig
}
