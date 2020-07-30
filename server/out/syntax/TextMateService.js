"use strict";
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
exports.TextMateService = exports.TMLanguageRegistration = exports.TMScopeRegistry = void 0;
const path = require("path");
const fs = require("fs");
const onigasm = require("onigasm");
const vscode_textmate_1 = require("vscode-textmate");
class TMScopeRegistry {
    constructor() {
        this._scopeNameToLanguageRegistration = Object.create(null);
    }
    register(scopeName, grammarLocation, embeddedLanguages, tokenTypes) {
        if (this._scopeNameToLanguageRegistration[scopeName]) {
            const existingRegistration = this._scopeNameToLanguageRegistration[scopeName];
            if (!(existingRegistration.grammarLocation === grammarLocation)) {
                // console.warn(
                //     `Overwriting grammar scope name to file mapping for scope ${scopeName}.\n` +
                //     `Old grammar file: ${existingRegistration.grammarLocation.toString()}.\n` +
                //     `New grammar file: ${grammarLocation.toString()}`
                // );
            }
        }
        this._scopeNameToLanguageRegistration[scopeName] = new TMLanguageRegistration(scopeName, grammarLocation, embeddedLanguages, tokenTypes);
    }
    getLanguageRegistration(scopeName) {
        return this._scopeNameToLanguageRegistration[scopeName] || null;
    }
    getGrammarLocation(scopeName) {
        let data = this.getLanguageRegistration(scopeName);
        return data ? data.grammarLocation : null;
    }
}
exports.TMScopeRegistry = TMScopeRegistry;
class TMLanguageRegistration {
    constructor(scopeName, grammarLocation, embeddedLanguages, tokenTypes) {
        this.scopeName = scopeName;
        this.grammarLocation = grammarLocation;
        // embeddedLanguages handling
        this.embeddedLanguages = Object.create(null);
        if (embeddedLanguages) {
            // If embeddedLanguages are configured, fill in `this._embeddedLanguages`
            let scopes = Object.keys(embeddedLanguages);
            for (let i = 0, len = scopes.length; i < len; i++) {
                let scope = scopes[i];
                let language = embeddedLanguages[scope];
                if (typeof language !== 'string') {
                    // never hurts to be too careful
                    continue;
                }
                this.embeddedLanguages[scope] = language;
            }
        }
        this.tokenTypes = Object.create(null);
        if (tokenTypes) {
            // If tokenTypes is configured, fill in `this._tokenTypes`
            const scopes = Object.keys(tokenTypes);
            for (let i = 0, len = scopes.length; i < len; i++) {
                const scope = scopes[i];
                const tokenType = tokenTypes[scope];
                switch (tokenType) {
                    case 'string':
                        this.tokenTypes[scope] = 2 /* String */;
                        break;
                    case 'other':
                        this.tokenTypes[scope] = 0 /* Other */;
                        break;
                    case 'comment':
                        this.tokenTypes[scope] = 1 /* Comment */;
                        break;
                }
            }
        }
    }
}
exports.TMLanguageRegistration = TMLanguageRegistration;
function doLoadOnigasm() {
    return __awaiter(this, void 0, void 0, function* () {
        const [wasmBytes] = yield Promise.all([
            loadOnigasmWASM()
        ]);
        // debugger;
        yield onigasm.loadWASM(wasmBytes);
        return {
            createOnigScanner(patterns) { return new onigasm.OnigScanner(patterns); },
            createOnigString(s) { return new onigasm.OnigString(s); }
        };
    });
}
function loadOnigasmWASM() {
    return __awaiter(this, void 0, void 0, function* () {
        let indexPath = require.resolve('onigasm');
        const wasmPath = path.join(indexPath, '../onigasm.wasm');
        const bytes = yield fs.promises.readFile(wasmPath);
        return bytes.buffer;
    });
}
class TextMateService {
    constructor(extensions, tmPath) {
        this._scopeRegistry = new TMScopeRegistry();
        this._injections = {};
        this._injectedEmbeddedLanguages = {};
        this._languageToScope = new Map();
        this._languages = new Map();
        console.log(tmPath);
        this._grammarRegistry = null;
        this._parseExtensions(extensions);
    }
    _parseExtensions(extensions) {
        for (let i = 0; i < extensions.length; i++) {
            let languages = extensions[i].languages || [];
            languages.forEach(language => {
                this._languages.set(language.name, language.id);
            });
            let grammars = extensions[i].value || [];
            for (let j = 0; j < grammars.length; j++) {
                this._handleGrammarExtensionPointUser(extensions[i].extensionLocation, grammars[j]);
            }
        }
    }
    _getOrCreateGrammarRegistry() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this._grammarRegistry) {
                const grammarRegistry = new vscode_textmate_1.Registry({
                    getOnigLib: doLoadOnigasm,
                    loadGrammar: (scopeName) => {
                        const location = this._scopeRegistry.getGrammarLocation(scopeName);
                        if (!location) {
                            console.log(`No grammar found for scope ${scopeName}`);
                            return null;
                        }
                        return new Promise((c, e) => {
                            fs.readFile(location, { encoding: 'utf8' }, (error, content) => {
                                if (error) {
                                    console.error(`Unable to load and parse grammar for scope ${scopeName} from ${location}`, e);
                                    e(null);
                                }
                                else {
                                    var rawGrammar = vscode_textmate_1.parseRawGrammar(content.toString(), location);
                                    c(rawGrammar);
                                }
                            });
                        });
                    },
                    getInjections: (scopeName) => {
                        return this._injections[scopeName];
                    }
                });
                this._grammarRegistry = Promise.resolve([grammarRegistry, vscode_textmate_1.INITIAL]);
            }
            return this._grammarRegistry;
        });
    }
    _handleGrammarExtensionPointUser(extensionLocation, syntax) {
        const grammarLocation = path.join(extensionLocation, syntax.path);
        if (grammarLocation.indexOf(extensionLocation) !== 0) {
            console.warn(`path error`);
        }
        this._scopeRegistry.register(syntax.scopeName, grammarLocation, syntax.embeddedLanguages, syntax.tokenTypes);
        if (syntax.injectTo) {
            for (let injectScope of syntax.injectTo) {
                let injections = this._injections[injectScope];
                if (!injections) {
                    this._injections[injectScope] = injections = [];
                }
                injections.push(syntax.scopeName);
            }
            if (syntax.embeddedLanguages) {
                for (let injectScope of syntax.injectTo) {
                    let injectedEmbeddedLanguages = this._injectedEmbeddedLanguages[injectScope];
                    if (!injectedEmbeddedLanguages) {
                        this._injectedEmbeddedLanguages[injectScope] = injectedEmbeddedLanguages = [];
                    }
                    injectedEmbeddedLanguages.push(syntax.embeddedLanguages);
                }
            }
        }
        let modeId = syntax.language;
        if (modeId) {
            this._languageToScope.set(modeId, syntax.scopeName);
        }
    }
    _resolveEmbeddedLanguages(embeddedLanguages) {
        let scopes = Object.keys(embeddedLanguages);
        let result = Object.create(null);
        for (let i = 0, len = scopes.length; i < len; i++) {
            let scope = scopes[i];
            let language = embeddedLanguages[scope];
            let languageId = this._languages.get(language);
            if (languageId) {
                result[scope] = languageId;
            }
        }
        return result;
    }
    createGrammar(modeId) {
        return __awaiter(this, void 0, void 0, function* () {
            const r = yield this._createGrammar(modeId);
            return r.grammar;
        });
    }
    _createGrammar(modeId) {
        return __awaiter(this, void 0, void 0, function* () {
            let scopeName = this._languageToScope.get(modeId);
            let languageRegistration = this._scopeRegistry.getLanguageRegistration(scopeName);
            if (!languageRegistration) {
                // No TM grammar defined
                throw new Error('No TM Grammar registered for this language.');
            }
            let embeddedLanguages = this._resolveEmbeddedLanguages(languageRegistration.embeddedLanguages);
            let rawInjectedEmbeddedLanguages = this._injectedEmbeddedLanguages[scopeName];
            if (rawInjectedEmbeddedLanguages) {
                let injectedEmbeddedLanguages = rawInjectedEmbeddedLanguages.map(this._resolveEmbeddedLanguages.bind(this));
                for (const injected of injectedEmbeddedLanguages) {
                    for (const scope of Object.keys(injected)) {
                        embeddedLanguages[scope] = injected[scope];
                    }
                }
            }
            let languageId = this._languages.get(modeId);
            let containsEmbeddedLanguages = (Object.keys(embeddedLanguages).length > 0);
            let _res = yield this._getOrCreateGrammarRegistry();
            const [grammarRegistry, initialState] = _res;
            const grammar = yield grammarRegistry.loadGrammarWithConfiguration(scopeName, languageId, { embeddedLanguages, tokenTypes: languageRegistration.tokenTypes });
            return {
                languageId: languageId,
                grammar: grammar,
                initialState: initialState,
                containsEmbeddedLanguages: containsEmbeddedLanguages
            };
        });
    }
}
exports.TextMateService = TextMateService;
//# sourceMappingURL=TextMateService.js.map