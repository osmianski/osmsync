const fs = require('fs');
const {src, series, watch, parallel} = require('gulp');
const notifier = require('node-notifier');

const FileList = require('./js/FileList');
const Sftp = require('./js/Sftp');

if (!fs.existsSync('config.json')) {
    console.log(`Before using gulp commands, create 'config.json' in '${process.cwd()}' directory.

To get started, copy 'config.json' file from 'config.template.json'.
 
In 'config.json' file, specify at least one "mapping" - pair of local and remote directory to be synced:

{
  "mapping1": {
    "localPath": "directory on your computer, can be relative to '${process.cwd()}' directory", 
    "remotePath": "directory on remote server", 
    "remote": {
      // also provide SFTP connection settings for accessing remote server
    }    
  },
  
  // ...  
  "mappingN": { 
    "localPath": "directory on your computer, can be relative to '${process.cwd()}' directory", 
    "remotePath": "directory on remote server", 
    "remote": {
      // also provide SFTP connection settings for accessing remote server
    }    
  },
}

Available SFTP connection settings:

host - server host name or IP address
port - SFTP port. If omitted, 22 port is used
user - SFTP user name
password - SFTP password. If omitted, your private SSH key will be used to connect instead of password.`);
    process.exit(1);
}

const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

exports.default = function (cb) {
    console.log(`Usage: 

gulp command[:mapping]

If mapping is omitted, command runs on all mappings.

Available commands:

push - upload all changes from your computer to remote server
pull - download all changes from remote server to your computer
watch - watch for changes on your computer and upload them to remote server
`);
    cb();
};

for (let mapping in config) {
    if (!config.hasOwnProperty(mapping)) {
        continue;
    }
    if (mapping == 'options') {
        continue;
    }

    exports[`pull:${mapping}`] = createPullTask(mapping, config[mapping]);
    exports[`push:${mapping}`] = createPushTask(mapping, config[mapping]);
    exports[`watch:${mapping}`] = createWatchTask(mapping, config[mapping]);
}

function notifyAfterSuccessfully(operation, mapping, sftp, cb) {
    let message = [];
    if (sftp.changes) {
        message.push(`${sftp.changes} file(s) ${operation}`);
    }
    if (sftp.deletions) {
        message.push(`${sftp.deletions} file(s) deleted`);
    }

    let logMessage = message.slice(0);
    if (sftp.skips) {
        if (message.length) {
            message.push(`${sftp.skips} file(s) skipped`);
        }
        logMessage.push(`${sftp.skips} file(s) skipped`);
    }
    if (logMessage.length) {
        console.log(`${mapping}: ${logMessage.join(', ')}`);
    }

    if (config.options && config.options.notify == 'all' && message.length) {
        notifier.notify({
            title: 'OsmSync',
            message: `${mapping}: ${message.join(', ')}`
        });
    }

    cb();
}

function createPullTask(mapping, mapping_) {
    let fileList = new FileList();
    let sftp = new Sftp(mapping, mapping_);

    return series(function downloadNewAndModifiedFilesFromRemoteServer(cb) {
        sftp.each(function (filePath, remoteStat, cb) {
            sftp.download(filePath, remoteStat, function(err) {
                if (err) throw err;

                fileList.paths.push(filePath);
                cb();
            });
        }, cb);
    }, function deleteOldFilesLocally() {
        return src('**/*', {base: mapping_.localPath, cwd: mapping_.localPath})
            .pipe(fileList.notIn())
            .pipe(sftp.deleteLocally());
    }, function closeSftpSession(cb) {
        sftp.close(cb);
    }, function notify(cb) {
        notifyAfterSuccessfully('downloaded', mapping, sftp, cb);
    });
}

function createPushTask(mapping, mapping_) {
    let fileList  = new FileList();
    let sftp = new Sftp(mapping, mapping_);

    return series(function uploadNewAndModifiedFilesToRemoteServer() {
        return src('**/*', {base: mapping_.localPath, cwd: mapping_.localPath})
            .pipe(fileList.add())
            .pipe(sftp.upload());
    }, function deleteOldFilesOnRemoteServer(cb) {
        sftp.each(function(filePath, remoteStat, cb) {
            if (fileList.paths.indexOf(filePath) == -1) {
                sftp.delete(filePath, cb);
            }
            else {
                cb();
            }
        }, cb);
    }, function closeSftpSession(cb) {
        sftp.close(cb);
    }, function notify(cb) {
        notifyAfterSuccessfully('uploaded', mapping, sftp, cb);
    });
}

function createWatchTask(mapping, mapping_) {
    let changes = [];
    let deletions = [];
    let sftp = new Sftp(mapping, mapping_);

    return function () {
        let watcher = watch('**/*', {
            base: mapping_.localPath,
            cwd: mapping_.localPath,
            events: ['add', 'change', 'unlink', 'unlinkDir']
        },
            function sendWatchedChangesAndDeletionsToServer(cb)
        {
            let changes_ = changes;
            let deletions_ = deletions;

            let message = [];
            if (changes_.length) {
                message.push(`${changes_.length} file(s) uploaded`);
            }
            if (deletions_.length) {
                message.push(`${deletions_.length} file(s) deleted`);
            }

            changes = [];
            deletions = [];

            sftp.uploadMultiple(changes_, function() {
                sftp.deleteMultiple(deletions_, function() {
                    if (config.options && config.options.notify == 'all' && message.length) {
                        notifier.notify({
                            title: 'OsmSync',
                            message: message.join(', ')
                        });
                    }
                    cb();
                });
            });
        });

        function change(path) {
            path = path.replace(/\\/g, '/');

            if (changes.indexOf(path) == -1) {
                changes.push(path);
            }

            let index = deletions.indexOf(path);
            if (index != -1) {
                deletions.splice(index, 1);
            }
        }

        function unlink(path) {
            path = path.replace(/\\/g, '/');

            if (deletions.indexOf(path) == -1) {
                deletions.push(path);
            }

            let index = changes.indexOf(path);
            if (index != -1) {
                changes.splice(index, 1);
            }
        }

        watcher.on('change', change);
        watcher.on('add', change);
        watcher.on('unlink', unlink);
        watcher.on('error', function(error) {
            if (error instanceof Error && error.code == 'EPERM' && error.syscall == 'watch') {
                return;
            }
            console.log(error);
        });
    };
}

function all(operation) {
    let tasks = [];

    for (let mapping in config) {
        if (!config.hasOwnProperty(mapping)) {
            continue;
        }

        if (mapping == 'options') {
            continue;
        }

        tasks.push(exports[`${operation}:${mapping}`]);
    }

    return parallel(...tasks);
}

exports.pull = all('pull');
exports.push = all('push');
exports.watch = all('watch');