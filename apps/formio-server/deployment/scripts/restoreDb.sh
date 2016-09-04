#!/usr/bin/env bash
DB=$1
FILE=formio.archive
mongorestore --drop --db $DB --gzip --archive=$FILE
