FROM        node:12-alpine
MAINTAINER  Form.io <support@form.io>

COPY        ./build /src
WORKDIR     /src

EXPOSE      80
USER        node
CMD  ["formio.js", "--max_old_space_size=4096"]
