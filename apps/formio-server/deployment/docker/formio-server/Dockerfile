FROM node:6-alpine
MAINTAINER Form.io <support@form.io>

COPY ./build /src
WORKDIR /src

# Install git
RUN apk update && \
    apk upgrade && \
    apk add --no-cache --virtual .build-deps bash git make gcc g++ python openssh

RUN npm rebuild && \
    npm cache clean && \
    npm uninstall -g npm && \
    apk del .build-deps

EXPOSE      80
ENTRYPOINT  ["node", "--max_old_space_size=4096", "main"]
