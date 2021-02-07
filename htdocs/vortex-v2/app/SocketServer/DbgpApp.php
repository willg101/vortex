<?php

namespace App\SocketServer;

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
use Exception;
use Log;

class DbgpApp implements MessageComponentInterface
{
    public function onOpen(ConnectionInterface $conn)
    {
        $cid = $conn->resourceId;
        Log::debug("Connection opened: $cid");
    }

    public function onClose(ConnectionInterface $conn)
    {
        $cid = $conn->resourceId;
        Log::debug("Connection closed: $cid");
    }

    public function onMessage(ConnectionInterface $conn, $msg)
    {
        $cid = $conn->resourceId;
        Log::debug("Message from $cid: $msg");
    }

    public function onError(ConnectionInterface $conn, Exception $e)
    {
        $cid = $conn->resourceId;
        Log::debug("Error from $cid: $msg");
    }
}
