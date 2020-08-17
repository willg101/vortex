# Vortex PHP Debugger
A self-hosted, in-browser PHP debugger | __[http://debug-my.website](http://debug-my.website)__

![image](http://debug-my.website/img/vortex_screenshot.png)

## Features

In addition to being a __self-hosted webapp that allows you to debug PHP code right within your browser__ (which means you'll no longer need to install an Xdebug client on each machine you develop from), Vortex is loaded with goodness:

 - Full-featured debugger including __breakpoints__, an __interactive console__, __scope and stack explorers__, and __watched expressions__
 - Powerful and unique capabilities like __automatic file mapping__, __hover-to-inspect__, __debug session management/queue__, and __seamless transfer of debug session between browsers__
 - Effortless deployment including __built-in password protection__, __docker support__, a __highly extensible structure__, and an __infrastructure agnostic architecture__ (whether your local machine, PHP web server, and Vortex are all running on the same machine, all running on separate machines, or somewhere in between, it's easy to setup and use)

## Installation

tl;dr:

1. Install [docker](https://docs.docker.com/install/#server) and [docker-compose](https://docs.docker.com/compose/install/)
1. Clone (or download and extract) the current release of Vortex
1. Navigate to Vortex's docker/ directory and then execute `./spin-up`
1. If necessary, adjust your firewall settings to allow traffic to the ports that Vortex is listening on (http and debugger engine).

See the [full installation guide](https://debug-my.website/installation-guide.html#php-config) for more information on configuring PHP with Xdebug.

## Bugs

Vortex is currently in Beta. Please help make Vortex better by opening an issue whenever you encounter a new bug.

-------

Copyright Will Groenendyk, 2019. Licensed under [AGPL 3.0](https://github.com/willg101/vortex/blob/master/LICENSE).
