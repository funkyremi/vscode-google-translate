"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.patchAsarRequire = void 0;
function patchAsarRequire(appRoot) {
    const path = require('path');
    const Module = require('module');
    const NODE_MODULES_PATH = path.join(`${appRoot}/node_modules`);
    const NODE_MODULES_ASAR_PATH = NODE_MODULES_PATH + '.asar';
    const originalResolveLookupPaths = Module._resolveLookupPaths;
    Module._resolveLookupPaths = function (request, parent, newReturn) {
        const result = originalResolveLookupPaths(request, parent, newReturn);
        const paths = newReturn ? result : result[1];
        for (let i = 0, len = paths.length; i < len; i++) {
            if (paths[i] === NODE_MODULES_PATH) {
                paths.splice(i, 0, NODE_MODULES_ASAR_PATH);
                break;
            }
        }
        return result;
    };
}
exports.patchAsarRequire = patchAsarRequire;
//# sourceMappingURL=patch-asar-require.js.map