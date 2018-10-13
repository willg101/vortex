<?php

namespace Vortex\Cli;

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
use Exception;

class DbgpApp implements MessageComponentInterface, DbgpConnectionQueueEventHandler
{
	/**
	 * See DbgpApp::getConnectionId()
	 *
	 * @var string
	 */
	const CONNECTION_ID_PREFIX = 'c';

	/**
	 * @brief
	 *	Max number of sessions that can be enqueued (additional connections are dropped)
	 *
	 * @var int
	 */
	const MAX_QUEUE_LENGTH = 32;

	/**
	 * @brief
	 *	Generate an html-attribute-safe identifier for a connection
	 *
	 * @param Ratchet\ConnectionInterface $conn
	 *
	 * @return string
	 */
	public static function getConnectionId( ConnectionInterface $conn )
	{
		return static::CONNECTION_ID_PREFIX . $conn->resourceId;
	}

	/**
	 * @brief
	 *	Prepare a message to be sent to the DE by ensuring that the message ends with a null char
	 *
	 * @note See https://xdebug.org/docs-dbgp.php#message-packets
	 *
	 * @param string $msg
	 * @return string
	 */
	public static function prepareMessage( $msg )
	{
		if ( !strpos( $msg, "\0" ) !== mb_strlen( $msg ) - 1 )
		{
			$msg .= "\0";
		}
		return $msg;
	}

	/**
	 * @var \Vortex\Cli\ConnectionBridge
	 */
	protected $bridge;

	/**
	 * @var Vortex\Cli\DbgpConnectionQueue
	 */
	protected $queue;

	/**
	 * @param ConnectionBridge $bridge
	 */
	public function __construct( ConnectionBridge $bridge )
	{
		$this->bridge = $bridge;
		$bridge->registerDbgApp( $this );
		$this->queue = new DbgpConnectionQueue( static::MAX_QUEUE_LENGTH, $this );
	}

	###############################################################################################
	## BEGIN Methods for interface DbgpConnectionQueueEventHandler
	###############################################################################################

	public function onNewConnectionFocused( ConnectionInterface $conn, $id )
	{
		$this->bridgeConnection( $conn );
	}

	public function onNewConnectionQueued( ConnectionInterface $conn, $id )
	{
		logger()->debug( "A debug session is currently active; enqueuing $id" );

		$data = [
			'connection' => $conn,
			'id'         => $id,
		];
		fire_hook( 'dbg_connection_queued', $data );
		$this->bridge->sendToWs( $this->getQueueAsXml() );
	}

	public function onNewConnectionDiscarded( ConnectionInterface $conn, $id )
	{
		logger()->debug( "The queue is full; dropping $id" );
		$conn->close();
	}

	public function onExistingConnectionFocused( ConnectionInterface $conn, $id )
	{
		$this->transitionToNewSession( $conn, $id );
	}

	###############################################################################################
	## END Methods for interface DbgpConnectionQueueEventHandler
	###############################################################################################

	###############################################################################################
	## BEGIN Methods for interface MessageComponentInterface
	###############################################################################################

	public function onOpen( ConnectionInterface $conn )
	{
		$cid = static::getConnectionId( $conn );
		$name = "debug connection $cid";
		logger()->debug( "Connection opened: $name" );

		if ( $this->bridge->hasWsConnection() )
		{
			$this->queue->push( $conn, $cid );
		}
		else
		{
			logger()->debug( "We don't have a websocket client; dropping $name" );
			$conn->close();
		}
	}

	public function onClose( ConnectionInterface $conn )
	{
		$cid = static::getConnectionId( $conn );
		logger()->debug( "Connection closing: $cid" );
		if ( $this->bridge->getDbgConnection() == $conn )
		{
			logger()->debug( "This connection is the current connection ($cid)" );
			$data = [
				'connection' => $conn,
				'bridge'     => $this->bridge,
			];
			fire_hook( 'dbg_connection_closed', $data );

			logger()->debug( "Removing callback bridge" );
			$this->bridge->clearDbgConnection( $conn );

			if ( $this->bridge->hasWsConnection() )
			{
				logger()->debug( "Informing websocket client of disconnection" );
				$this->bridge->sendToWs( '<wsserver status="session_end"></wsserver>' );
				$this->queue->remove( $cid );
				if ( !$this->queue->isEmpty() )
				{
					$next = $this->queue->getTop();
					$this->transitionToNewSession( $next[ 'connection' ], $next[ 'connection_id' ] );
				}
			}
		}
		else if ( $this->queue->remove( $cid ) )
		{
			logger()->debug( "This connection is not the current connection ($cid)" );
			$this->bridge->sendToWs( $this->getQueueAsXml() );
		}
	}

