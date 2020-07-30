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
exports.Comment = void 0;
const humanizeString = require("humanize-string");
const CommentParse_1 = require("./syntax/CommentParse");
const TextMateService_1 = require("./syntax/TextMateService");
const google_translate_open_api_1 = require("google-translate-open-api");
class Comment {
    constructor(extensions, _documents, _connection) {
        this._documents = _documents;
        this._connection = _connection;
        this._commentParseCache = new Map();
        this._setting = { multiLineMerge: false, targetLanguage: extensions.userLanguage, concise: false };
        this._textMateService = new TextMateService_1.TextMateService(extensions.grammarExtensions, extensions.appRoot);
        //关闭文档或内容变更，移除缓存
        _documents.onDidClose(e => this._removeCommentParse(e.document));
        _documents.onDidChangeContent(e => this._removeCommentParse(e.document));
    }
    setSetting(newSetting) {
        if (!newSetting.targetLanguage) {
            newSetting.targetLanguage = this._setting.targetLanguage;
        }
        this._setting = Object.assign(this._setting, newSetting);
    }
    translate(text) {
        return __awaiter(this, void 0, void 0, function* () {
            let translationConfiguration = {
                to: this._setting.targetLanguage,
            };
            return yield google_translate_open_api_1.default(text, translationConfiguration).then(res => {
                if (!!res && !!res.data) {
                    return res.data[0];
                }
                else {
                    return "Google Translate API Error";
                }
            });
        });
    }
    /**
     * Returns user settings proxy config
     *
     * @returns {string}
     */
    _getSelectionContainPosition(textDocumentPosition) {
        return __awaiter(this, void 0, void 0, function* () {
            let block = yield this._connection.sendRequest('selectionContains', textDocumentPosition);
            return block;
        });
    }
    _removeCommentParse(textDocument) {
        let key = `${textDocument.languageId}-${textDocument.uri}`;
        this._commentParseCache.delete(key);
    }
    //缓存已匹配部分，加快hover运行时间
    _getCommentParse(textDocument) {
        return __awaiter(this, void 0, void 0, function* () {
            let key = `${textDocument.languageId}-${textDocument.uri}`;
            if (this._commentParseCache.has(key)) {
                return this._commentParseCache.get(key);
            }
            let grammar = yield this._textMateService.createGrammar(textDocument.languageId);
            let parse = new CommentParse_1.CommentParse(textDocument, grammar, this._setting.multiLineMerge);
            this._commentParseCache.set(key, parse);
            return parse;
        });
    }
    getComment(textDocumentPosition) {
        return __awaiter(this, void 0, void 0, function* () {
            let textDocument = this._documents.get(textDocumentPosition.textDocument.uri);
            if (!textDocument)
                return null;
            let parse = yield this._getCommentParse(textDocument);
            //优先判断是hover坐标是否为选中区域。 优先翻译选择区域
            let block = yield this._getSelectionContainPosition(textDocumentPosition);
            if (!block) {
                block = yield parse.computeText(textDocumentPosition.position, this._setting.concise);
            }
            if (block) {
                if (block.humanize) {
                    //转换为可以自然语言分割
                    let humanize = humanizeString(block.comment);
                    let targetLanguageComment = yield this.translate(humanize);
                    return {
                        contents: [humanize + ' => ' + targetLanguageComment], range: block.range
                    };
                }
                else {
                    let targetLanguageComment = yield this.translate(block.comment);
                    return {
                        contents: [targetLanguageComment],
                        range: block.range
                    };
                }
            }
            return null;
        });
    }
}
exports.Comment = Comment;
//# sourceMappingURL=Comment.js.map