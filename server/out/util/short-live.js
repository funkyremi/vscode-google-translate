"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShortLive = void 0;
class ShortLive {
    constructor(deepEqual, timeout = 1000) {
        this.deepEqual = deepEqual;
        this.timeout = timeout;
        this._cacheList = new Map();
        this._id = 0;
    }
    add(item) {
        let id = this._id;
        this._id = id + 1;
        this._cacheList.set(id, item);
        setTimeout(() => {
            this._cacheList.delete(id);
        }, this.timeout);
    }
    isLive(data) {
        for (let item of this._cacheList.values()) {
            if (this.deepEqual(item, data)) {
                return true;
            }
        }
        return false;
    }
}
exports.ShortLive = ShortLive;
//# sourceMappingURL=short-live.js.map