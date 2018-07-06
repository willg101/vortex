<?php

namespace Vortex\Cli;

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
use Psr\Log\LoggerInterface;
use Exception;

class WsApp implements MessageComponentInterface
{
	/**
	 * @var \Vortex\Cli\ConnectionBridge
	 */
	protected $bridge;

	/**
	 * @var \Psr\Log\LoggerInterface
	 */
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

		// Parse cookies in order to authenticate the user
		$cookies = parse_cookie_str( array_get( $conn->httpRequest->getHeader( 'Cookie' ),  0 ) );
		$this->logger->debug( "Connection" , (array) $cookies );

		if ( !$this->bridge->hasWsConnection() )
		{
			$this->bridge->setWsConnection( $conn );
			$this->bridge->sendToWs( '<wsserver status="connection_accepted"></wsserver>' );
		}
		else // An active web socket already exists
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
