<?php

namespace Vortex\Cli;

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
use Exception;

class WsApp implements MessageComponentInterface
{
	/**
	 * @brief
	 *	Prepare a message to be sent to the websocket client by ensuring that the message is in the
	 *	correct format
	 *
	 * @note See https://xdebug.org/docs-dbgp.php#message-packets
	 *
	 * @param string $msg
	 * @retval string
	 */
	public static function prepareMessage( $msg )
	{
		if ( !preg_match( '/\d+\0[^\0]+\0/', $msg ) )
		{
			$msg = str_replace( "\0", '', $msg );
			$msg = mb_strlen( $msg ) . "\0$msg\0";
		}
		return $msg;
	}

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

	public function __construct( ConnectionBridge $bridge )
	{
		$this->bridge = $bridge;
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
		logger()->debug( "Connection opened: $name" );

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
			$conn->send( static::prepareMessage( '<wsserver status="no_exclusive_access"></wsserver>' ) );
			logger()->debug( "We already have a websocket connection; ignoring $name" );
			return;
		}

		$data = [
			'connection' => $conn,
			'bridge'     => $this->bridge,
		];
		fire_hook( 'ws_connection_opened', $data );
	}

	public function onClose( ConnectionInterface $conn )
	{
		if ( $conn != $this->bridge->getWsConnection() )
		{
			return;
		}

		$data = [
			'connection' => $conn,
			'bridge'     => $this->bridge,
		];
		fire_hook( 'ws_connection_closed', $data );

		$this->bridge->clearWsConnection( $conn );
	}

	public function onMessage( ConnectionInterface $conn, $msg )
	{
		if ( $conn != $this->bridge->getWsConnection() )
		{
			$conn->close();
			return;
		}

		$data = [
			'message'    => $msg,
			'connection' => $conn,
			'bridge'     => $this->bridge,
			'abort'      => strpos( $msg, 'X-' ) === 0, // By default, don't forward messages beginning with 'X-'
		];
		fire_hook( 'ws_message_received', $data );

		if ( !$data[ 'abort' ] && $data[ 'message' ] )
		{
			$this->bridge->sendToDbg( $data[ 'message' ] );
		}
	}

	public function onError( ConnectionInterface $conn, Exception $e )
	{
		logger()->error( "Error with ws connection $conn->resourceId: $e" );
		$conn->close();
	}
}
