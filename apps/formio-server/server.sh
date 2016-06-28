#!/usr/bin/env bash

# Attempt to start datadog if an API key is present.
if [[ $DD_API_KEY ]]; then
  sudo sh -c "sed 's/api_key:.*/api_key: $DD_API_KEY/' /etc/dd-agent/datadog.conf.example > /etc/dd-agent/datadog.conf"
  sudo /etc/init.d/datadog-agent start
fi

# Start the server as usual.
node server
