FROM node:21-alpine

COPY ./build /src
COPY package.json /src
COPY yarn.lock /src
WORKDIR /src
RUN yarn

EXPOSE 3005

ENTRYPOINT [ "node", "--experimental-permission", "--allow-fs-read=/src/", "server/index.js" ]
