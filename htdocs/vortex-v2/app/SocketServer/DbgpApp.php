<?php

namespace App\SocketServer;

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
use Exception;
use Thruway\ClientSession;

class DbgpApp implements MessageComponentInterface
{
    protected $change_handler;
    protected $notification_handler;
    protected $wrapped_connections = [];

    public function setChangeHandler(callable $handler)
    {
        $this->change_handler = $handler;
    }

    public function setNotificationHandler(callable $handler)
    {
        $this->notification_handler = $handler;
    }

    public function onOpen(ConnectionInterface $conn)
    {
        $cid = $conn->resourceId;
        $this->wrapped_connections[$cid] = new DebugConnection(
            $conn,
            $this->change_handler,
            $this->notification_handler
        );
        $this->notifyChange('open', $cid);
    }

    public function onClose(ConnectionInterface $conn)
    {
        $cid = $conn->resourceId;
        unset($this->wrapped_connections[$cid]);
        $this->notifyChange('close', $cid);
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

    public function listConnections()
    {
        $out = [];

        foreach ($this->wrapped_connections as $cid => $conn) {
            $out[$cid] = [
                'cid'           => $cid,
                'initial_file'  => $conn->initial_file,
                'host'          => $conn->host,
                'time'          => $conn->time,
                'language'      => $conn->language,
                'codebase_id'   => $conn->codebase_id,
                'codebase_root' => $conn->codebase_root,
                'current_file'  => $conn->current_file,
                'current_line'  => $conn->current_line,
            ];
        }

        return $out;
    }

    protected function notifyChange(string $status, string $cid)
    {
        ($this->change_handler)(['status' => $status, 'cid' => $cid]);
    }
}
