
'use strict';


var _ = require('lodash'),
    escapeHtml = require('escape-html');

var fs = require('fs')
  , path = require('path')
  , normalize = path.normalize
  , sep = path.sep
  , extname = path.extname
  , join = path.join;

/*!
 * Icon cache.
 */

var cache = {};


/*!
 * Stylesheet.
 */

var defaultStylesheet = fs.readFileSync(join(__dirname, '../public/style.css'), 'utf8');

module.exports = {
    templatesPath: {
        directory: join(__dirname, '../public/directory.html'),
        info : join(__dirname, '../public/info.html')
    },
    templates: {
        directory: null,
        info: null
    },
    renderDirectory: function(params, res){
        if(!this.templates.directory){
            var str = fs.readFileSync(this.templatesPath.directory, 'utf8');
            this.templates.directory = _.template(str);
        }
        // create locals for rendering
        var locals = {
            style: defaultStylesheet.concat(iconStyle(['drive','box','folder'], true)),
            files: createHtmlFileList(params.fileList, params.title, true, params.view),
            directory: escapeHtml(params.title),
            backpath: params.backpath,
            backname: params.backname
        };
        var buf = new Buffer(this.templates.directory(locals), 'utf8');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Content-Length', buf.length);
        res.end(buf);
    },
    renderInfo: function(params, res){
        if(!this.templates.info){
            var str = fs.readFileSync(this.templatesPath.info, 'utf8');
            this.templates.info = _.template(str);
        }
        var locals = {
            style: defaultStylesheet.concat(iconStyle(['box'], true)),
            name: params.name,
            size: (params.stat.size/1024).toFixed(2) + 'Kb',
            create_time: params.stat.birthtime.toLocaleString(),
            last_modified_time: params.stat.mtime.toLocaleString(),
            download_url: params.download_url
        }
        var buf = new Buffer(this.templates.info(locals), 'utf8');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Content-Length', buf.length);
        res.end(buf);
    }
};

/**
 * Map html `files`, returning an html unordered list.
 * @private
 */

function createHtmlFileList(files, dir, useIcons, view) {
  var html = '<ul id="files" class="view-' + escapeHtml(view) + '">'
    + (view == 'details' ? (
      '<li class="header">'
      + '<span class="name">Name</span>'
      + '<span class="size">Size</span>'
      + '<span class="date">Modified</span>'
      + '</li>') : '');

  html += files.map(function (file) {
    var classes = [];
    var isDir = file.stat && file.stat.isDirectory();
    var path = dir.split('/').map(function (c) { return encodeURIComponent(c); });

    if (useIcons) {
      classes.push('icon');
      classes.push('icon-' + file.icon);
    }

    path.push(encodeURIComponent(file.name));

    var date = file.stat && file.name !== '..'
      ? file.stat.mtime.toLocaleTimeString() + ' ' + file.stat.mtime.toLocaleDateString()
      : '';

    var size = file.stat && file.stat.size ? file.stat.size : '';
    return '<li><a href="'
      + escapeHtml(normalizeSlashes(normalize(path.join('/'))))
      + '" class="' + escapeHtml(classes.join(' ')) + '"'
      + ' title="' + escapeHtml(file.name) + '">'
      + '<span class="name">' + escapeHtml(file.name) + '</span>'
      + '<span class="size">' + escapeHtml(size) + '</span>'
      + '<span class="date">' + escapeHtml(date) + '</span>'
      + '</a></li>';
  }).join('\n');

  html += '</ul>';

  return html;
}


/**
 * Sort function for with directories first.
 */

function fileSort(a, b) {
  // sort ".." to the top
  if (a.name === '..' || b.name === '..') {
    return a.name === b.name ? 0
      : a.name === '..' ? -1 : 1;
  }

  return Number(b.stat && b.stat.isDirectory()) - Number(a.stat && a.stat.isDirectory()) ||
    String(a.name).toLocaleLowerCase().localeCompare(String(b.name).toLocaleLowerCase());
}


/**
 * Load icon images, return css string.
 */

function iconStyle(iconNames, useIcons) {
  if (!useIcons) return '';
  var className;
  var i;
  var iconName;
  var list = [];
  var rules = {};
  var selector;
  var selectors = {};
  var style = '';

  for (i = 0; i < iconNames.length; i++) {
    iconName = iconNames[i];
    selector = '#files .' + 'icon-' + iconName + ' .name';

    if (!rules[iconName]) {
      rules[iconName] = 'background-image: url(data:image/png;base64,' + load(iconName) + ');'
      selectors[iconName] = [];
      list.push(iconName);
    }

    if (selectors[iconName].indexOf(selector) === -1) {
      selectors[iconName].push(selector);
    }
  }

  for (i = 0; i < list.length; i++) {
    iconName = list[i];
    style += selectors[iconName].join(',\n') + ' {\n  ' + rules[iconName] + '\n}\n';
  }

  return style;
}

/**
 * Load and cache the given `icon`.
 *
 * @param {String} icon
 * @return {String}
 * @api private
 */

function load(icon) {
  if (cache[icon]) return cache[icon];
  return cache[icon] = fs.readFileSync(path.join(__dirname, '../public/icons/' + icon + '.png'), 'base64');
}

/**
 * Normalizes the path separator from system separator
 * to URL separator, aka `/`.
 *
 * @param {String} path
 * @return {String}
 * @api private
 */

function normalizeSlashes(path) {
  return path.split(sep).join('/');
};
