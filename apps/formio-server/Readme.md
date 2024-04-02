http://form.io main application.
================================
This repository is the main server for the Form.IO project. There is no UI and the server is not designed to respond
without a subdomain in front of the domain. The main components that are included are as follows.

 - **formio** @ /node_modules/formio - The Form.IO core server - https://github.com/formio/formio


Local Development
------------
## Prequisites
Before you can start the app server, you need to do a few things first:
1. Install [https://classic.yarnpkg.com/lang/en/](Yarn)
2. Setup [https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent](ssh keys} with github.
3. clone the [https://github.com/formio/formio-app](formio-app) project and set it up.

### setup mongo with docker
It's easiest to run mongo for a docker container, though you can run it manually if you want to.

start up a mongodb server in docker with the following command.

  - ```docker run --name mongo-server -p 27017:27017 -d mongo```
  
In this docker command, we are downloading and running a mongodb instance.
 
  - --name mongo-server will name the server.
  - -p 27017:27017 will map the port to the boot2docker-vm.
  - -d will daemonize it so it will run in the background.
  - mongo is the name of the docker image to use from docker hub.
  
You can control the mongo server with these commands.

  - ```docker start mongo-server```
  - ```docker stop mongo-server```

### create environment file
1. copy `.env.empty` to `.env`
2. add line for your license key: `LICENSE_KEY=<YOUR KEY>`

### Symlink formio-app
Use the formio-app project to interact with the api server.  This line assumes you cloned `formio-app` repo in the same parent directory.  If it is somewhere else, change this command accordingly

```
ln -s  ../formio-app/dist/ ./portal
```

You should now be able to run the server

```
yarn start
```


Deployment
---------------
There are five steps that need to be run to deploy a new version.

  - ```./deployment/scripts/setup.sh -snb```
  - ```docker build -t formio/formio-app:$TAG_NAME .```
  - ```docker push formio/formio-app:$TAG_NAME```
  - ```./scripts/createVersion.sh $TAG_NAME```
  - ```./scripts/deployVersion.sh $TAG_NAME $ENVIRONMENT```
