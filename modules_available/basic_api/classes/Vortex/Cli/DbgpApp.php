<?php

namespace Vortex\Cli;

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
use SplObjectStorage;
use Psr\Log\LoggerInterface;
use Exception;

class DbgpApp implements MessageComponentInterface
{
	const MAX_QUEUE_LENGTH = 32;

	protected $bridge;
	protected $connected_to_client;
	protected $logger;
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
					$this->queue[ $conn->resourceId ] = [
						'connection' => $conn,
						'messages'   => [],
					];

					$data = [
						'connection' => $conn,
						'messages'   => &$this->queue[ $conn->resourceId ][ 'messages' ],
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
			$root = array_get( simplexml_load_string( $el ), 'fileuri' );
			return '<queuedsession session-id="' . $key . '" path="' . $root . '"></queuedsession>';
		}, array_keys( $this->queue ), $this->queue );
	}

	public function switchSession( $sid )
	{
		if ( !empty( $this->queue[ $sid ] ) )
		{
			$this->bridge->sendToDbg( 'detach -i 0' );
			$this->logger->debug( "Instructing current connection to detach" );
			$next = $this->queue[ $sid ];
			unset( $this->queue[ $sid ] );
			$this->queue = array_merge( [ $sid => $next ], $this->queue );
			$this->logger->debug( "Bumping connection #$sid to front of queue" );
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
		$this->connected_to_client = $conn;
	}

	public function onClose( ConnectionInterface $conn )
	{
		if ( $this->connected_to_client == $conn )
		{
			$data = [
				'connection' => $conn,
				'bridge'     => $this->bridge,
				'logger'     => $this->logger,
			];
			fire_hook( 'dbg_connection_closed', $data );

			$this->logger->debug( "Removing callback bridge" );
			$this->bridge->clearDbgConnection( $conn );
			$this->connected_to_client = FALSE;

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
		if ( !empty( $this->queue[ $conn->resourceId ] ) )
		{
			$msg = array_get( explode( "\0", $msg ), 1 );
			if ( $msg )
			{
				$this->queue[ $conn->resourceId ][ 'messages' ][] = $msg;
				if ( count( $this->queue[ $conn->resourceId ][ 'messages' ] ) == 1 )
				{
					$this->bridge->sendToWs( '<wsserver session-status-change=neutral status="alert" type="peek_queue">' . implode( '', $this->peekQueue() ) . "</wsserver>" );
				}
				$this->logger->debug( "Stashing message from queued connection #$conn->resourceId" );
			}
			return;
		}

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
						if ( preg_match( '#^<?php /\*(dpoh|vortex):ignore\*/#', $file_contents ) )
						{
							$this->logger->debug( "$root[fileuri] is marked to be ignored; detaching" );
							$conn->close();
						}
					}
				}
			}
			catch ( Exception $e )
			{
				$this->logger->error( 'Exception in ' . __CLASS__ . '::' . __FUNCTION__ . '(): ' . $e );
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
		else
		{
			$conn->send( "detach -i 0\0" );
			$conn->close();
		}
	}

	public function onError( ConnectionInterface $conn, Exception $e )
	{
		$this->logger->error( "Error with debug connection $conn->resourceId: $e" );
		$conn->close();
	}
}
