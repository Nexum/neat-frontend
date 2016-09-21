"use strict";

var i18n = require("i18n");
var Promise = require("bluebird");

function escape(html) {
    return String(html)
        .replace(/&(?!\w+;)/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
};

module.exports = function (req) {
    return {
        nl2br: function (val) {
            val = escape(val);
            return val.replace(/\n/g, "<br>");
        }
    }
};