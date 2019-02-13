FROM node:8-alpine
MAINTAINER Form.io <support@form.io>

COPY ./build /src
WORKDIR /src

# Install git
RUN apk update && \
    apk upgrade && \
    apk add --no-cache --virtual .build-deps bash git make gcc g++ python openssh-client

# Install JAVAC for SAML support.
# Default to UTF-8 file.encoding
ENV LANG C.UTF-8
RUN { \
		echo '#!/bin/sh'; \
		echo 'set -e'; \
		echo; \
		echo 'dirname "$(dirname "$(readlink -f "$(which javac || which java)")")"'; \
	} > /usr/local/bin/docker-java-home \
	&& chmod +x /usr/local/bin/docker-java-home
ENV JAVA_HOME /usr/lib/jvm/java-1.8-openjdk/jre
ENV PATH $PATH:/usr/lib/jvm/java-1.8-openjdk/jre/bin:/usr/lib/jvm/java-1.8-openjdk/bin
ENV JAVA_VERSION 8u191
ENV JAVA_ALPINE_VERSION 8.191.12-r0
RUN set -x \
	&& apk add --no-cache \
		openjdk8-jre="$JAVA_ALPINE_VERSION" \
	&& [ "$JAVA_HOME" = "$(docker-java-home)" ]

# Add deployment key
RUN mkdir /root/.ssh/ && ssh-keyscan github.com >> /root/.ssh/known_hosts

ADD id_rsa /root/.ssh/id_rsa

RUN chmod 600 /root/.ssh/id_rsa

RUN npm ci --production && \
    npm install -g https://github.com/randallknutson/pkg.git#build && \
    npm run dist

RUN npm cache clean --force && \
    npm uninstall -g pkg && \
    npm uninstall -g npm && \
    apk del .build-deps && \
    rm -f /root/.ssh/id_rsa && \
    rm -f /src/main.js

EXPOSE      80
ENTRYPOINT  ["./formio", "--max_old_space_size=4096"]
