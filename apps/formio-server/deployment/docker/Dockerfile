FROM        alpine:latest
MAINTAINER  Form.io <support@form.io>

# Install the latest versions from edge
RUN sed -i -e 's/v[[:digit:]]\..*\//edge\//g' /etc/apk/repositories &&\
    apk add --upgrade \
    nodejs npm nghttp2 nghttp2-libs &&\
    rm -rf /var/lib/apt/lists/* &&\
    rm /var/cache/apk/*

COPY        ./build /src
WORKDIR     /src

EXPOSE      80
CMD  ["node", "formio.js", "--max_old_space_size=4096"]
