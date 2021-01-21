"use strict";

module.exports = function () {
    return {
        escape: function (str) {
            if (str && typeof str === "string") {
                str = str.replace(/'/ig, "\\'");
            }
            return str;
        }
    }
};