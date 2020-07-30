import { TextDocumentPositionParams, Hover, TextDocuments, Connection, TextDocument } from "vscode-languageserver";
import * as humanizeString from 'humanize-string';
import { CommentParse, ICommentOption, ICommentBlock } from "./syntax/CommentParse";
import { TextMateService } from "./syntax/TextMateService";
import translate from "google-translate-open-api";
import * as languages from "../../languages"


export interface ICommentTranslateSettings {
    multiLineMerge: boolean;
    concise: boolean;
    preferredLanguage: string;
}

export class Comment {

    private _textMateService: TextMateService;
    private _setting: ICommentTranslateSettings;
    private _commentParseCache: Map<string, CommentParse> = new Map();

    constructor(extensions: ICommentOption, private _documents: TextDocuments, private _connection: Connection) {
        this._setting = { multiLineMerge: false, preferredLanguage: extensions.userLanguage,concise: false};
        this._textMateService = new TextMateService(extensions.grammarExtensions, extensions.appRoot);
        //关闭文档或内容变更，移除缓存
        _documents.onDidClose(e => this._removeCommentParse(e.document));
        _documents.onDidChangeContent(e => this._removeCommentParse(e.document))
    }

    setSetting(newSetting: ICommentTranslateSettings) {
        if (!newSetting.preferredLanguage) {
            newSetting.preferredLanguage = this._setting.preferredLanguage;
        }
        this._setting = Object.assign(this._setting, newSetting);
        this._setting.preferredLanguage = languages.find(element => element.name === this._setting.preferredLanguage).value

    }

    async translate(text: string) {
        let translationConfiguration = {
            to: this._setting.preferredLanguage,
        };
        return await translate(text, translationConfiguration).then(res => {
            if (!!res && !!res.data) {
                  return res.data[0];
            } else {
              return "Google Translate API Error";
            }
          });
    } 
    /**
     * Returns user settings proxy config
     *
     * @returns {string}
     */

    private async _getSelectionContainPosition(textDocumentPosition: TextDocumentPositionParams): Promise<ICommentBlock> {
        let block = await this._connection.sendRequest<ICommentBlock>('selectionContains', textDocumentPosition);
        return block;
    }

    _removeCommentParse(textDocument: TextDocument) {
        let key = `${textDocument.languageId}-${textDocument.uri}`;
        this._commentParseCache.delete(key);
    }

    async _getCommentParse(textDocument: TextDocument) {
        let key = `${textDocument.languageId}-${textDocument.uri}`;
        if (this._commentParseCache.has(key)) {
            return this._commentParseCache.get(key);
        }
        let grammar = await this._textMateService.createGrammar(textDocument.languageId);
        let parse: CommentParse = new CommentParse(textDocument, grammar, this._setting.multiLineMerge);
        this._commentParseCache.set(key, parse);
        return parse;
    }

    async getComment(textDocumentPosition: TextDocumentPositionParams): Promise<Hover> {
        let textDocument = this._documents.get(textDocumentPosition.textDocument.uri);
        if (!textDocument) return null;
        let parse = await this._getCommentParse(textDocument);
        let block = await this._getSelectionContainPosition(textDocumentPosition);
        if (!block) {
            block = await parse.computeText(textDocumentPosition.position, this._setting.concise);
        }
        if (block) {
            if (block.humanize) {
                let humanize = humanizeString(block.comment);
                let targetLanguageComment = await this.translate(humanize);
                return {
                    contents: [humanize + ' => ' + targetLanguageComment], range: block.range
                };
            } else {
                let targetLanguageComment = await this.translate(block.comment);
                return {
                    contents: [targetLanguageComment],
                    range: block.range
                };
            }

        }
        return null;
    }
}