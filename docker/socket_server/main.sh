#!/bin/bash

# Handle SIGTERM for fast shutdown
function handle-signal()
{
	echo "Caught SIGTERM; terminating"
	exit
}
trap handle-signal SIGTERM

cd /var/www/html

# Require a proper settings file to be available before continuing; otherwise, the socket server
# will immediately terminate
SETTINGS_FILE=settings-global.ini
POLLING_DELAY=10
while [[ ! -e "$SETTINGS_FILE" ]]; do
	echo "'$PWD/$SETTINGS_FILE' does not exist; this file MUST exist before continuing."
	echo "We'll check again for the file in $POLLING_DELAY seconds..."
	sleep $POLLING_DELAY
done

echo "Waiting for 'web' container to come online..."
/wait-for-it.sh web:80

echo "'web' container is online; starting socket server..."
./vcli socket-server:start &
wait $!
