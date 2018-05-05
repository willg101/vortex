<?php

namespace Vortex\Cli;

use Ratchet\ConnectionInterface;
use Psr\Log\LoggerInterface;

class ConnectionBridge
{
	/**
	 * Connection to websocket client
	 *
	 * @var Ratchet\ConnectionInterface
	 */
	protected $ws_connection;

	/**
	 * Connection to debugger engine
	 *
	 * @var Ratchet\ConnectionInterface
	 */
	protected $dbg_connection;

	/**
	 * @var Vortex\Cli\DbgpApp
	 */
	protected $dbg_app;

	/**
	 * @var Psr\Log\LoggerInterface
	 */
	protected $logger;

	public function __construct( LoggerInterface $logger )
	{
		$this->logger = $logger;
	}

	/**
	 * @retval bool
	 */
	public function hasWsConnection()
	{
		return !!$this->ws_connection;
	}

	/**
	 * @retval bool
	 */
	public function hasDbgConnection()
	{
		return !!$this->dbg_connection;
	}

	public function setWsConnection( ConnectionInterface $conn )
	{
		$this->ws_connection = $conn;
	}

	public function setDbgConnection( ConnectionInterface $conn )
	{
		$this->dbg_connection = $conn;
	}

	/**
	 * @param  Ratchet\ConnectionInterface $conn OPTIONAL. When given, ONLY clears the websocket
	 *                                           connection if this param is the same as the current
	 *                                           connection.
	 */
	public function clearWsConnection( ConnectionInterface $conn = NULL )
	{
		if ( !$conn || $conn == $this->ws_connection )
		{
			$this->ws_connection = NULL;
		}
	}

	/**
	 * @param  Ratchet\ConnectionInterface $conn OPTIONAL. When given, ONLY clears the debugger
	 *                                           engine connection if this param is the same as the
	 *                                           current connection.
	 */
	public function clearDbgConnection( ConnectionInterface $conn = NULL )
	{
		if ( !$conn || $conn == $this->dbg_connection )
		{
			$this->dbg_connection = NULL;
		}
	}

	/**
	 * @brief
	 *	Send a message to our web socket client, if available
	 *
	 * @param string $msg
	 * @param bool   $raw OPTIONAL. Default is FALSE. When TRUE, wraps the message similar to how
	 *                    the debugger engine wraps its messages:
	 *                    <int: msg length> NULL <string: msg> NULL
	 */
	public function sendToWs( $msg, $raw = FALSE )
	{
		if ( $this->hasWsConnection() )
		{
			if ( !$raw )
			{
				$msg = mb_strlen( $msg ) . "\0$msg\0";
			}
			$this->ws_connection->send( $msg );
		}
	}

	/**
	 * @brief
	 *	Send a message to our debugger engine, if available
	 *
	 * @param string $msg
	 */
	public function sendToDbg( $msg )
	{
		if ( $this->hasDbgConnection() )
		{
			$this->dbg_connection->send( $msg );

			// Close & clear the debugger engine connection if this is a `stop` or `clear` command
			if ( preg_match( '/^(stop|detach) /', $msg ) )
			{
				$this->dbg_connection->close();
				$this->clearDbgConnection();
			}
		}
	}

	public function registerDbgApp( DbgpApp $app )
	{
		$this->dbg_app = $app;
	}

	/**
	 * @brief
	 *	Proxy calls to $this->dbg_app->peekQueue(), returning an empty array if $this->dbg_app is
	 *	not defined
	 *
	 * @retval array
	 */
	public function peekQueue()
	{
		return $this->dbg_app
			? $this->dbg_app->peekQueue()
			: [];
	}

	/**
	 * @brief
	 *	Proxy calls to $this->dbg_app->detachQueuedSession()
	 */
	public function detachQueuedSession( $sid )
	{
		$this->dbg_app && $this->dbg_app->detachQueuedSession( $sid );
	}

	/**
	 * @brief
	 *	Proxy calls to $this->dbg_app->switchSession()
	 */
	public function switchSession( $sid )
	{
		$this->dbg_app && $this->dbg_app->switchSession( $sid );
	}
}
