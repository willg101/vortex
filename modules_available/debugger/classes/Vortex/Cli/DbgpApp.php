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
			if ( count( $this->queue ) < static::MAX_QUEUE_LENGTH )
			{
				$this->queue[ "c$conn->resourceId" ] = [
					'connection' => $conn,
					'uuid'       => get_random_token( 10 ),
					'messages'   => [],
				];
			}
			else
			{
				$this->logger->debug( "The queue is full; dropping $name" );
				$conn->close();
				return;
			}

			if ( $this->bridge->hasDbgConnection() )
			{
				$this->logger->debug( "A debug session is currently active; enqueuing $name" );

				$data = [
					'connection' => $conn,
					'messages'   => &$this->queue[ "c$conn->resourceId" ][ 'messages' ],
					'logger'     => $this->logger,
				];
				fire_hook( 'dbg_connection_queued', $data );
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
		$keys  = array_keys( $this->queue );
		$first = reset( $keys );
		return array_map( function( $key, $value ) use( &$first )
		{
			$el = array_get( $value, 'messages.0', FALSE );

			$this->logger->debug( var_export( array_diff_key( $value, ['connection' => '' ] ), TRUE ) );

			$is_first = $first == $key;
			$hostname = gethostbyaddr( $value[ 'connection' ]->remoteAddress ) ?: $value[ 'connection' ]->remoteAddress;
			return '<queuedsession active="' . ( $is_first ? 'true' : 'false' ) . '" uuid="' . $value[ 'uuid' ] . '" host="' . $hostname . '" session-id="' . $key . '" path="' . $value[ 'filename' ] . '"></queuedsession>';
		}, $keys, $this->queue );
	}

	public function beforeDetach( ConnectionInterface $conn )
	{
		$data = [ 'connection' => $conn ];
		fire_hook( 'before_debugger_detach', $data );
	}

	public function detachQueuedSession( $sid )
	{
		if ( !empty( $this->queue[ $sid ] ) )
		{
			if ( $this->queue[ $sid ][ 'connection' ] == $this->bridge->getDbgConnection() )
			{
				$this->bridge->sendToDbg( "detach -i 0 \0" );
				return;
			}
			$this->beforeDetach( $this->queue[ $sid ][ 'connection' ] );
			$this->queue[ $sid ][ 'connection' ]->send( "detach -i 0\0" );
			$this->queue[ $sid ][ 'connection' ]->close();
			unset( $this->queue[ $sid ] );
		}
	}

	public function switchSession( $sid, $current_connection )
	{
		if ( !empty( $this->queue[ $sid ] ) )
		{
			$this->logger->debug( "Bumping connection #$sid to front of queue" );
			$new = $this->queue[ $sid ];
			unset( $this->queue[ $sid ] );
			$this->queue = array_merge( [ $sid => $new ], $this->queue );
			$this->logger->debug( "Bridging connection ($sid)" );
			$this->bridgeConnection( $new[ 'connection' ] );
			$this->logger->debug( "Queued connection {$sid} has " . count( $new[ 'messages' ] ) . ' messages waiting.' );
			$this->bridge->sendToWs( '<wsserver status="session_change"></wsserver>' );
			while ( $msg = array_shift( $new[ 'messages' ] ) )
			{
				$this->bridge->sendToWs( $msg );
			}
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
				array_shift( $this->queue );
				if ( $this->queue )
				{
					$next = reset( $this->queue );
					$sid = $next[ 'connection' ]->resourceId;
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
		else if ( isset( $this->queue[ "c$conn->resourceId" ] ) )
		{
			unset( $this->queue[ "c$conn->resourceId" ] );
			$this->bridge->sendToWs( '<wsserver session-status-change=neutral status="alert" type="peek_queue">' . implode( '', $this->peekQueue() ) . "</wsserver>" );
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
					$root = @simplexml_load_string( $root );
					if ( empty( $this->queue[ "c$conn->resourceId" ][ 'filename' ] )
						&& !empty( $root[ 'fileuri' ] ) )
					{
						$this->queue[ "c$conn->resourceId" ][ 'filename' ] = $root[ 'fileuri' ];
					}

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
				$this->logger->error( array_get( explode( "\0", $msg ), 1 ) );
				$this->logger->error( 'Exception in ' . __CLASS__ . '::' . __FUNCTION__ . '(): ' . $e );
			}
		}
		else
		{
			$conn->send( "detach -i 0\0" );
			$conn->close();
		}

		$current_connection = $this->queue ? reset( $this->queue )[ 'connection' ] : NULL;
		if ( !empty( $this->queue[ "c$conn->resourceId" ] ) && $current_connection != $conn )
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
