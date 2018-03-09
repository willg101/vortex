<?php

namespace Vortex\Cli;

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
use Psr\Log\LoggerInterface;
use Exception;

class ConnectionBridge
{
	protected $ws_connection;
	protected $dbg_connection;
	protected $dbg_app;
	protected $logger;

	public function __construct( LoggerInterface $logger )
	{
		$this->logger = $logger;
	}

	public function hasWsConnection()
	{
		return !!$this->ws_connection;
	}

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

	public function clearWsConnection( ConnectionInterface $conn = NULL )
	{
		if ( !$conn || $conn == $this->ws_connection )
		{
			$this->ws_connection = NULL;
		}
	}

	public function clearDbgConnection( ConnectionInterface $conn = NULL )
	{
		if ( !$conn || $conn == $this->dbg_connection )
		{
			$this->dbg_connection = NULL;
		}
	}

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

	public function sendToDbg( $msg )
	{
		if ( $this->hasDbgConnection() )
		{
			$this->dbg_connection->send( $msg );
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

	public function peekQueue()
	{
		return $this->dbg_app
			? $this->dbg_app->peekQueue()
			: [];
	}

	public function detachQueuedSession( $sid )
	{
		return $this->dbg_app
			? $this->dbg_app->detachQueuedSession( $sid )
			: NULL;

	}

	public function switchSession( $sid )
	{
		return $this->dbg_app
			? $this->dbg_app->switchSession( $sid )
			: NULL;
	}
}
