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
	 * During a commandeer operation, stores the unique token that the request must include in
	 * order to claim exclusive access (a NULL value indicates that no commandeer operation is in
	 * progess)
	 *
	 * @var string|NULL
	 */
	protected $commandeer_token;

	/**
	 * @var \Psr\Log\LoggerInterface
	 */
	protected $logger;

	public function __construct( ConnectionBridge $bridge, LoggerInterface $logger )
	{
		$this->bridge = $bridge;
		$this->logger = $logger;
	}

	/**
	 * @brief
	 *	Handle "maintenance," or internal, requests
	 *
	 * @param Ratchet\ConnectionInterface $conn
	 * @param array                       $params GET params sent with the WS request
	 *
	 * @retval bool
	 *	Indicates if the request was handled (and thus the connection should be closed)
	 */
	protected function handleMaintenanceRequest( ConnectionInterface $conn, array $params )
	{
		if ( validate_maintenance_token( array_get( $params, 'security_token' ) ) )
		{
			$action = array_get( $params, 'action' );
			switch ( $action )
			{
				case 'commandeer':
					if ( $this->bridge->hasWsConnection() )
					{
						$this->bridge->sendToWs( '<wsserver status="session_commandeered"></wsserver>' );
						$this->bridge->clearWsConnection();
					}
					$this->commandeer_token = get_random_token( 10 );
					$conn->send( json_encode( [ 'commandeer_token' => $this->commandeer_token ] ) );
					$conn->close();
					break;

				default:
					$conn->send( json_encode( [ 'error' => "Unknown maintenance action '$action'" ] ) );
					$conn->close();
					break;
			}
			return TRUE;
		}

		return FALSE;
	}

	public function onOpen( ConnectionInterface $conn )
	{
		$name = "websocket connection $conn->resourceId";
		$this->logger->debug( "Connection opened: $name" );

		$params = [];
		parse_str( $conn->httpRequest->getUri()->getQuery(), $params );

		if ( $this->handleMaintenanceRequest( $conn, $params ) )
		{
			return;
		}

		if ( !$this->bridge->hasWsConnection() && ( !$this->commandeer_token
			|| $this->commandeer_token == array_get( $params, 'commandeer_token' ) ) )
		{
			$this->commandeer_token = FALSE;
			$this->bridge->setWsConnection( $conn );
			$this->bridge->sendToWs( '<wsserver status="connection_accepted"></wsserver>' );
		}
		else // An active web socket already exists
		{
			$conn->send( "50\0<wsserver status=\"no_exclusive_access\"></wsserver>\0" );
			$this->logger->debug( "We already have a websocket connection; dropping $name" );
			sleep( 1 ); // Give the message to the ws client a chance to send before closing
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
			'abort'      => strpos( $msg, 'X-' ) === 0, // By default, don't forward messages beginning with 'X-'
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
