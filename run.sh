#! /bin/bash

mysqld --user=root &
sleep 60
pm2-runtime start /backup/ecosystem.config.js
