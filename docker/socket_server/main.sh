#!/bin/bash

# Handle SIGTERM for fast shutdown
function handle-signal()
{
	echo "Caught SIGTERM; terminating"
	exit
}
trap handle-signal SIGTERM

echo "Waiting for 'web' container to come online..."
/wait-for-it.sh web:80

echo "'web' container is online; starting socket server..."
cd /var/www/html
./vcli socket-server:start &
wait $!
