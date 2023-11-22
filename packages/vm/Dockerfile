FROM node:21-alpine

COPY ./build /src
COPY ./node_modules /src/node_modules
WORKDIR /src

ENTRYPOINT [ "node", "--experimental-permission", "--allow-fs-read=/src/", "index.js" ]
