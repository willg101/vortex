<?php

namespace App\SocketServer;

use Ratchet\ConnectionInterface as Conn;

class FocusTracker
{
    protected $associations_by_ws = [];
    protected $associations_by_dc = [];

    public function processDebugConnectionList(array $dc): array
    {
        foreach ($dc as $cid => &$info) {
            if ($this->associations_by_dc[$cid] ?? null) {
                $info['focused_by_ws'] = $this->associations_by_dc[$cid];
            }
        }
        return $dc;
    }

    public function focus(Conn $ws_conn, $dc_id): void
    {
        $ws_id = $ws_conn->resourceId;
        $this->associations_by_ws[$ws_id] = $dc_id;
        $this->associations_by_dc[$dc_id] = $ws_id;
    }

    public function disconnect(Conn $ws_conn): void
    {
        $ws_id = $ws_conn->resourceId;
        if ($dc_id = $this->associations_by_ws[$ws_id] ?? null) {
            unset($this->associations_by_dc[$dc_id]);
        }
        unset($this->associations_by_ws[$ws_id]);
    }
}
