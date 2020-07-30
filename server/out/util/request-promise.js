"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const request = require("request");
function default_1(uri, options) {
    return new Promise((resolve, reject) => {
        request(uri, options, (error, response) => {
            if (error)
                return reject(error);
            if (response.statusCode !== 200)
                return reject(response.statusMessage);
            resolve(response.body);
        });
    });
}
exports.default = default_1;
//# sourceMappingURL=request-promise.js.map