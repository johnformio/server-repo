FROM node:8-alpine
MAINTAINER Form.io <support@form.io>

COPY ./build /src
WORKDIR /src

# Install git
RUN apk update && \
    apk upgrade && \
    apk add --no-cache --virtual .build-deps bash git make gcc g++ python

RUN npm ci --production && \
    npm install -g pkg && \
    npm run dist

RUN npm cache clean --force && \
    npm uninstall -g pkg && \
    npm uninstall -g npm && \
    apk del .build-deps && \
    rm /src/main.js

EXPOSE      80
ENTRYPOINT  ["./formio", "--max_old_space_size=4096"]
