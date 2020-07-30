/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_languageserver_1 = require("vscode-languageserver");
const Comment_1 = require("./Comment");
const patch_asar_require_1 = require("./util/patch-asar-require");
const short_live_1 = require("./util/short-live");
// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = vscode_languageserver_1.createConnection(vscode_languageserver_1.ProposedFeatures.all);
// Create a simple text document manager. The text document manager
// supports full document sync only
let documents = new vscode_languageserver_1.TextDocuments();
let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let comment;
let concise = false;
connection.onInitialize((params) => {
    let capabilities = params.capabilities;
    comment = new Comment_1.Comment(params.initializationOptions, documents, connection);
    patch_asar_require_1.patchAsarRequire(params.initializationOptions.appRoot);
    // Does the client support the `workspace/configuration` request?
    // If not, we will fall back using global settings
    hasConfigurationCapability =
        capabilities.workspace && !!capabilities.workspace.configuration;
    hasWorkspaceFolderCapability =
        capabilities.workspace && !!capabilities.workspace.workspaceFolders;
    return {
        capabilities: {
            hoverProvider: true,
            definitionProvider: true,
            textDocumentSync: documents.syncKind,
        }
    };
});
connection.onInitialized(() => __awaiter(void 0, void 0, void 0, function* () {
    if (hasConfigurationCapability) {
        // Register for all configuration changes.
        connection.client.register(vscode_languageserver_1.DidChangeConfigurationNotification.type, undefined);
    }
    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders(_event => {
            connection.console.log('Workspace folder change event received.');
        });
    }
    let setting = yield connection.workspace.getConfiguration('vscodeGoogleTranslate');
    concise = setting.concise;
    comment.setSetting(setting);
}));
// The example settings
connection.onDidChangeConfiguration(() => __awaiter(void 0, void 0, void 0, function* () {
    let setting = yield connection.workspace.getConfiguration('vscodeGoogleTranslate');
    concise = setting.concise;
    comment.setSetting(setting);
}));
// Only keep settings for open documents
// documents.onDidClose(e => {
// 	documentSettings.delete(e.document.uri);
// });
let shortLive = new short_live_1.ShortLive((item, data) => {
    if (item.textDocument.uri === data.textDocument.uri) {
        return true;
    }
    return false;
});
// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
let last = new Map();
connection.onHover((textDocumentPosition) => __awaiter(void 0, void 0, void 0, function* () {
    if (!comment)
        return null;
    if (concise && !shortLive.isLive(textDocumentPosition))
        return null;
    let hover = yield comment.getComment(textDocumentPosition);
    hover && last.set(textDocumentPosition.textDocument.uri, hover);
    return hover;
}));
connection.onDefinition((definitionParams) => __awaiter(void 0, void 0, void 0, function* () {
    shortLive.add(definitionParams);
    return null;
}));
connection.onRequest('lastHover', ({ uri }) => {
    return last.get(uri);
});
connection.onRequest('translate', (text) => {
    if (!comment)
        return null;
    return comment.translate(text);
});
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);
// Listen on the connection
connection.listen();
//# sourceMappingURL=server.js.map