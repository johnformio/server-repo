FROM node:8-alpine
MAINTAINER Form.io <support@form.io>

COPY ./build /src
WORKDIR /src

# Install git
RUN apk update && \
    apk upgrade && \
    apk add --no-cache --virtual .build-deps bash git make gcc g++ python

RUN npm install --production --build-from-source=bcrypt && \
    npm cache clean && \
    npm uninstall -g npm && \
    apk del .build-deps

EXPOSE      80
ENTRYPOINT  ["node", "--max_old_space_size=4096", "main"]
