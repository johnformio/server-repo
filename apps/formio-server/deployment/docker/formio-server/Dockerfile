FROM formio/docker-alpine-node-java-git:1.0.0
MAINTAINER Form.io <support@form.io>

COPY ./build /src
WORKDIR /src

# Add deployment key
RUN mkdir /root/.ssh/ && ssh-keyscan github.com >> /root/.ssh/known_hosts
ADD id_rsa /root/.ssh/id_rsa
RUN chmod 600 /root/.ssh/id_rsa
RUN npm config set python /usr/bin/python
RUN npm i -g npm
RUN npm ci --production && \
    npm rebuild bcrypt --build-from-source && \
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
