"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommentParse = void 0;
const vscode_languageserver_1 = require("vscode-languageserver");
const string_1 = require("../util/string");
class CommentParse {
    constructor(textDocument, _grammar, _multiLineMerge = false) {
        this._grammar = _grammar;
        this._multiLineMerge = _multiLineMerge;
        this._lines = [];
        this._model = textDocument.getText().split('\n');
    }
    //跨行元素合并
    _mergeComment(oldComment, newLine) {
        if (this._multiLineMerge) {
            let lastLine = oldComment.substring(oldComment.lastIndexOf('\n') + 1);
            lastLine = lastLine.replace(/^([\/\ \*])*/, '');
            let currentLine = newLine.replace(/^([\/\ \*])*/, '');
            if (string_1.isUpperCase(lastLine) && string_1.hasEndMark(lastLine) && string_1.isLowerCase(currentLine)) {
                return oldComment + ' ' + currentLine;
            }
        }
        return oldComment + '\n' + newLine;
    }
    _parseTokensToLine(lineNumber) {
        let state = null;
        let lineLength = this._lines.length;
        if (lineLength) {
            state = this._lines[lineLength - 1].endState;
        }
        //重编译过的地方
        for (let i = lineLength; i <= lineNumber; i++) {
            let tokenizationResult = this._grammar.tokenizeLine(this._model[i], state);
            this._lines.push({
                startState: state,
                tokens1: tokenizationResult.tokens,
                endState: tokenizationResult.ruleStack
            });
            state = tokenizationResult.ruleStack;
        }
        return this._lines;
    }
    _getTokensAtLine(lineNumber) {
        this._parseTokensToLine(lineNumber);
        return this._lines[lineNumber];
    }
    _parseScopesText(tokens, line, tokenIndex) {
        let tokenStartIndex = tokens[tokenIndex].startIndex;
        let tokenEndIndex = tokens[tokenIndex].endIndex;
        let tokenText = this._model[line].substring(tokenStartIndex, tokenEndIndex);
        let scopes = [];
        for (let i = tokens[tokenIndex].scopes.length - 1; i >= 0; i--) {
            scopes.push(escape(tokens[tokenIndex].scopes[i]));
        }
        return {
            tokenStartIndex,
            tokenEndIndex,
            tokenText,
            scopes
        };
    }
    multiScope({ positionLine, dataTokens1, token1Index }, checkContentHandle, maxLine, minLine, skipContentHandle) {
        let { tokenStartIndex, tokenEndIndex, tokenText } = this._parseScopesText(dataTokens1, positionLine, token1Index);
        let startLine = positionLine;
        let endLine = positionLine;
        //合并当前坐标之前的相连同类节点 before
        for (let line = positionLine, tokens1 = dataTokens1, tokenIndex = token1Index; line >= minLine;) {
            let index;
            for (index = tokenIndex - 1; index >= 0; index -= 1) {
                let res = this._parseScopesText(tokens1, line, index);
                if (skipContentHandle && skipContentHandle(res.scopes[0])) {
                    continue;
                }
                if (checkContentHandle(res.scopes)) {
                    tokenText = res.tokenText + tokenText;
                    tokenStartIndex = res.tokenStartIndex;
                    startLine = line;
                }
                else {
                    break;
                }
            }
            if (index >= 0) {
                break;
            }
            line -= 1;
            if (line >= minLine) {
                let data1 = this._getTokensAtLine(line);
                tokens1 = data1.tokens1;
                tokenIndex = tokens1.length;
                tokenText = '\n' + tokenText;
            }
        }
        //合并当前坐标之后的相连同类节点 after
        for (let line = positionLine, tokens1 = dataTokens1, tokenIndex = token1Index; line <= maxLine;) {
            let index;
            for (index = tokenIndex + 1; index < tokens1.length; index += 1) {
                let res = this._parseScopesText(tokens1, line, index);
                if (skipContentHandle && skipContentHandle(res.scopes[0])) {
                    continue;
                }
                if (checkContentHandle(res.scopes)) {
                    tokenText = tokenText + res.tokenText;
                    tokenEndIndex = res.tokenEndIndex;
                    endLine = line;
                }
                else {
                    break;
                }
            }
            if (index < tokens1.length) {
                break;
            }
            line += 1;
            if (line <= maxLine) {
                let data1 = this._getTokensAtLine(line);
                tokens1 = data1.tokens1;
                tokenIndex = -1;
                tokenText = tokenText + '\n';
            }
        }
        let newText = '';
        tokenText.split('\n').forEach(item => {
            newText = this._mergeComment(newText, item);
        });
        let range = vscode_languageserver_1.Range.create({
            line: startLine,
            character: tokenStartIndex
        }, {
            line: endLine,
            character: tokenEndIndex
        });
        return {
            comment: newText,
            range: range
        };
    }
    computeText(position, fullToken = false) {
        function isCommentTranslate(scopes) {
            //评论的token标记
            let arr = [
                'punctuation.definition.comment',
                'comment.block',
                'comment.line'
            ];
            return scopes.some(scope => {
                return arr.some(item => {
                    return scope.indexOf(item) === 0;
                });
            });
        }
        function skipCommentTranslate(scope) {
            return scope.indexOf('punctuation.whitespace.comment') === 0;
        }
        function isStringTranslate(scopes) {
            let scope = scopes[0];
            //字符串和转义字符的token标记
            let arr = [
                'string.quoted',
                'constant.character.escape'
            ];
            return arr.some(item => {
                return scope.indexOf(item) === 0;
            });
        }
        function isBaseTranslate(scopes) {
            let scope = scopes[0];
            let arr = [
                'entity',
                'variable',
                'support',
                // Object表达式支持
                'meta.object-literal.key'
            ];
            return arr.some(item => {
                return scope.indexOf(item) === 0;
            });
        }
        let data = this._getTokensAtLine(position.line);
        let token1Index = 0;
        //定位起始位置标记
        for (let i = data.tokens1.length - 1; i >= 0; i--) {
            let t = data.tokens1[i];
            if (position.character - 1 >= t.startIndex) {
                token1Index = i;
                break;
            }
        }
        let { tokenStartIndex, tokenEndIndex, tokenText, scopes } = this._parseScopesText(data.tokens1, position.line, token1Index);
        //字符串中包含 \n 等， 需要在当前行，合并连续token
        if (scopes && isStringTranslate(scopes)) {
            return this.multiScope({
                positionLine: position.line,
                dataTokens1: data.tokens1,
                token1Index
            }, isStringTranslate, position.line, position.line);
        }
        //评论会跨越多行，需要在多行中合并连续评论token
        if (scopes && isCommentTranslate(scopes)) {
            return this.multiScope({
                positionLine: position.line,
                dataTokens1: data.tokens1,
                token1Index
            }, isCommentTranslate, this._model.length - 1, 0, skipCommentTranslate);
        }
        //基础变量，只需要1个token
        if (scopes && (fullToken || isBaseTranslate(scopes))) {
            let range = vscode_languageserver_1.Range.create({
                line: position.line,
                character: tokenStartIndex
            }, {
                line: position.line,
                character: tokenEndIndex
            });
            return {
                humanize: true,
                comment: tokenText,
                range: range
            };
        }
        return null;
    }
}
exports.CommentParse = CommentParse;
//# sourceMappingURL=CommentParse.js.map