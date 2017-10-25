FROM node:alpine
MAINTAINER Form.io <support@form.io>

COPY ./build /src
COPY ./node_modules /src/node_modules
WORKDIR /src

# node modules need to be compiled for the host platform.
RUN npm rebuild

EXPOSE      80
ENTRYPOINT  ["/bin/bash", "server.sh"]
