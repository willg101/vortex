FROM vortex-base

# Install Composer
# https://getcomposer.org/download/
# (Composer doesn't want us to redistrubute this process; however, we want to ensure everyone using
# this docker image is on the same version of composer)
RUN php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');" \
    && php -r "if (hash_file('SHA384', 'composer-setup.php') === '93b54496392c062774670ac18b134c3b3a95e5a5e5c8f1a9f115f203b75bf9a129d5daa8ba6a13e2cc8a1da0806388a8') { echo 'Installer verified'; } else { echo 'Installer corrupt'; unlink('composer-setup.php'); } echo PHP_EOL;" \
    && php composer-setup.php --install-dir=/usr/local/bin --filename=composer   \
    && php -r "unlink('composer-setup.php');"

RUN rm -r /var/www/html
COPY main.sh /main.sh

CMD ["/main.sh"]
