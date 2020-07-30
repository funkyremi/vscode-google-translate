"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasEndMark = exports.isLowerCase = exports.isUpperCase = void 0;
function isUpperCase(ch) {
    return ch >= 'A' && ch <= 'Z';
}
exports.isUpperCase = isUpperCase;
function isLowerCase(ch) {
    return ch >= 'a' && ch <= 'z';
}
exports.isLowerCase = isLowerCase;
function hasEndMark(ch) {
    let lastLineEndCharacter = ch.substring(ch.length - 1);
    return lastLineEndCharacter !== '.';
}
exports.hasEndMark = hasEndMark;
//# sourceMappingURL=string.js.map