	public function onMessage( ConnectionInterface $conn, $msg )
	{
		$cid = static::getConnectionId( $conn );
		if ( $this->bridge->hasWsConnection() )
		{
			try
			{
				$root = array_get( explode( "\0", $msg ), 1 );
				if ( $root )
				{
					$root = @simplexml_load_string( $root );
					if ( empty( $this->queue->get( $cid )[ 'filename' ] )
						&& !empty( $root[ 'fileuri' ] ) )
					{
						$this->queue->setFilename( $cid, $root[ 'fileuri' ] );
					}

					if ( !empty( $root[ 'fileuri' ] ) && is_readable( $root[ 'fileuri' ] ) )
					{
						$file_contents = file_get_contents( $root[ 'fileuri' ] );
						if ( preg_match( '#^<\?php\s*/\*\s*(dpoh|vortex):\s*ignore\s*\*/#', $file_contents ) )
						{
							logger()->debug( "$root[fileuri] is marked to be ignored; detaching" );
							$this->queue->remove( $cid );
							$conn->close();
							$this->bridge->sendToWs( $this->getQueueAsXml() );
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
			$conn->send( static::prepareMessage( "detach -i 0" ) );
			$conn->close();
		}

		$current_connection = $this->queue->getTop();
		if ( $current_connection && $current_connection[ 'connection' ] != $conn )
		{
			$msg = array_get( explode( "\0", $msg ), 1 );
			if ( $msg )
			{
				if ( $this->queue->stashMessage( $cid, $msg ) == 1 )
				{
					$this->bridge->sendToWs( $this->getQueueAsXml() );
				}
				logger()->debug( "Stashing message from queued connection $cid" );
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
		$cid = static::getConnectionId( $conn );
		logger()->error( "Error with debug connection $cid: $e" );
		$conn->close();
	}

	###############################################################################################
	## END Methods for interface DbgpConnectionQueueEventHandler
	###############################################################################################

	/**
	 * @return string
	 *	An xml fragment in which the root element is a wsserver element and contains one child for
	 *	each queued connection
	 */
	public function getQueueAsXml()
	{
		$xml = '';
		foreach ( $this->queue->listAll() as $conn_id => $conn_info )
		{
			$conn_info[ 'path' ]       = $conn_info[ 'filename' ];
			$conn_info[ 'active' ]     = $conn_info[ 'active' ] ? 'true' : 'false';
			unset( $conn_info[ 'filename' ], $conn_info[ 'connection' ] );
			$xml .= '<queuedsession ' . html_attrs( $conn_info ) . '"></queuedsession>';
		}
		return '<wsserver session-status-change=neutral status="alert" type="peek_queue">' . $xml
			. "</wsserver>";
	}

	/**
	 * @brief
	 *	Fires a hook prior to detaching the connection
	 *
	 * @param ConnectionInterface $conn
	 */
	public function beforeDetach( ConnectionInterface $conn )
	{
		$cid = $this->getConnectionId( $conn );
		$data = [
			'connection' => $conn,
			'id'         => $cid,
		];
		fire_hook( 'before_debugger_detach', $data );
	}

	/**
	 * @param string $cid
	 */
	public function detachQueuedSession( $cid )
	{
		logger()->debug( "Detaching queued session $cid" );
		$connection = $this->queue->remove( $cid );
		if ( $connection )
		{
			$connection = $connection[ 'connection' ];
			$this->beforeDetach( $connection );
			$connection->send( static::prepareMessage( "detach -i 0" ) );
			$connection->close();
		}
		else
		{
			logger()->debug( "Queued session $cid does not exist" );
		}
	}

	/**
	 * @param string $cid
	 */
	public function switchSession( $cid )
	{
		$this->queue->focus( $cid );
	}

	/**
	 * @param ConnectionInterface $conn
	 * @param string              $id
	 */
	protected function transitionToNewSession( ConnectionInterface $conn, $id )
	{
		logger()->debug( "Transitioning to session $id" );
		$this->bridgeConnection( $conn );
		$info = $this->queue->get( $id );
		logger()->debug( "Queued connection {$id} has " . count( $info[ 'messages' ] )
			. ' message(s) waiting.' );
		$this->bridge->sendToWs( '<wsserver status="session_change"></wsserver>' );
		while ( $msg = array_shift( $info[ 'messages' ] ) )
		{
			$this->bridge->sendToWs( $msg );
		}
	}

	/**
	 * @param ConnectionInterface $conn
	 * @param string              $id
	 */
	protected function bridgeConnection( ConnectionInterface $conn )
	{
		$this->bridge->setDbgConnection( $conn );
		$data = [
			'connection' => $conn,
			'bridge'     => $this->bridge,
		];
		fire_hook( 'dbg_connection_opened', $data );
	}
}
