<?php

namespace App\SocketServer;

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
use Exception;
use Log;

class DbgpApp implements MessageComponentInterface
{
    protected $wsc;
    protected $wrapped_connections;

    public function __construct(WebSocketCoordinator $wsc)
    {
        $this->wsc = $wsc;
    }

    public function onOpen(ConnectionInterface $conn)
    {
        $cid = $conn->resourceId;
        $this->wrapped_connections[$cid] = new DebugConnection($conn, [$this->wsc, 'onNotificationReceived']);
        $this->wsc->onDebugConnectionOpened($cid);
    }

    public function onClose(ConnectionInterface $conn)
    {
        $cid = $conn->resourceId;
        unset($this->wrapped_connections[$cid]);
    }

    public function onMessage(ConnectionInterface $conn, $msg)
    {
        $cid = $conn->resourceId;
        $this->getConn($cid)->handleMessage($msg);
    }

    public function onError(ConnectionInterface $conn, Exception $e)
    {
        $cid = $conn->resourceId;
        $this->getConn($cid)->handleError($e);
    }

    public function getConn($cid)
    {
        return $this->wrapped_connections[$cid] ?? null;
    }
}

