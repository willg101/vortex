FROM php:5.6.38-apache-stretch

RUN a2enmod rewrite              \
	&& pecl install xdebug-2.5.5

COPY 000-default.conf /etc/apache2/sites-available/
COPY 20-xdebug.ini    /usr/local/etc/php/conf.d/
