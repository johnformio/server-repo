FROM formio/ubuntu-base:latest
MAINTAINER Randall Knutson <randall@form.io>

RUN apt-get update

# Start the datadog agent
RUN DD_API_KEY=ecfc296e24e7a4e0b930b98d418ff82c bash -c "$(curl -L https://raw.githubusercontent.com/DataDog/dd-agent/master/packaging/datadog-agent/source/install_agent.sh)"

COPY . /src
WORKDIR /src

# node modules need to be compiled for the host platform.
RUN npm rebuild

EXPOSE       80

ENTRYPOINT   ["node"]

CMD          ["server"]

# Clean up APT when done.
RUN apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*
