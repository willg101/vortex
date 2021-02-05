<?php

namespace App\SocketServer;

use Ratchet\ConnectionInterface as Conn;
use Ratchet\Wamp\WampServerInterface;
/**
 * When a user publishes to a topic all clients who have subscribed
 * to that topic will receive the message/event from the publisher
 */
class WebSocketCoordinator implements WampServerInterface {
    protected $subscribedTopics = [];

    public function onSubscribe(Conn $conn, $topic) {
        $this->subscribedTopics[$topic->getId()] = $topic;
    }

    public function onPublish(Conn $conn, $topic, $event, array $exclude, array $eligible) {
        $topic->broadcast($event);
    }

    public function onCall(Conn $conn, $id, $topic, array $params) {
        $conn->callError($id, $topic, 'RPC not supported on this demo');
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
}
