FROM formio/ubuntu-base:latest
MAINTAINER Randall Knutson <randall@form.io>

RUN apt-get update && apt-get install -y \
  apt-transport-https

# Add the Datadog agent and import the dd key
RUN sh -c "echo 'deb https://apt.datadoghq.com/ stable main' > /etc/apt/sources.list.d/datadog.list"
RUN apt-key adv --keyserver keyserver.ubuntu.com --recv-keys C7A7DA52
RUN apt-get update
RUN apt-get install datadog-agent
# Start the datadog agent
RUN sh -c "sed 's/api_key:.*/api_key: ecfc296e24e7a4e0b930b98d418ff82c/' /etc/dd-agent/datadog.conf.example > /etc/dd-agent/datadog.conf"
RUN /etc/init.d/datadog-agent start

COPY . /src
WORKDIR /src

# node modules need to be compiled for the host platform.
RUN npm rebuild

EXPOSE       80

ENTRYPOINT   ["node"]

CMD          ["server"]

# Clean up APT when done.
RUN apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*
