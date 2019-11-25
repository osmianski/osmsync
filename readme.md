# `osm-sftp-sync`

This software seamlessly syncs directories on your local computer and on remote servers via SFTP.

## Installation

1. Install [Node.js](https://nodejs.org/en/). Download installer and follow its instructions. 
2. Install [gulp.js](https://gulpjs.com/). Run the following command in shell:

        npm install gulp-cli -g

3. Download this project. Click `Clone or download` button, press `Download ZIP`, and then extract downloaded ZIP file to some directory (we'll call it `{project_path}`).

4. Run the following commands in shell:

        cd {project_path}
        npm install

## Configuration

Before using this project create `config.json` file in `{project_path}` directory. You can use `config.template.json` as a template.

In `config.json` file, define one or more **mappings**. Mapping is a pair of local and remote directory to be synced.

In the following example, `config.json` contains 2 mappings, one uses authenticates to server using a password, the other one uses private key in your home directory:

    {
        "default": {
            "localPath": "{localPath}", 
            "remotePath": "{remotePath}", 
            "remote": {
                  "host": "{host}",
                  "username": "{username}",
                  "password": "{password}"
            }    
        },
        "production": {
            "localPath": "{localPath}", 
            "remotePath": "{remotePath}", 
            "remote": {
                  "host": "{host}",
                  "username": "{username}",
            }    
        },        
    }  
    
## Usage

After configuring mappings, use the following commands in shell by specifying mapping name after a colon, in this example, `production`:

    cd {project_path}
    
    # upload all local files to remote server and 
    # delete obsolete files on server 
    gulp push:production
    
    # download all files from remote server to your local directory 
    # and delete local obsolete files 
    gulp pull:production
        
    # watch local files for changes and deletions and 
    # replicate same changes and deletions on remote server
    gulp watch:production
        
Or you can run the same commands for all mappings as follows:         

    cd {project_path}
    
    // upload local changes for all mappings 
    gulp push
    
    // download remote changes for all mappings 
    gulp pull
        
    // watch and upload local changes for all mappings 
    gulp watch
