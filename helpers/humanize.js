"use strict";

var humanize = require("humanize");
var zpad = require("zpad");
var Promise = require("bluebird");
var Moment = require("moment");
var truncate = require("html-truncate");
var utf8 = require("utf8");
module.exports = function (req) {
    return {
        numberFormat: function (val, decimals) {
            decimals = decimals || 0;

            return humanize.numberFormat(val, decimals, ",", ".")
        },

        numberPadding: function (value, padding) {
            padding = padding || 2;

            return zpad(value, padding);
        },

        shorten: function (text, length) {
            if (!text) {
                return text;
            }

            text = String(text);

            if (text.length > length) {
                text = truncate(text, length, {ellipsis: '…'});
            }

            return text;
        },

        decode: function (text) {
            if (!text) {
                return text;
            }

            text = utf8.decode(text);

            return text;
        }
    }
};