<?php

namespace Vortex\Cli;

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
use Psr\Log\LoggerInterface;
use Exception;

class DbgpApp implements MessageComponentInterface
{
	/**
	 * @brief
	 *	Max number of sessions that can be enqueued (additional connections are dropped)
	 *
	 * @var int
	 */
	const MAX_QUEUE_LENGTH = 32;

	/**
	 * @var \Vortex\Cli\ConnectionBridge
	 */
	protected $bridge;

	/**
	 * @var \Ratchet\ConnectionInterface
	 */
	protected $ws_connection;

	/**
	 * @var Psr\Log\LoggerInterface
	 */
	protected $logger;

	/**
	 * @var array
	 */
	protected $queue = [];

	public function __construct( ConnectionBridge $bridge, LoggerInterface $logger )
	{
		$this->bridge = $bridge;
		$this->logger = $logger;

		$bridge->registerDbgApp( $this );
	}

	public function onOpen( ConnectionInterface $conn )
	{
		$name = "debug connection $conn->resourceId";
		$this->logger->debug( "Connection opened: $name" );

		if ( $this->bridge->hasWsConnection() )
		{
			if ( $this->bridge->hasDbgConnection() )
			{
				$this->logger->debug( "A debug session is currently active; enqueuing $name" );
				if ( count( $this->queue ) < static::MAX_QUEUE_LENGTH )
				{
					$this->queue[ "c$conn->resourceId" ] = [
						'connection' => $conn,
						'messages'   => [],
					];

					$data = [
						'connection' => $conn,
						'messages'   => &$this->queue[ "c$conn->resourceId" ][ 'messages' ],
						'logger'     => $this->logger,
					];
					fire_hook( 'dbg_connection_queued', $data );
				}
				else
				{
					$this->logger->debug( "The queue is full; dropping $name" );
					$conn->close();
				}
			}
			else
			{
				$this->bridgeConnection( $conn );
			}
		}
		else
		{
			$this->logger->debug( "We don't have a websocket client; dropping $name" );
			$conn->close();
		}
	}

	public function peekQueue()
	{
		return array_map( function( $key, $value )
		{
			$el   = array_get( $value, 'messages.0', FALSE );

			$root = !$el ?: ( array_get( simplexml_load_string( $el ), 'fileuri' ) ?: simplexml_load_string( $el )->stack[ 0 ][ 'filename' ] );
			$hostname = gethostbyaddr( $value[ 'connection' ]->remoteAddress ) ?: $value[ 'connection' ]->remoteAddress;
			return '<queuedsession host="' . $hostname . '" session-id="' . $key . '" path="' . $root . '"></queuedsession>';
		}, array_keys( $this->queue ), $this->queue );
	}

	public function detachQueuedSession( $sid )
	{
		if ( !empty( $this->queue[ $sid ] ) )
		{
			$this->queue[ "c$sid" ][ 'connection' ]->send( "detach -i 0\0" );
			$this->queue[ "c$sid" ][ 'connection' ]->close();
			unset( $this->queue[ "c$sid" ] );
		}
	}

	public function switchSession( $sid, $current_connection )
	{
		if ( !empty( $this->queue[ "$sid" ] ) )
		{
			$this->logger->debug( "Bumping connection #$sid to front of queue" );
			$next = $this->queue[ "$sid" ];
			unset( $this->queue[ "$sid" ] );
			$this->queue = array_replace( $this->queue, [ "c$current_connection->resourceId" => [ 'connection' => $current_connection, 'messages' => [] ] ] );
			$this->logger->debug( "Pulling next connection off of queue ($sid)" );
			$this->bridgeConnection( $next[ 'connection' ] );
			$this->logger->debug( "Queued connection {$sid} has " . count( $next[ 'messages' ] ) . ' messages waiting.' );
			$this->bridge->sendToWs( '<wsserver status="session_change"></wsserver>' );
			while ( $msg = array_shift( $next[ 'messages' ] ) )
			{
				$this->bridge->sendToWs( $msg );
			}
			$current_connection->send( "stack_get -i 0\0" );
		}
	}

