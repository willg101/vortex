<?php

namespace Vortex\Cli;

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
use Psr\Log\LoggerInterface;
use Exception;

class WsApp implements MessageComponentInterface
{
	protected $bridge;
	protected $logger;

	public function __construct( ConnectionBridge $bridge, LoggerInterface $logger )
	{
		$this->bridge = $bridge;
		$this->logger = $logger;
	}

	public function onOpen( ConnectionInterface $conn )
	{
		$name = "websocket connection $conn->resourceId";
		$this->logger->debug( "Connection opened: $name" );
		$cookies = parse_cookie_str( array_get( $conn->httpRequest->getHeader( 'Cookie' ),  0 ) );
		$this->logger->debug( "Connection" , (array) $cookies );

		if ( !$this->bridge->hasWsConnection() )
		{
			$this->bridge->setWsConnection( $conn );
			$this->bridge->sendToWs( '<wsserver status="connection_accepted"></wsserver>' );
		}
		else
		{
			$conn->send( "50\0<wsserver status=\"no_exclusive_access\"></wsserver>\0" );
			$this->logger->debug( "We already have a websocket connection; dropping $name" );
			$conn->close();
		}

		$data = [
			'connection' => $conn,
			'bridge'     => $this->bridge,
			'logger'     => $this->logger,
		];
		fire_hook( 'ws_connection_opened', $data );
	}

	public function onClose( ConnectionInterface $conn )
	{
		$data = [
			'connection' => $conn,
			'bridge'     => $this->bridge,
			'logger'     => $this->logger,
		];
		fire_hook( 'ws_connection_closed', $data );

		$this->bridge->clearWsConnection( $conn );
	}

	public function onMessage( ConnectionInterface $conn, $msg )
	{
		$data = [
			'message'    => $msg,
			'connection' => $conn,
			'bridge'     => $this->bridge,
			'logger'     => $this->logger,
			'abort'      => FALSE,
		];
		fire_hook( 'ws_message_received', $data );

		if ( preg_match( '/^ctrl:stop /', $data[ 'message' ] ) )
		{
			fire_hook( 'stop_socket_server' );
			$this->logger->info( "Received stop command; killing server" );
			exit( 'stop' );
		}
		elseif ( preg_match( '/^ctrl:restart /', $data[ 'message' ] ) )
		{
			fire_hook( 'restart_socket_server' );
			$this->logger->info( "Received restart command; restarting server" );
			exit( 'restart' );
		}
		elseif ( preg_match( '/^ctrl:peek_queue /', $data[ 'message' ] ) )
		{
			$this->bridge->sendToWs( '<wsserver session-status-change=neutral status="alert" type="peek_queue">' . implode( '', $this->bridge->peekQueue() ) . "</wsserver>" );
			return;
		}
		elseif ( preg_match( '/^ctrl:detach_queued_session -s (?<id>\d+) /', $data[ 'message' ], $match ) )
		{
			$this->bridge->detachQueuedSession( $match[ 'id' ] );
			$this->bridge->sendToWs( '<wsserver session-status-change=neutral status="alert" type="detach_queued_session" session_id="' . $match[ 'id' ] . '">' );
			return;
		}
		elseif ( preg_match( '/^ctrl:switch_session -s (?<id>\d+) /', $data[ 'message' ], $match ) )
		{
			$this->bridge->switchSession( $match[ 'id' ] );
		}

		if ( !$data[ 'abort' ] && $data[ 'message' ] )
		{
			$this->bridge->sendToDbg( $data[ 'message' ] . "\0" );
		}
	}

	public function onError( ConnectionInterface $conn, Exception $e )
	{
		$this->logger->error( "Error with ws connection $conn->resourceId: $e" );
		$conn->close();
	}
}
