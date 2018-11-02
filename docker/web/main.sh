#!/bin/bash

cd /var/www/html

mkdir -p storage/css
mkdir -p storage/db
touch storage/db/vortex.db
chown www-data -R storage

# Handle SIGTERM for fast shutdown
function handle-signal()
{
	echo "Caught SIGTERM; terminating"
	kill $APACHE_PID
}
trap handle-signal SIGTERM

apache2-foreground &
APACHE_PID=$!
wait $APACHE_PID
