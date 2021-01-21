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
        },

        __e: function () {
            try {
                let translation = req.__.apply(req, arguments);
                if (translation && typeof translation === "string") {
                    translation = translation.replace(/'/ig, "\\'");
                }
                return translation;
            } catch (e) {
                console.error(arguments);
                console.error(e);
                console.error(e.stack);
            }
        },

        getLocale: function () {
            try {
                return req.getLocale.apply(req, arguments);
            } catch (e) {
                console.error(arguments);
                console.error(e);
                console.error(e.stack);
            }
        },

        getLocales: function () {
            try {
                return req.getLocales.apply(req, arguments);
            } catch (e) {
                console.error(arguments);
                console.error(e);
                console.error(e.stack);
            }
        }

    }
};