"use strict";

var moment = require("moment");
require("moment-duration-format");
var Promise = require("bluebird");

module.exports = function (req) {
    return {
        moment: function (date, format) {
            return moment(date, format).locale(req.getLocale());
        },

        duration: function (duration, unit) {
            return moment.duration(duration, unit);
        }
    }
}