"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_languageserver_1 = require("vscode-languageserver");
class BaseTranslate {
    constructor() {
        this._onTranslate = new vscode_languageserver_1.Emitter();
        this._inRequest = new Map();
    }
    get onTranslate() {
        return this._onTranslate.event;
    }
    translate(content, { from = 'auto', to = 'auto' }) {
        return __awaiter(this, void 0, void 0, function* () {
            let key = `from[${from}]to[${to}]-${content}`;
            if (this._inRequest.has(key)) {
                let action = this._inRequest.get(key);
                return yield action;
            }
            let action = this._translate(content, { from, to });
            this._inRequest.set(key, action);
            return yield action;
        });
    }
    link(content, opts) {
        if (content || opts) { }
        return '';
    }
}
exports.BaseTranslate = BaseTranslate;
//# sourceMappingURL=translate.js.map