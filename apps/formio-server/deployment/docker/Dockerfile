FROM        node:14-alpine3.12
MAINTAINER  Form.io <support@form.io>

COPY        ./build /src
WORKDIR     /src

EXPOSE      80
CMD  ["formio.js", "--max_old_space_size=4096"]
