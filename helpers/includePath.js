"use strict";

module.exports = function (req) {
    return {
        includePath: function (path) {
            return this.rootPath + path;
        }
    }
}