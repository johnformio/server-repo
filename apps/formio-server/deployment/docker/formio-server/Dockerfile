FROM node:8-alpine
MAINTAINER Form.io <support@form.io>

COPY ./build /src
WORKDIR /src

# Install git
RUN apk update && \
    apk upgrade && \
    apk add --no-cache --virtual .build-deps bash git make gcc g++ python openssh-client

# Add deployment key
RUN mkdir /root/.ssh/ && ssh-keyscan github.com >> /root/.ssh/known_hosts

ADD id_rsa /root/.ssh/id_rsa

RUN chmod 600 /root/.ssh/id_rsa

RUN npm ci --production && \
    npm install -g pkg && \
    npm run dist

RUN npm cache clean --force && \
    npm uninstall -g pkg && \
    npm uninstall -g npm && \
    apk del .build-deps && \
    rm -f /root/.ssh/id_rsa && \
    rm -f /src/main.js
    rm -rf /src/portal

EXPOSE      80
ENTRYPOINT  ["./formio", "--max_old_space_size=4096"]
