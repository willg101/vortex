<?php

namespace Vortex\Cli;

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
use Monolog\Logger;
use Monolog\Handler\StreamHandler;

chdir( __DIR__ . '/../../../' );

require_once 'includes/arrays.php';
require_once 'includes/database.php';
require_once 'includes/bootstrap.php';
require_once 'includes/http.php';
require_once 'includes/exceptions.php';
require_once 'includes/files.php';
require_once 'includes/models.php';
require_once 'includes/templates.php';

class SocketServerRunCommand extends Command
{

	protected function configure()
	{
		$this
			->setName( 'socket-server:run' )
			->setDescription( 'Run the socket server' )
			->setHelp( 'This should not be started directly from the command line' )
			->setHidden( TRUE );
	}

	protected function execute( InputInterface $input, OutputInterface $output )
	{
		$logger = new Logger( 'Vortex Socket Server' );
		$logger->pushHandler( new StreamHandler( 'logs/socket_server.log', Logger::DEBUG ) );
		$bridge = new ConnectionBridge( $logger );

		$logger->info( 'Creating socket servers' );

		$loop = EventLoopFactory::create();
		$dbg  = new SocketServer( '0.0.0.0:9000', $loop );
		$ws   = new SocketServer( '0.0.0.0:3001', $loop );

		$wsStack = new HttpServer(
			new WsServer(
				new WsApp( $bridge, $logger )
		) );

		$DbgApp = new IoServer( new DbgpApp( $bridge, $logger ), $dbg, $loop );
		$wsApp  = new IoServer( $wsStack, $ws, $loop );

		$logger->info( 'Entering run loop' );

		$loop->run();
	}
}
