This project syncs entire local directory to remote server and vice versa or watches and uploads local changes and deletions on the fly.

## Installation

1. Install [Node.js](https://nodejs.org/en/). Download installer and follow its instructions. 
2. Install [gulp.js](https://gulpjs.com/). Run the following command in shell:

        npm install gulp-cli -g

3. Download this project. Click `Clone or download` button, press `Download ZIP`, and then extract downloaded ZIP file to some directory (we'll call it `{project_path}`).

4. Run the following commands in shell:

        cd {project_path}
        npm install

> **Note.** Alternatively to steps 3 and 4, clone this project in shell (install [Git](https://git-scm.com/) if you don't have it yet):
> 
>     cd {parent_directory}
>     git clone https://github.com/osmianski/osmsync.git
>     cd osmsync
>     npm install
>
> In this case, `{project_path} = {parent_directory}/osmsync`.

## Configuration

Before using this project create `config.json` file in `{project_path}` directory. You can use `config.template.json` as a template.

In `config.json` file, define one or more **mappings**. Mapping is a pair of local and remote directory to be synced.

In the following example, `config.json` contains 2 mappings, one authenticates to server using a password, the other one uses private key in your home directory:

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

## Installing As A Windows Service

On Windows, once configuration is stable and SFTP connections work, consider installing `gulp watch` as a service, so that you don't have to start it in console window:

1. Download [nssm](https://nssm.cc/download), and copy `win64/nssm.exe` from downloaded ZIP file to `C:\Windows` directory.

2. In shell, run the following commands with administrative privileges:

        nssm install osmsync "%USERPROFILE%\AppData\Roaming\npm\gulp.cmd" watch
        nssm set osmsync AppDirectory {project_path}
        nssm start osmsync 
        
3. Later, if needed, stop/restart/start the service, either from Windows `Services` applet or by running commands with administrative privileges:

        nssm stop osmsync
        nssm restart osmsync
        nssm start osmsync
        
## Running In Background In Linux

On Linux, once configuration is stable and SFTP connections work, consider running `gulp watch` in background, so that you don't have to start it in console window:
                
1. Install [Supervisor](http://supervisord.org/). On Ubuntu run in shell with `root` user:

        apt-get install supervisor
        
2. With `root` user, create `/etc/supervisor/conf.d/osmsync.conf` file with the following contents:

        [program:osmsync]
        process_name=%(program_name)s_%(process_num)02d
        directory={project_path}
        command=gulp watch
        autostart=true
        autorestart=true
        user={user}
        numprocs=1
        redirect_stderr=true
        stdout_logfile=/var/log/supervisor/%(program_name)s.log          
        
3. Start Supervisor in shell with `root` user:                     

        supervisorctl reread
        supervisorctl update
        supervisorctl start osmsync:*