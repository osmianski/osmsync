const fs = require('fs');
const {src, series} = require('gulp');

const FileList = require('./js/FileList');
const Sftp = require('./js/Sftp');

if (!fs.existsSync('config.json')) {
    console.log(`Before using gulp commands, create 'config.json' in '${process.cwd()}' directory.

To get started, copy 'config.json' file from 'config.template.json'.
 
In 'config.json' file, specify at least one "mapping" - pair of local and remote directory to be synced:

{
  "mapping1": {
    "local_path": "directory on your computer, can be relative to '${process.cwd()}' directory", 
    "remote_path": "directory on remote server", 
    // also provide SFTP connection settings for accessing remote server
  },
  
  // ...  
  "mappingN": { 
    "local_path": "directory on your computer, can be relative to '${process.cwd()}' directory", 
    "remote_path": "directory on remote server", 
    // also provide SFTP connection settings for accessing remote server
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
    console.log(`Syntax: 

gulp command[:mapping]

If mapping is omitted, mapping with "default" name is assumed.

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

    let suffix = mapping != 'default' ? `:${mapping}` : '';

    exports[`pull${suffix}`] = createPullTask(mapping, config[mapping]);
    exports[`push${suffix}`] = createPushTask(mapping, config[mapping]);
    exports[`watch${suffix}`] = createWatchTask(mapping, config[mapping]);
}

function createPullTask(mapping, mapping_) {
    let fileList = new FileList();
    let sftp = new Sftp(mapping_);

    return series(function downloadNewAndModifiedFilesFromRemoteServer(cb) {
        sftp.each(function (filePath, cb) {
            sftp.download(filePath, function(err) {
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
    });
}

function createPushTask(mapping, mapping_) {
    let fileList  = new FileList();
    let sftp = new Sftp(mapping_);

    return series(function uploadNewAndModifiedFilesToRemoteServer() {
        return src('**/*', {base: mapping_.localPath, cwd: mapping_.localPath})
            .pipe(fileList.add())
            .pipe(sftp.upload());
    }, function deleteOldFilesOnRemoteServer(cb) {
        sftp.each(function(filePath, cb) {
            if (fileList.paths.indexOf(filePath) == -1) {
                sftp.delete(filePath, cb);
            }
            else {
                cb();
            }
        }, cb);
    }, function closeSftpSession(cb) {
        sftp.close(cb);
    });
}

function createWatchTask(mapping, mapping_) {
    return function () {
    };
}
