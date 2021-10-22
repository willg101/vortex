FROM php:7.4-apache

# Install ZMQ (https://eole-io.github.io/sandstone-doc/install-zmq-php-linux)
RUN apt-get update \
    && apt-get install -y \
        git \
        libzmq3-dev \
        supervisor \
    && rm -rf /var/lib/apt/lists/* \
    && git clone git://github.com/mkoppanen/php-zmq.git /tmp/php-zmq \
    && cd /tmp/php-zmq \
    && phpize \
    && ./configure \
    && make \
    && make install \
    && echo 'extension=zmq.so' > /usr/local/etc/php/conf.d/zmq.ini \
    && a2enmod proxy proxy_wstunnel proxy_http

CMD ["/usr/bin/supervisord"]

COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
