FROM formio/ubuntu-base:latest
MAINTAINER Randall Knutson <randall@form.io>

RUN apt-get update

# Install the core dd agent.
RUN apt-get install -y apt-transport-https; \
    sh -c "echo 'deb https://apt.datadoghq.com/ stable main' > /etc/apt/sources.list.d/datadog.list"; \
    apt-key adv --keyserver keyserver.ubuntu.com --recv-keys C7A7DA52; \
    apt-get update; \
    apt-get install -y datadog-agent;

COPY ./build /src
COPY ./node_modules /src/node_modules
WORKDIR /src

# node modules need to be compiled for the host platform.
RUN npm rebuild

EXPOSE      80
ENTRYPOINT  ["/bin/bash", "server.sh"]

# Clean up APT when done.
RUN apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*
