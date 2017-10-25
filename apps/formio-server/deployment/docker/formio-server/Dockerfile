FROM node:alpine
MAINTAINER Form.io <support@form.io>

COPY ./build /src
WORKDIR /src

# Install git
RUN apk update && apk upgrade && apk add --no-cache bash git

# node modules need to be compiled for the host platform.
RUN npm install --production

EXPOSE      80
ENTRYPOINT  ["node", "main"]
