/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import {
	createConnection,
	TextDocuments,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	Hover,
	TextDocumentPositionParams,
} from 'vscode-languageserver';

import { Comment } from './Comment';
import { patchAsarRequire } from './util/patch-asar-require';
import { ShortLive } from './util/short-live';

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager. The text document manager
// supports full document sync only
const documents: TextDocuments = new TextDocuments();

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let comment: Comment;

connection.onInitialize((params: InitializeParams) => {
	const capabilities = params.capabilities;
	comment = new Comment(params.initializationOptions, documents, connection);
	patchAsarRequire(params.initializationOptions.appRoot);
	// Does the client support the `workspace/configuration` request?
	// If not, we will fall back using global settings
	hasConfigurationCapability = capabilities.workspace && !!capabilities.workspace.configuration;
	hasWorkspaceFolderCapability = capabilities.workspace && !!capabilities.workspace.workspaceFolders;

	return {
		capabilities: {
			hoverProvider: true,
			definitionProvider: true,
			textDocumentSync: documents.syncKind,
		}
	};
});

connection.onInitialized(async () => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(
			DidChangeConfigurationNotification.type,
			undefined
		);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}

	comment.setSetting(await connection.workspace.getConfiguration('vscodeGoogleTranslate'));
});

// The settings are pulled from the main JS extension
connection.onDidChangeConfiguration(async () => {
	comment.setSetting(await connection.workspace.getConfiguration('vscodeGoogleTranslate'));
});

const shortLive = new ShortLive((item: TextDocumentPositionParams, data: TextDocumentPositionParams) => {
	if (item.textDocument.uri === data.textDocument.uri) {
		return true;
	}
	return false;
});

const last: Map<string, Hover> = new Map();

connection.onHover(async (textDocumentPosition) => {
	if (!comment) return null;
	const hover = await comment.getComment(textDocumentPosition);
	hover && last.set(textDocumentPosition.textDocument.uri, hover);
	return hover;
});

connection.onDefinition(async (definitionParams) => {
	shortLive.add(definitionParams);
	return null;
});

connection.onRequest('lastHover', ({ uri }) => {
	return last.get(uri);
});

connection.onRequest('translate', (text: string) => {
	if (!comment) return null;
	return comment.translate(text);
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
