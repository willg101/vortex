<?php

namespace Vortex\Cli;

use Ratchet\ConnectionInterface;
use ReflectionClass;
use InvalidArgumentException;

class DbgpConnectionQueue
{
	protected static $valid_handlers = [
		'connection_focused'   => TRUE,
		'connection_queued'    => TRUE,
		'connection_discarded' => TRUE,
		'queue_rearranged'     => TRUE,
	];

	/**
	 * @brief
	 * All queued debug connections. The first element is the active connection (i.e., the
	 * connection that the user is interacting with).
	 *
	 * @note This is an ordered associative array, so $this->queue[ 0 ] does not necessarily exist,
	 * nor is it necessarily the first element.
	 *
	 * @var array
	 */
	protected $queue = [];

	/**
	 * @var int
	 */
	protected $max_connections;

	/**
	 * @var Vortex\Cli\DbgpConnectionQueueEventHandler
	 */
	protected $handler;

	/**
	 * @param int                             $max_connections
	 * @param DbgpConnectionQueueEventHandler $handler
	 */
	public function __construct( $max_connections, DbgpConnectionQueueEventHandler $handler )
	{
		$this->max_connections = $max_connections;
		$this->handler         = $handler;
	}

	/**
	 * @brief
	 *	Trigger an event handler on this instance's handler object
	 *
	 * @param string              $name The name of a method defined in the interface
	 *                                  `DbgpConnectionQueueEventHandler`
	 * @param ConnectionInterface $conn
	 * @param string              $id
	 */
	protected function triggerHandler( $name, ConnectionInterface $conn, $id )
	{
		static $valid_methods;
		if ( !$valid_methods )
		{
			$reflector = new ReflectionClass( DbgpConnectionQueueEventHandler::CLASS );
			foreach ( $reflector->getMethods() as $method )
			{
				$valid_methods[ $method->name ] = TRUE;
			}
		}

		$name = "on$name";
		if ( empty( $valid_methods[ $name ] ) )
		{
			throw new InvalidArgumentException( DbgpConnectionQueueEventHandler::CLASS
				. " does not include the method $name. Valid methods include "
				. implode( ', ', $$valid_methods ) );
		}
		$this->handler->$name( $conn, $id );
	}

	/**
	 * @retval array
	 */
	public function listAll()
	{
		if ( $this->isEmpty() )
		{
			return [];
		}

		$first = true;
		$return_val = $this->queue;
		foreach ( $return_val as &$info )
		{
			$info[ 'active' ] = $first;
			$first = FALSE;
		}
		return $return_val;
	}

	/**
	 * @brief
	 *	Add a connection to the end of the queue
	 *
	 * @param ConnectionInterface $conn
	 * @param string              $id   An arbitrary id for the connection; used to refer to the
	 *                                  connection in event handlers and this class' methods
	 */
	public function push( ConnectionInterface $conn, $id )
	{
		$n_connections = count( $this->queue );
		if ( $n_connections < $this->max_connections )
		{
			$hostname = gethostbyaddr( $conn->remoteAddress ) ?: $conn->remoteAddress;

			$this->queue[ $id ] = [
				'connection'    => $conn,
				'host'          => $hostname,
				'connection_id' => $id,
				'uuid'          => get_random_token( 10 ),
				'messages'      => [],
				'filename'      => '',
			];
			$this->triggerHandler( $n_connections ? 'NewConnectionQueued' : 'NewConnectionFocused',
				$conn, $id );
		}
		else
		{
			$this->triggerHandler( 'NewConnectionDiscarded', $conn, $id );
		}
	}

	/**
	 * @brief
	 *	Get the information for a single queued connection
	 *
	 * @param string $id
	 * @retval array
	 *	The connection's info, or an empty array if the connection is not in this queue
	 */
	public function get( $id )
	{
		$item = array_get( $this->queue, $id, [] );
		if ( $item )
		{
			$item[ 'active' ] = array_keys( $this->queue )[ 0 ] == $id;
		}
		return $item;
	}

	/**
	 * @retval array
	 *	The info for the first connection in this queue, or an empty array if the queue is empty
	 */
	public function getTop()
	{
		return $this->isEmpty() ? [] : reset( $this->queue );
	}

	/**
	 * @retval bool
	 */
	public function isEmpty()
	{
		return ! $this->queue;
	}

	/**
	 * @param string $id
	 *
	 * @retval array
	 *	The removed connection's info, or an empty array if the connection was not in this queue
	 */
	public function remove( $id )
	{
		if ( !empty( $this->queue[ $id ] ) )
		{
			$tmp = $this->queue[ $id ];
			unset( $this->queue[ $id ] );
			return $tmp;
		}
		else
		{
			return [];
		}
	}

	/**
	 * @param string $id
	 * @param string $filename
	 */
	public function setFilename( $id, $filename )
	{
		if ( $this->get( $id ) )
		{
			$this->queue[ $id ][ 'filename' ] = $filename;
		}
		else
		{
			throw new InvalidArgumentException( "Can't set filename for connection `$id`: the "
				. "connection does not exist" );
		}
	}

	/**
	 * @param string $id
	 * @param string $message
	 *
	 * @retval int
	 */
	public function stashMessage( $id, $msg )
	{
		if ( !empty( $this->queue[ $id ] ) )
		{
			logger()->debug( "Stashing message '$msg' for connection $id" );
			$this->queue[ $id ][ 'messages' ][] = $msg;
			return count( $this->queue[ $id ][ 'messages' ] );
		}
		else
		{
			throw new InvalidArgumentException( "Can't stash message for connection `$id`: the "
				. "connection does not exist" );
		}
	}

	/**
	 * @brief
	 *	Move a connection to the front of the queue
	 *
	 * @param string $id
	 */
	public function focus( $id )
	{
		if ( !empty( $this->queue[ $id ] ) )
		{
			logger()->debug( "Bumping connection `$id` to front of queue" );
			$new = $this->queue[ $id ];
			unset( $this->queue[ $id ] );
			$this->queue = array_merge( [ $id => $new ], $this->queue );
			$this->triggerHandler( 'ExistingConnectionFocused', $this->queue[ $id ][ 'connection' ],
				$id );
			$this->queue[ $id ][ 'messages' ] = [];
		}
	}
}

