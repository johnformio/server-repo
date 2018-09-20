FROM node:8-alpine
MAINTAINER Form.io <support@form.io>

COPY ./dist /

EXPOSE      80
ENTRYPOINT  ["/formioServer", "--max_old_space_size=4096"]
