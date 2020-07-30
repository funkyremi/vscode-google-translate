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
const translate_1 = require("./translate");
const request_promise_1 = require("../util/request-promise");
const querystring = require('querystring');
const GoogleToken = require('@vitalets/google-translate-token');
//免费API https://github.com/Selection-Translator/translation.js/tree/master/src
class GoogleTranslate extends translate_1.BaseTranslate {
    constructor() {
        super(...arguments);
        this._requestErrorTime = 0;
    }
    _request(content, { from = 'auto', to = 'auto' }) {
        return __awaiter(this, void 0, void 0, function* () {
            let tld = 'cn';
            let token = yield GoogleToken.get(content, { tld });
            let url = 'https://translate.google.' + tld + '/translate_a/single';
            let data = {
                client: 'gtx',
                sl: from,
                tl: to,
                hl: to,
                dt: ['at', 'bd', 'ex', 'ld', 'md', 'qca', 'rw', 'rm', 'ss', 't'],
                ie: 'UTF-8',
                oe: 'UTF-8',
                otf: 1,
                ssel: 0,
                tsel: 0,
                kc: 7,
                q: content
            };
            data[token.name] = token.value;
            url = url + '?' + querystring.stringify(data);
            let res = yield request_promise_1.default(url, {
                json: true, timeout: 10000, headers: {
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.102 Safari/537.36'
                }
            });
            let sentences = res[0];
            if (!sentences || !(sentences instanceof Array)) {
                return '';
            }
            let result = sentences
                .map(([trans]) => {
                if (trans) {
                    return trans.replace(/((\/|\*|-) )/g, '$2');
                }
            })
                .join('');
            return result;
        });
    }
    link(content, { to = 'auto' }) {
        // [fix] 参数变化zh-cn -> zh-CN。
        let [first, last] = to.split('-');
        if (last) {
            last = last.toLocaleUpperCase();
            to = `${first}-${last}`;
        }
        let str = `https://translate.google.cn/#view=home&op=translate&sl=auto&tl=${to}&text=${encodeURIComponent(content)}`;
        return `[Google](${encodeURI(str)})`;
        // return `<a href="${encodeURI(str)}">Google</a>`;
    }
    _translate(content, opts) {
        return __awaiter(this, void 0, void 0, function* () {
            let result = '';
            // 上一次失败的时间间隔小于5分钟，直接返回空
            if (Date.now() - this._requestErrorTime <= 5 * 60 * 1000) {
                return result;
            }
            try {
                result = yield this._request(content, opts);
                this._onTranslate.fire(`[Google Translate]:\n${content}\n[<============================>]:\n${result}\n`);
            }
            catch (e) {
                this._requestErrorTime = Date.now();
                this._onTranslate.fire(`[Google Translate]: request error\n ${JSON.stringify(e)} \n Try again in 5 minutes.`);
            }
            return result;
        });
    }
}
exports.GoogleTranslate = GoogleTranslate;
//# sourceMappingURL=GoogleTranslate.js.map