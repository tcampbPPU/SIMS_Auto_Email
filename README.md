# Getting Sims Automated Email Server Configured

## Install NPM Pkg's

`$ npm install`

Make sure app starts:

`$ npm run dev`

Control + C to kill running script.

### Globally install PM2 run-time process manager

`$ sudo npm i pm2 -g`

Allow script to run on boot

`$ pm2 startup ubuntu`

>  **Note:** I have only done this for Ubuntu & FreeBSD. Also might require you to run as root, Docs say not to use `sudo` for some reason

> Link to PM2 Documentation: http://pm2.keymetrics.io/docs/usage/pm2-doc-single-page/

  
Start app with pm2

`$ pm2 start app`

>  **Note:** Could alternatively run script via

>  `$ npm run start` or `$ node app.js`

> or run the dev

>  `$ npm run dev`
 

#### Main pm2 commands

`$ pm2 show app`

`$ pm2 status`

`$ pm2 restart app`

`$ pm2 stop app`

`$ pm2 log` (Show console log stream)

`$ pm2 flush` (Clear console logs)

### Cron Monitoring Tool
> Could be worth looking into since a cron failure it hard to detect with plain node.js
> Link to Health Checks Cron Monitoring tool:  https://healthchecks.io/docs/ 