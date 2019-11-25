const path = require('path');
const fs = require('fs');
const through = require('through2');
const { Client } = require('ssh2');

function Sftp(mapping) {
    this.mapping = mapping;
}

Sftp.prototype.getLocalPath = function() {
    let result = this.mapping.localPath;
    return result.endsWith('/') || result.endsWith(path.sep)
        ? result.substr(0, result.length - 1)
        : result;
};

Sftp.prototype.getRemotePath = function () {
    let result = this.mapping.remotePath;
    return result.endsWith('/')
        ? result.substr(0, result.length - 1)
        : result;
};

Sftp.prototype.do = function(cb) {
    let self = this;

    if (!this.client) {
        this.client = new Client();
        this.client.on('error', function (err) {
            throw err;
        });
        this.client.on('close', function () {
            self.client = null;
        });

        if (!this.mapping.remote.password) {
            if (!this.mapping.remote.privateKey) {
                let key = this.mapping.remote.key || '~/.ssh/id_rsa';
                delete this.mapping.remote.key;

                if (key.startsWith('~/')) {
                    let home = process.env.HOME || process.env.USERPROFILE;
                    key = path.resolve(home, key.substr(2));
                }

                this.mapping.remote.privateKey = fs.readFileSync(key);
            }

        }

        this.client.connect(this.mapping.remote);
    }

    if (this.sftp) {
        cb();
        return;
    }

    this.client.on('ready', function () {
        self.client.sftp(function (err, sftp) {
            if (err) throw err;
            self.sftp = sftp;
            cb();
        });
    });
};

Sftp.prototype.close = function(cb) {
    let self = this;

    if (this.client) {
        if (this.sftp) {
            self.client.end();
            self.client = null;
            cb();
            return;
        }

        this.client.on('ready', function () {
            self.client.end();
            self.client = null;
            cb();
        });
        return;
    }

    cb();
};

Sftp.prototype.upload = function () {
    let self = this;

    return through.obj(function (file, enc, cb) {
        if (!file.isBuffer()) {
            this.push(file);
            return cb();
        }

        self.do(function() {
            let filePath = file.relative.replace(/\\/g, '/');
            let remotePath = `${self.getRemotePath()}/${filePath}`;

            self.createDirFor(remotePath, function(err) {
                if (err) throw err;

                self.sftp.fastPut(file.path, remotePath, function (err) {
                    if (err) throw err;
                    console.log(`${filePath} uploaded`);
                    cb();
                });
            });

        });
    });
};

Sftp.prototype.createDirFor = function(filePath, cb) {
    let self = this;

    this.do(function() {
        let pos = filePath.lastIndexOf('/');
        if (pos == -1 || pos == 0) {
            cb();
            return;
        }

        filePath = filePath.substr(0, pos);

        self.sftp.exists(filePath, function(exists) {
            if (exists) {
                cb();
                return;
            }

            self.createDirFor(filePath, function (err) {
                if (err) throw err;

                self.sftp.mkdir(filePath, cb);
            });
        });
    });
};

Sftp.prototype.each = function(fileFunc, cb) {
    this.eachIn(this.getRemotePath(), fileFunc, cb);
};

Sftp.prototype.eachIn = function(filePath, fileFunc, cb) {
    let self = this;

    this.do(function () {
        self.sftp.readdir(filePath, function(err, list) {
            if (err) throw err;

            self.eachEntry(filePath, list, fileFunc, cb);
        });
    });
};

Sftp.prototype.eachEntry = function (dirPath, list, fileFunc, cb) {
    let self = this;

    let remotePath = this.getRemotePath();

    if (!list.length) {
        cb();
        return;
    }

    let fileInfo = list.shift();
    if (fileInfo.filename.startsWith('.')) {
        self.eachEntry(dirPath, list, fileFunc, cb);
        return;
    }

    let filePath = dirPath + '/' + fileInfo.filename;

    if (fileInfo.attrs.isDirectory()) {
        self.eachIn(filePath, fileFunc, function () {
            self.eachEntry(dirPath, list, fileFunc, cb);
        });
    }
    else if (fileInfo.attrs.isFile()) {
        fileFunc(filePath.substr(remotePath.length + 1), function() {
            self.eachEntry(dirPath, list, fileFunc, cb);
        });
    }
    else {
        self.eachEntry(dirPath, list, fileFunc, cb);
    }
};

Sftp.prototype.delete = function(filePath, cb) {
    let self = this;

    this.do(function () {
        let remotePath = `${self.getRemotePath()}/${filePath}`;

        self.sftp.unlink(remotePath, function(err) {
            if (err) throw err;

            console.log(`${filePath} deleted from server`);
            self.deleteDirFor(remotePath, cb);
        });
    });
};

Sftp.prototype.deleteDirFor = function(filePath, cb) {
    let self = this;

    this.do(function() {
        let pos = filePath.lastIndexOf('/');
        if (pos == -1 || pos <= self.getRemotePath().length) {
            cb();
            return;
        }

        filePath = filePath.substr(0, pos);
        self.sftp.readdir(filePath, function (err, list) {
            if (err) throw err;

            if (list.length) {
                cb();
                return;
            }

            self.sftp.rmdir(filePath, function (err) {
                if (err) throw err;

                self.deleteDirFor(filePath, cb);
            });
        });

    });
};

Sftp.prototype.download = function(filePath, cb) {
    let self = this;

    this.do(function () {
        let remotePath = `${self.getRemotePath()}/${filePath}`;
        let localPath = path.join(self.getLocalPath(), filePath);

        self.createLocalDirFor(localPath, function(err) {
            if (err) throw err;

            self.sftp.fastGet(remotePath, localPath, function (err) {
                if (err) throw err;

                console.log(`${filePath} downloaded`);
                cb();
            });
        });
    });
};

Sftp.prototype.createLocalDirFor = function(filePath, cb) {
    let self = this;

    let pos = filePath.replace(/\\/g, '/').lastIndexOf('/');
    if (pos == -1 || pos == 0) {
        cb();
        return;
    }

    filePath = filePath.substr(0, pos);

    fs.exists(filePath, function (exists) {
        if (exists) {
            cb();
            return;
        }

        self.createLocalDirFor(filePath, function (err) {
            if (err) throw err;

            fs.mkdir(filePath, cb);
        });
    });
};

Sftp.prototype.deleteLocally = function() {
    let self = this;

    return through.obj(function (file, enc, cb) {
        let localPath = path.join(self.getLocalPath(), file.relative);

        fs.unlink(localPath, function(err) {
            if (err) throw err;

            console.log(`${file.relative.replace(/\\/g, '/')} deleted locally`);
            self.deleteLocalDirFor(localPath, cb);

        });
    });
};

Sftp.prototype.deleteLocalDirFor = function(filePath, cb) {
    let self = this;

    let pos = filePath.replace(/\\/g, '/').lastIndexOf('/');
    if (pos == -1 || pos <= this.getLocalPath().length) {
        cb();
        return;
    }

    filePath = filePath.substr(0, pos);
    fs.readdir(filePath, function (err, list) {
        if (err) throw err;

        if (list.length) {
            cb();
            return;
        }

        fs.rmdir(filePath, function (err) {
            if (err) throw err;

            self.deleteLocalDirFor(filePath, cb);
        });
    });
};

module.exports = Sftp;