"use strict";

// @IMPORTS
var Application = require("neat-base").Application;
var Module = require("neat-base").Module;
var Tools = require("neat-base").Tools;
var redis = require("redis");
var Promise = require("bluebird");
var crypto = require('crypto');
var fs = require("fs");
var serveStatic = require("serve-static");
var i18n = require("i18n");
var beautify = require('js-beautify');
var htmlMinifier = require('html-minifier');
var path = require("path");
var ejs = require("ejs");
var querystring = require("querystring");

var stylesCssLastModifiedTime = new Date();
var templateCache = {};

module.exports = class Frontend extends Module {

    static defaultConfig() {
        return {
            locales: [
                "en"
            ],
            defaultLocale: "en",
            updateTranslationFiles: true,
            removeWhitespaces: true,
            templateCacheEnabled: false,
            webserverModuleName: "webserver",
            apiModuleName: "api",
            staticDirMaxAge: "1d",
            publicDir: "frontend/public",
            helpersRootPath: "frontend/helpers",
            templateRootPath: "frontend/templates",
            partialsRootPath: "frontend/templates/partials",
            layoutsRootPath: "frontend/templates/layouts",
            elementsRootPath: "frontend/templates/elements",
        }
    }

    init() {
        return new Promise((resolve, reject) => {
            this.log.debug("Initializing...");


            Tools.ensureFolderExists("locales", Application.config.config_path);

            i18n.configure({
                locales: this.config.locales,
                directory: Application.config.config_path + '/locales',
                defaultLocale: this.config.defaultLocale,
                updateFiles: this.config.updateTranslationFiles,
                indent: "    ",
                extension: ".json",
                objectNotation: false,
                prefix: ""
            });

            Tools.ensureFolderExists(this.config.publicDir, Application.config.root_path);
            Tools.ensureFolderExists(this.config.partialsRootPath, Application.config.root_path);
            Tools.ensureFolderExists(this.config.layoutsRootPath, Application.config.root_path);
            Tools.ensureFolderExists(this.config.elementsRootPath, Application.config.root_path);
            Tools.ensureFolderExists(this.config.templateRootPath, Application.config.root_path);
            Tools.ensureFolderExists(this.config.helpersRootPath, Application.config.root_path);

            if (Application.modules[this.config.webserverModuleName]) {
                Application.modules[this.config.webserverModuleName].addMiddleware(i18n.init);

                Application.modules[this.config.webserverModuleName].addMiddleware("/", serveStatic(Application.config.root_path + "/" + this.config.publicDir, {
                    maxAge: this.config.staticDirMaxAge
                }), 0);
                Application.modules[this.config.webserverModuleName].addRoute("get", "/*", (req, res, next) => {
                    this.handlePageRequest(req, res);
                }, 999999);

                Application.modules[this.config.webserverModuleName].addRoute("post", "/*", (req, res, next) => {
                    this.handlePageRequest(req, res);
                }, 999999);
            }

            resolve(this);
        });
    }

    start() {
        return new Promise((resolve, reject) => {
            this.log.debug("Starting...");
            return resolve(this);
        });
    }

    stop() {
        return new Promise((resolve, reject) => {
            this.log.debug("Stopping...");
            return resolve(this);
        });
    }

    handlePageRequest(req, res) {
        this.loadViewHelpers(req);
        var stats = {};
        var pageData = null;

        return Application.modules[this.config.apiModuleName].getPageJson(req).then((data) => {
            data = this.fixDataForDomains(data, req);

            var matches;

            try {
                var stringData = JSON.stringify(data);
                matches = stringData.match(/^.*?"REDIRECT_TO":"(.*?)".*?$/m);
            } catch (e) {
                this.log.error(e);
            }

            if (matches && matches[1]) {
                var err = new Error("302");
                err.redirect = matches[1];
                throw err;
                return;
            }

            if (data.stats) {
                res.header("Stats-API", data.stats.complete);
            }

            if (req.query.json) {
                return res.json(data);
            }

            if (data.status) {
                res.status(data.status);
            }

            if (data.redirect) {
                var err = new Error(String(data.status) || "302");
                err.redirect = data.redirect;
                throw err;
                return;
            }

            pageData = data;
            stats.render = Tools.measureTime();
            return this.dispatch(data, req);
        }).then((data) => {
            data = this.fixDataForDomains(data, req);

            // if we didnt render, just dont do anything render related
            if (stats.render) {
                stats.render = stats.render();

                stats.htmlProcess = Tools.measureTime();
                data = this.processHtml(data, req);
                stats.htmlProcess = stats.htmlProcess();

                res.header("Stats-Rendering", stats.render);
                res.header("Stats-HtmlMinAndCss", stats.htmlProcess);

                if (!req.clearCache) {
                    if (pageData.stats && pageData.stats.cache) {
                        res.header("Cache-Control", "max-age=" + pageData.stats.cache)
                    } else {
                        res.header("Cache-Control", "no-cache")
                    }
                } else {
                    res.header("Cache-Control", "no-cache")
                }

                res.header("Content-Type", "text/html");

                res.end(data);
            }
        }).catch((err) => {
            if (typeof err === "object" && !err instanceof Error) {
                err = this.fixDataForDomains(err, req);
            }

            if (err.redirect) {
                if (err.message == "301") {
                    err.statusCode = 301;
                } else if (err.message == "302") {
                    err.statusCode = 302;
                }

                return res.redirect(err.statusCode || 302, err.redirect);
            }

            res.err(err);
        });
    }

    processHtml(html, req) {
        if (req.isLayout) {
            return html;
        }

        if (this.config.beautify) {
            return beautify.html(html, {
                indent_size: 4,
                preserve_newlines: false
            });
        } else {
            try {
                return htmlMinifier.minify(html, {
                    removeComments: true,
                    collapseWhitespace: true,
                    preserveLineBreaks: false,
                    useShortDoctype: true,
                    removeAttributeQuotes: false,
                    removeEmptyAttributes: false,
                    minifyJS: true,
                    minifyCSS: true
                });
            } catch (e) {
                this.log.error("invalid html, couldnt minify... " + req.url);
                return html;
            }
        }
    }

    loadViewHelpers(req) {
        this.loadDefaultHelpers(req);
        Tools.ensureFolderExists(this.config.helpersRootPath, Application.config.root_path);

        var helpers = {};
        var helperFiles = fs.readdirSync(Application.config.root_path + "/" + this.config.helpersRootPath);

        for (var i = 0; i < helperFiles.length; i++) {
            var helperFile = helperFiles[i];
            var helper = require(Application.config.root_path + "/" + this.config.helpersRootPath + "/" + helperFile)(req);

            for (var name in helper) {
                helpers[name] = helper[name];
            }
        }

        for (var name in helpers) {
            req.viewHelpers[name] = helpers[name];
        }
    }

    loadDefaultHelpers(req) {
        req.viewHelpers = {
            rootPath: Application.config.root_path + "/" + this.config.templateRootPath,
            appConfigs: Application.appConfigs,
            stylesCssLastModifiedTime: stylesCssLastModifiedTime,
        };

        var helpers = {};
        var helperFiles = fs.readdirSync(__dirname + "/helpers");

        for (var i = 0; i < helperFiles.length; i++) {
            var helperFile = helperFiles[i];
            var helper = require(__dirname + "/helpers/" + helperFile)(req);

            for (var name in helper) {
                helpers[name] = helper[name];
            }
        }

        for (var name in helpers) {
            req.viewHelpers[name] = helpers[name];
        }
    }

    fixDataForDomains(data, req) {
        if (this.config.domains) {
            var isObject = false;
            if (data instanceof String) {
                // nothing to see here
            } else if (data instanceof Object || data instanceof Array) {
                isObject = true;
                data = JSON.stringify(data);
            }

            for (var rootDomain in this.config.domains) {
                data = data.replace(new RegExp(Tools.escapeForRegexp(rootDomain), "ig"), this.config.domains[rootDomain]);
            }

            if (isObject) {
                data = JSON.parse(data);
            }
        }

        return data;
    }

    dispatch(data, req) {
        return new Promise((resolve, reject) => {
            var layout = data.layout || "default";
            var partialsPath = Application.config.root_path + "/" + this.config.partialsRootPath;

            var templateData = {
                partialsPath: partialsPath
            };

            for (var key in data) {
                if (key == "data") {
                    continue;
                }

                templateData[key] = data[key];
            }

            for (var slot in data.data) {
                var slotData = data.data[slot];

                if (slot == "meta") {
                    continue;
                }

                templateData[slot] = "";

                for (var i = 0; i < slotData.length; i++) {
                    var elementData = slotData[i];

                    if (!elementData.id) {
                        elementData.id = elementData.element;
                    }

                    if (elementData.EMPTY) {
                        continue;
                    }

                    templateData[slot] += this.dispatchElement(elementData, req);
                }
            }

            var layoutTemplate = this.getLayoutTemplate(layout, req);

            if (!layoutTemplate) {
                return reject(new Error("layout missing " + layout));
            }

            resolve(layoutTemplate(templateData));
        });
    }

    getEsiForElement(elementConfig, req) {
        var src = this.config.esiUrl + new Buffer(JSON.stringify({
                page: elementConfig.page,
                element: elementConfig.element
            })).toString("base64");

        if (req.query && Object.keys(req.query).length > 0) {
            var queryStr = querystring.stringify(req.query);
            if (queryStr) {
                src += "?" + queryStr;
            }
        }

        src = this.fixDataForDomains(src, req);

        var esiTemplate = '<esi:include src="' + src + '"></esi:include>';

        return esiTemplate;
    }

    dispatchElement(elementData, req) {
        if (!elementData) {
            return "";
        }

        if (elementData.esi && !req.esi && this.config.esiEnabled && req.method === "GET") {
            return this.getEsiForElement(elementData, req);
        }

        var elementTemplate = this.getElementTemplate(elementData.id, req);

        if (!elementTemplate) {
            return "";
        }

        elementData.templatePath = this.getElementTemplatePath(elementData.id, req);

        var debugComment = `<!-- ELEMENT ${elementData.id} -->`;
        var debugEndComment = `<!-- END OF ELEMENT ${elementData.id} -->`;

        if (req.xhr || req.noComments) {
            debugComment = "";
            debugEndComment = "";
        }

        try {
            return debugComment + elementTemplate(elementData) + debugEndComment;
        } catch (e) {
            this.log.error("Template Error: (" + req.url + ") " + e.toString());
            return "";
        }
    }

    dispatchTemplate(name, tmplString, req) {
        this.loadViewHelpers(req);
        return ejs.compile(tmplString, {
            filename: "custom_" + name,
            rmWhitespace: this.config.removeWhitespaces,
            context: req.viewHelpers
        });
    }

    getLayoutTemplate(name, req) {
        var layoutsPath = Application.config.root_path + "/" + this.config.layoutsRootPath;

        return this.loadTemplate(layoutsPath + "/" + name + ".ejs", {
            filename: "layout_" + name,
            rmWhitespace: this.config.removeWhitespaces,
            context: req.viewHelpers
        });
    }

    getElementTemplatePath(id, req) {
        var parts = id.split(".");
        var path = parts.join("/");

        return path;
    }

    getElementTemplate(id, req) {
        var elementsPath = Application.config.root_path + "/" + this.config.elementsRootPath;

        return this.loadTemplate(elementsPath + "/" + this.getElementTemplatePath(id, req) + ".ejs", {
            filename: "element_" + id,
            rmWhitespace: this.config.removeWhitespaces,
            context: req.viewHelpers
        });
    }

    loadTemplate(path, options) {
        var template = null;
        options = options || {};
        options.cache = false;

        if (templateCache[path] && this.config.templateCacheEnabled) {
            template = templateCache[path];
        } else {
            try {
                template = fs.readFileSync(path);
                template = template.toString();
                templateCache[path] = template;
            } catch (e) {
                this.log.debug("Template missing " + path);
                return null;
            }
        }

        try {
            return ejs.compile(template, options);
        } catch (e) {
            this.log.error(e.toString());
            return null;
        }
    }

}