"use strict";

var Promise = require("bluebird");

module.exports = function (req) {
    return {

        jsConfig: function (obj) {
            return JSON.stringify(obj);
        }

    }
};