	protected function bridgeConnection( $conn )
	{
		$this->bridge->setDbgConnection( $conn );
		$data = [
			'connection' => $conn,
			'bridge'     => $this->bridge,
			'logger'     => $this->logger,
		];
		fire_hook( 'dbg_connection_opened', $data );
		$this->ws_connection = $conn;
	}

	public function onClose( ConnectionInterface $conn )
	{
		if ( $this->ws_connection == $conn )
		{
			$data = [
				'connection' => $conn,
				'bridge'     => $this->bridge,
				'logger'     => $this->logger,
			];
			fire_hook( 'dbg_connection_closed', $data );

			$this->logger->debug( "Removing callback bridge" );
			$this->bridge->clearDbgConnection( $conn );
			$this->ws_connection = FALSE;

			if ( $this->bridge->hasWsConnection() )
			{
					$this->logger->debug( "Informing websocket client of disconnection" );
					$this->bridge->sendToWs( '<wsserver status="session_end"></wsserver>' );
				if ( $next = array_shift( $this->queue ) )
				{
					$this->logger->debug( "Pulling next connection off of queue ({$next[ 'connection' ]->resourceId})" );
					$this->bridgeConnection( $next[ 'connection' ] );
					$this->logger->debug( "Queued connection {$next[ 'connection' ]->resourceId} has " . count( $next[ 'messages' ] ) . ' messages waiting.' );
					while ( $msg = array_shift( $next[ 'messages' ] ) )
					{
						$this->bridge->sendToWs( $msg );
					}
				}
			}
		}
	}

	public function onMessage( ConnectionInterface $conn, $msg )
	{
		if ( $this->bridge->hasWsConnection() )
		{
			try
			{
				$root = array_get( explode( "\0", $msg ), 1 );
				if ( $root )
				{
					$root = simplexml_load_string( $root );
					if ( !empty( $root[ 'fileuri' ] ) && is_readable( $root[ 'fileuri' ] ) )
					{
						$file_contents = file_get_contents( $root[ 'fileuri' ] );
						if ( preg_match( '#^<\?php\s*/\*\s*(dpoh|vortex):\s*ignore\s*\*/#', $file_contents ) )
						{
							$this->logger->debug( "$root[fileuri] is marked to be ignored; detaching" );
							unset( $this->queue[ "c$conn->resourceId" ] );
							$conn->close();
							$this->bridge->sendToWs( '<wsserver session-status-change=neutral status="alert" type="peek_queue">' . implode( '', $this->peekQueue() ) . "</wsserver>" );
							return;
						}
					}
				}
			}
			catch ( Exception $e )
			{
				$this->logger->error( 'Exception in ' . __CLASS__ . '::' . __FUNCTION__ . '(): ' . $e );
			}
		}
		else
		{
			$conn->send( "detach -i 0\0" );
			$conn->close();
		}

		if ( !empty( $this->queue[ "c$conn->resourceId" ] ) )
		{
			$msg = array_get( explode( "\0", $msg ), 1 );
			if ( $msg )
			{
				$this->queue[ "c$conn->resourceId" ][ 'messages' ][] = $msg;
				if ( count( $this->queue[ "c$conn->resourceId" ][ 'messages' ] ) == 1 )
				{
					$this->bridge->sendToWs( '<wsserver session-status-change=neutral status="alert" type="peek_queue">' . implode( '', $this->peekQueue() ) . "</wsserver>" );
				}
				$this->logger->debug( "Stashing message from queued connection #$conn->resourceId" );
			}
			return;
		}

		$data = [
			'connection' => $conn,
			'message'    => $msg,
			'abort'      => FALSE,
			'bridge'     => $this->bridge,
			'logger'     => $this->logger,
		];
		fire_hook( 'dbg_message_received', $data );
		if ( !$data[ 'abort' ] && $data[ 'message' ] )
		{
			$this->bridge->sendToWs( $data[ 'message' ], TRUE );
		}

	}

	public function onError( ConnectionInterface $conn, Exception $e )
	{
		$this->logger->error( "Error with debug connection $conn->resourceId: $e" );
		$conn->close();
	}
}
