#!/bin/bash

mv /var/www/html /var/www/html-prev
rm -rf /var/www/html
mv /var/www/html-prev/vortex /var/www/html

cd /var/www/html
composer install

mkdir -p storage/db storage/css

vendor/bin/phpunit --config tests/phpunit.xml
