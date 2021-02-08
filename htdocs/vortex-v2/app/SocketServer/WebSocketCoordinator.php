<?php

namespace App\SocketServer;

use Ratchet\ConnectionInterface as Conn;
use Ratchet\Wamp\WampServerInterface;
use App\Exceptions\MalformedDebugCommandException;

/**
 * When a user publishes to a topic all clients who have subscribed
 * to that topic will receive the message/event from the publisher
 */
class WebSocketCoordinator implements WampServerInterface {
    protected $subscribedTopics = [];
    protected $dbgp_app         = null;

    public function onSubscribe(Conn $conn, $topic) {
        $this->subscribedTopics[$topic->getId()] = $topic;
    }

    public function onPublish(Conn $conn, $topic, $event, array $exclude, array $eligible) {
        $topic->broadcast($event);
    }

    public function onCall(Conn $conn, $id, $topic, array $params) {
        if ($debug_conn = $this->dbgp_app->getConn($topic->getId())) {
            $debug_conn->sendCommand(
                $params['command'],
                $params['args'] ?? [],
                $params['extra_data'] ?? '',
                function ($data) use ($conn, $id) { $conn->callResult($id, $data); }
            );
        } else {
            $conn->callError(
                $id,
                'debug-connection/invalid-id',
                "Debug connection '" . $topic->getId() . "' does not exist"
            );
        }
    }

    // No need to anything, since WampServer adds and removes subscribers to Topics automatically
    public function onUnSubscribe(Conn $conn, $topic) {}

    public function onOpen(Conn $conn) {}
    public function onClose(Conn $conn) {}
    public function onError(Conn $conn, \Exception $e) {}

    public function onExtMesg($msg) {
        $parsed = json_decode($msg);
        if ($parsed && is_string($parsed->cat) && isset($this->subscribedTopics[$parsed->cat])) {
            $this->subscribedTopics[$parsed->cat]->broadcast(json_decode($msg));
        }
    }

    public function onDebugConnectionOpened($cid)
    {
        if (isset($this->subscribedTopics['general'])) {
            $this->subscribedTopics['general']->broadcast($cid);
        }
    }

    public function onNotificationReceived($msg) {
        $this->subscribedTopics['general']->broadcast($msg);
    }
    public function setDebugApp($dbgp_app) {
        $this->dbgp_app = $dbgp_app;
    }
}
