<?php

namespace Vortex\Cli;

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
use Exception;

class DbgpApp implements MessageComponentInterface
{
	const CONNECTION_ID_PREFIX = 'c';

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
	 * @var array
	 */
	protected $queue = [];

	public function __construct( ConnectionBridge $bridge )
	{
		$this->bridge = $bridge;

		$bridge->registerDbgApp( $this );
	}

	/**
	 * @brief
	 *	Generate an html-attribute-safe identifier for a connection
	 *
	 * @param Ratchet\ConnectionInterface $conn
	 *
	 * @retval string
	 */
	protected function getConnectionId( ConnectionInterface $conn )
	{
		return static::CONNECTION_ID_PREFIX . $conn->resourceId;
	}

	public function onOpen( ConnectionInterface $conn )
	{
		$cid = $this->getConnectionId( $conn );
		$name = "debug connection $cid";
		logger()->debug( "Connection opened: $name" );

		if ( $this->bridge->hasWsConnection() )
		{
			if ( count( $this->queue ) < static::MAX_QUEUE_LENGTH )
			{
				$this->queue[ $cid ] = [
					'connection' => $conn,
					'uuid'       => get_random_token( 10 ),
					'messages'   => [],
				];
			}
			else
			{
				logger()->debug( "The queue is full; dropping $name" );
				$conn->close();
				return;
			}

			if ( $this->bridge->hasDbgConnection() )
			{
				logger()->debug( "A debug session is currently active; enqueuing $name" );

				$data = [
					'connection' => $conn,
					'messages'   => &$this->queue[ $cid ][ 'messages' ],
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
			logger()->debug( "We don't have a websocket client; dropping $name" );
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

			logger()->debug( var_export( array_diff_key( $value, [ 'connection' => '' ] ), TRUE ) );

			$is_first = $first == $key;
			$hostname = gethostbyaddr( $value[ 'connection' ]->remoteAddress ) ?: $value[ 'connection' ]->remoteAddress;
			return '<queuedsession ' . html_attrs( [
				'active'     => $is_first ? 'true' : 'false',
				'uuid'       => $value[ 'uuid' ],
				'host'       => $hostname,
				'session-id' => $key,
				'path'       => $value[ 'filename' ],
			] ) . '"></queuedsession>';
		}, $keys, $this->queue );
	}

	public function beforeDetach( ConnectionInterface $conn )
	{
		$data = [ 'connection' => $conn ];
		fire_hook( 'before_debugger_detach', $data );
	}

	public function detachQueuedSession( $cid )
	{
		if ( !empty( $this->queue[ $cid ] ) )
		{
			if ( $this->queue[ $cid ][ 'connection' ] == $this->bridge->getDbgConnection() )
			{
				$this->bridge->sendToDbg( "detach -i 0 \0" );
				return;
			}
			$this->beforeDetach( $this->queue[ $cid ][ 'connection' ] );
			$this->queue[ $cid ][ 'connection' ]->send( "detach -i 0\0" );
			$this->queue[ $cid ][ 'connection' ]->close();
			unset( $this->queue[ $cid ] );
		}
	}

	public function switchSession( $cid, $current_connection )
	{
		if ( !empty( $this->queue[ $cid ] ) )
		{
			logger()->debug( "Bumping connection #$cid to front of queue" );
			$new = $this->queue[ $cid ];
			unset( $this->queue[ $cid ] );
			$this->queue = array_merge( [ $cid => $new ], $this->queue );
			logger()->debug( "Bridging connection ($cid)" );
			$this->bridgeConnection( $new[ 'connection' ] );
			logger()->debug( "Queued connection {$cid} has " . count( $new[ 'messages' ] ) . ' messages waiting.' );
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
		];
		fire_hook( 'dbg_connection_opened', $data );
		$this->ws_connection = $conn;
	}

	public function onClose( ConnectionInterface $conn )
	{
		$cid = $this->getConnectionId( $conn );
		if ( $this->ws_connection == $conn )
		{
			$data = [
				'connection' => $conn,
				'bridge'     => $this->bridge,
			];
			fire_hook( 'dbg_connection_closed', $data );

			logger()->debug( "Removing callback bridge" );
			$this->bridge->clearDbgConnection( $conn );
			$this->ws_connection = FALSE;

			if ( $this->bridge->hasWsConnection() )
			{
				logger()->debug( "Informing websocket client of disconnection" );
				$this->bridge->sendToWs( '<wsserver status="session_end"></wsserver>' );
				array_shift( $this->queue );
				if ( $this->queue )
				{
					$next = reset( $this->queue );
					$cid = $next[ 'connection' ]->resourceId;
					logger()->debug( "Pulling next connection off of queue ({$next[ 'connection' ]->resourceId})" );
					$this->bridgeConnection( $next[ 'connection' ] );
					logger()->debug( "Queued connection {$next[ 'connection' ]->resourceId} has " . count( $next[ 'messages' ] ) . ' messages waiting.' );
					while ( $msg = array_shift( $next[ 'messages' ] ) )
					{
						$this->bridge->sendToWs( $msg );
					}
				}
			}
		}
		else if ( isset( $this->queue[ $cid ] ) )
		{
			unset( $this->queue[ $cid ] );
			$this->bridge->sendToWs( '<wsserver session-status-change=neutral status="alert" type="peek_queue">' . implode( '', $this->peekQueue() ) . "</wsserver>" );
		}
	}

	public function onMessage( ConnectionInterface $conn, $msg )
	{
		$cid = $this->getConnectionId( $conn );
		if ( $this->bridge->hasWsConnection() )
		{
			try
			{
				$root = array_get( explode( "\0", $msg ), 1 );
				if ( $root )
				{
					$root = @simplexml_load_string( $root );
					if ( empty( $this->queue[ $cid ][ 'filename' ] )
						&& !empty( $root[ 'fileuri' ] ) )
					{
						$this->queue[ $cid ][ 'filename' ] = $root[ 'fileuri' ];
					}

					if ( !empty( $root[ 'fileuri' ] ) && is_readable( $root[ 'fileuri' ] ) )
					{
						$file_contents = file_get_contents( $root[ 'fileuri' ] );
						if ( preg_match( '#^<\?php\s*/\*\s*(dpoh|vortex):\s*ignore\s*\*/#', $file_contents ) )
						{
							logger()->debug( "$root[fileuri] is marked to be ignored; detaching" );
							unset( $this->queue[ $cid ] );
							$conn->close();
							$this->bridge->sendToWs( '<wsserver session-status-change=neutral status="alert" type="peek_queue">' . implode( '', $this->peekQueue() ) . "</wsserver>" );
							return;
						}
					}
				}
			}
			catch ( Exception $e )
			{
				logger()->error( array_get( explode( "\0", $msg ), 1 ) );
				logger()->error( 'Exception in ' . __CLASS__ . '::' . __FUNCTION__ . '(): ' . $e );
			}
		}
		else
		{
			$conn->send( "detach -i 0\0" );
			$conn->close();
		}

		$current_connection = $this->queue ? reset( $this->queue )[ 'connection' ] : NULL;
		if ( !empty( $this->queue[ $cid ] ) && $current_connection != $conn )
		{
			$msg = array_get( explode( "\0", $msg ), 1 );
			if ( $msg )
			{
				$this->queue[ $cid ][ 'messages' ][] = $msg;
				if ( count( $this->queue[ $cid ][ 'messages' ] ) == 1 )
				{
					$this->bridge->sendToWs( '<wsserver session-status-change=neutral status="alert" type="peek_queue">' . implode( '', $this->peekQueue() ) . "</wsserver>" );
				}
				logger()->debug( "Stashing message from queued connection #$conn->resourceId" );
			}
			return;
		}

		$data = [
			'connection' => $conn,
			'message'    => $msg,
			'abort'      => FALSE,
			'bridge'     => $this->bridge,
		];
		fire_hook( 'dbg_message_received', $data );
		if ( !$data[ 'abort' ] && $data[ 'message' ] )
		{
			$this->bridge->sendToWs( $data[ 'message' ], TRUE );
		}

	}

	public function onError( ConnectionInterface $conn, Exception $e )
	{
		logger()->error( "Error with debug connection $conn->resourceId: $e" );
		$conn->close();
	}
}
