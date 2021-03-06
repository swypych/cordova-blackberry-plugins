/*
 *  Copyright 2011 Research In Motion Limited.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var utils = require('./utils'),
    wrench = require('wrench'),
    path = require('path'),
    _c = require('./conf'),
    jWorkflow = require("jWorkflow"),
    fs = require('fs');

function copyFile(src, dst) {
    var fileBuffer = fs.readFileSync(src);
    fs.writeFileSync(dst, fileBuffer);
}

function _done(error) {
    if (error === undefined || error === null) {
        utils.displayOutput("Lint SUCCESS");
    } else {
        utils.displayOutput("Lint FAILED");
        process.exit(error);
    }
}

function _lintJS() {
    var options = ["--reporter", "scripts/reporter.js"],
        files = ["."];

    return utils.execCommandWithJWorkflow(path.join(path.dirname(__dirname), 'node_modules', 'jshint', 'bin', 'jshint') + ' ' + files.concat(options).join(' '), {cwd: _c.TEMP});
}

function _lintCPP() {
    var returnValue = function (prev, baton) {},
        options = ["--R", "--filter=-whitespace/line_length,-whitespace/comments,-whitespace/labels,-whitespace/braces,-readability/streams"],
        files = ["plugin"],
        blacklist = ["com.blackberry.jpps"];
    //Only cpplint on unix. Windows currently has an issue with cpplinting
    if (!utils.isWindows()) {
        //This will expand files into an array of arrays and then reduce into a single array
        files = files.map(function (filePath) {
            //readdirSync only returns a list of fileNames, they will need to have the original path appended to them
            return fs.readdirSync(filePath).map(function (childPath) {
                var returnPath = path.join(filePath, childPath);
                //Check child entries to see if they have been blacklisted, if so exclude
                if (blacklist.indexOf(childPath) === -1) {
                    //Ignore all file children (THIS COULD BITE US IN THE BUTT IF THEY ARE CPP FILES)
                    if (utils.isDirectory(returnPath)) {
                        return returnPath;
                    }
                }
            }).filter(function (string) {
                return string && string.length !== 0;
            });
        }).reduce(function (previous, current) {
            return previous.concat(current);
        });
        returnValue = utils.execCommandWithJWorkflow('python ' + __dirname + "/../dependencies/cpplint/cpplint.py " + options.concat(files).join(' '));
    }

    return returnValue;
}

module.exports = function (files, complete) {
    utils.copyFolder(path.join(_c.ROOT, "plugin"), path.join(_c.TEMP, "plugin"));
    utils.copyFolder(path.join(_c.ROOT, "scripts"), path.join(_c.TEMP, "scripts"));
    utils.copyFolder(path.join(_c.ROOT, "test/unit"), path.join(_c.TEMP, "test/unit"));
    copyFile(path.join(_c.ROOT, ".jshintignore"), path.join(_c.TEMP, ".jshintignore"));
    copyFile(path.join(_c.ROOT, ".jshintrc"), path.join(_c.TEMP, ".jshintrc"));

    jWorkflow.order()
        .andThen(_lintJS())
        .andThen(_lintCPP())
        .start(function (code) {
            wrench.rmdirSyncRecursive(_c.TEMP, true);
            _done(code);
            complete();
        });
};
