const fs = require('fs');

exports.default = function (cb) {
    console.log('Use the following commands to keep this directory in sync');
    console.log('with your OsmDocs account:');
    console.log();
    console.log('    gulp push - upload all local file changes to OsmDocs account');
    console.log('    gulp watch - watch this directory and upload changes to OsmDocs');
    console.log('                 account immediately as they happen.');
    console.log('    gulp pull - download all file changes from OsmDocs account to');
    console.log('                 this directory.');
    cb();
};

exports.pull = function(cb) {
    cb();
};

exports.push = function (cb) {
    cb();
};

exports.watch = function () {
};

let config;

function getConfig() {
    if (!config) {
        config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
    }

    return config;
}