<?php

namespace Vortex\Cli;

define( 'DPOH_ROOT', __DIR__ . '/../../../../' );

use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
use React\EventLoop\Factory as EventLoopFactory;
use React\Socket\Server as SocketServer;
use Ratchet\Http\HttpServer;
use Ratchet\WebSocket\WsServer;
use Ratchet\Server\IoServer;
use Monolog\Handler\StreamHandler;
use Vortex\App;

require_once 'includes/arrays.php';
require_once 'includes/database.php';
require_once 'includes/bootstrap.php';
require_once 'includes/http.php';
require_once 'includes/exceptions.php';
require_once 'includes/files.php';
require_once 'includes/templates.php';

class SocketServerRunCommand extends Command
{
    protected function configure()
    {
        $this
            ->setName('socket-server:run')
            ->setDescription('Run the socket server')
            ->setHelp('This should not be started directly from the command line')
            ->setHidden(true);
    }

    protected function execute(InputInterface $input, OutputInterface $output)
    {
        $vortex_app = new App(DPOH_ROOT . '/modules_available', DPOH_ROOT . '/settings-global.ini');
        App::setInstance($vortex_app);
        date_default_timezone_set( $vortex_app->settings->get( 'timezone' ) );
        $bridge = new ConnectionBridge;

        logger()->info('Creating socket servers');

        $loop = EventLoopFactory::create();
        $dbg  = new SocketServer('0.0.0.0:' . App::get('settings')->get('socket_server.de_port'), $loop);
        $ws   = new SocketServer('0.0.0.0:' . App::get('settings')->get('socket_server.ws_port'), $loop);

        $wsStack = new HttpServer(
            new WsServer(
                new WsApp($bridge)
        )
        );

        $DbgApp = new IoServer(new DbgpApp($bridge), $dbg, $loop);
        $wsApp  = new IoServer($wsStack, $ws, $loop);

        logger()->info('Entering run loop');

        $loop->run();
    }
}
