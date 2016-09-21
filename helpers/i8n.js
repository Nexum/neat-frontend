"use strict";

module.exports = function (req) {
    return {

        __: function () {
            try {
                return req.__.apply(req, arguments);
            } catch (e) {
                console.error(arguments);
                console.error(e);
                console.error(e.stack);
            }
        },

        __n: function () {
            try {
                return req.__n.apply(req, arguments);
            } catch (e) {
                console.error(arguments);
                console.error(e);
                console.error(e.stack);
            }
        }

    }
};