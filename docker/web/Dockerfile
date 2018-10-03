FROM php:7.2.10-apache-stretch

RUN a2enmod rewrite        \
	&& pecl install xdebug

COPY 000-default.conf /etc/apache2/sites-available/
COPY 20-xdebug.ini    /usr/local/etc/php/conf.d/
