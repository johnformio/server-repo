FROM formio/ubuntu-base:latest
MAINTAINER Randall Knutson <randall@form.io>

RUN apt-get update

# Install the core dd agent.
RUN apt-get install -y apt-transport-https
RUN sh -c "echo 'deb https://apt.datadoghq.com/ stable main' > /etc/apt/sources.list.d/datadog.list"
RUN apt-key adv --keyserver keyserver.ubuntu.com --recv-keys C7A7DA52
RUN apt-get update
RUN apt-get install -y datadog-agent

COPY . /src
WORKDIR /src

# node modules need to be compiled for the host platform.
RUN npm rebuild

EXPOSE      80
ENTRYPOINT  ["/bin/bash", "server.sh"]

# Clean up APT when done.
RUN apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*
