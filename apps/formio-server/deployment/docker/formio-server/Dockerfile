FROM node:12-alpine
MAINTAINER Form.io <support@form.io>

COPY ./build /src
WORKDIR /src

RUN apk update && \
    apk upgrade && \
    apk add --no-cache --virtual .build-deps bash git make gcc g++ python openssh-client && \
    rm -rf /var/lib/apt/lists/* && \
    rm /var/cache/apk/*

# Add deployment key
RUN mkdir /root/.ssh/ && ssh-keyscan github.com >> /root/.ssh/known_hosts
ADD id_rsa /root/.ssh/id_rsa
RUN chmod 600 /root/.ssh/id_rsa
RUN npm config set python /usr/bin/python
RUN npm i -g npm && npm ci --production
RUN npm install -g pkg && npm run dist
RUN npm cache clean --force && \
    npm uninstall -g pkg && \
    npm uninstall -g npm && \
    apk del .build-deps && \
    rm -f /root/.ssh/id_rsa && \
    rm -f /src/main.js

EXPOSE      80
ENTRYPOINT  ["./formio", "--max_old_space_size=4096"]
