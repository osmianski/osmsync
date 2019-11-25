const through = require('through2');

function FileList() {
    this.paths = [];
}

FileList.prototype.add = function () {
    let self = this;
    return through.obj(function (file, enc, cb) {
        if (file.isBuffer()) {
            self.paths.push(file.relative.replace(/\\/g, '/'));
        }
        this.push(file);
        return cb();
    });
};

FileList.prototype.notIn = function () {
    let self = this;
    return through.obj(function (file, enc, cb) {
        if (file.isBuffer() &&
            self.paths.indexOf(file.relative.replace(/\\/g, '/')) == -1)
        {
            this.push(file);
        }
        return cb();
    });
};

module.exports = FileList;