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
    protected $focus_tracker    = null;

    public function __construct(...$args)
    {
        $this->focus_tracker = new FocusTracker;
    }

    public function onSubscribe(Conn $conn, $topic) {
        $this->subscribedTopics[$topic->getId()] = $topic;
    }

    public function onPublish(Conn $conn, $topic, $event, array $exclude, array $eligible) {
        $topic->broadcast($event);
    }

    public function onCall(Conn $conn, $id, $topic, array $params) {
        $topic_parsed = explode('/', trim($topic, '/'));
        $topic_parsed_count = count($topic_parsed);
        if ($topic_parsed[0] == 'debug' && $topic_parsed_count == 3) {
            $this->handleDebugCall($conn, $id, $topic_parsed[1], $topic_parsed[2], $params);
        } elseif ($topic_parsed[0] == 'control' && $topic_parsed_count == 2) {
            $this->handleControlCall($conn, $id, $topic_parsed[1], $params);
        } else {
            $conn->callError($id, 'invalid-topic', "Topic '$topic' is malformed or not supported");
        }
    }

    protected function handleControlCall(Conn $ws_conn, $id, $command, array $params) {
        switch ($command) {
            case 'stop':
                $ws_conn->callResult($id, ['status' => 'stopping...']);
                echo "\nstop";
                exit;

            case 'restart':
                $ws_conn->callResult($id, ['status' => 'restarting...']);
                exit;

            case 'list-debug-connections':
                $ws_conn->callResult($id, $this->getDebugConnections());
                break;

            case 'claim-focus':
                // TODO: No need to use FocusTracker, just use $this->subscribedTopics
                $debug_connection_id = $params['connection_id'] ?? null;
                if (!$debug_connection_id) {
                    $ws_conn->callError(
                        $id,
                        'control/claim-focus/invalid-format',
                        "Missing or invalid 'connection_id' param"
                    );
                } elseif (!$this->dbgp_app->getConn($debug_connection_id)) {
                    $ws_conn->callError(
                        $id,
                        'control/claim-focus/invalid-id',
                        "Debug connection '$params[connection_id]' does not exist"
                    );
                } else {
                    $this->focus_tracker->focus($ws_conn, $debug_connection_id);
                    $ws_conn->callResult($id, ['status' => 'ok']);
                    $this->broadcastDebugConnectionChanged();
                }
                break;

            default:
                $ws_conn->callError($id, 'control/invalid-command', "Command '$command' is not supported");
        }
    }

    protected function handleDebugCall(Conn $conn, $id, $connection_id, $call_category, array $params) {
        if ($debug_conn = $this->dbgp_app->getConn($connection_id)) {
            if ($call_category == 'command') {
                if (empty($params['command']) || !is_string($params['command'])) {
                    $conn->callError(
                        $id,
                        'debug/command/invalid-format',
                        "Missing or invalid command name"
                    );
                } else {
                    $debug_conn->sendCommand(
                        $params['command'],
                        $params['args'] ?? [],
                        $params['extra_data'] ?? '',
                        function ($data) use ($conn, $id) { $conn->callResult($id, $data); }
                    );
                }
            } elseif ($call_category == 'meta') {
                // TODO: differentiate between different meta calls
                app(PhpAbstractions::class)->getRecentFiles(
                    $params['max_files'],
                    $debug_conn->codebase_root,
                    $params['excluded_dirs'] ?? null,
                    $debug_conn,
                    function ($data) use ($conn, $id) { $conn->callResult($id, $data); }
                );
            } else {
                $conn->callError(
                    $id,
                    'debug/invalid-call-category',
                    "Unsupported call category: '$call_category'"
                );
            }
        } else {
            $conn->callError(
                $id,
                'debug/invalid-id',
                "Debug connection '$connection_id' does not exist"
            );
        }
    }

    // No need to anything, since WampServer adds and removes subscribers to Topics automatically
    public function onUnSubscribe(Conn $conn, $topic) {}

    public function onOpen(Conn $conn) {
        $conn->event('control/hello', [
            'ws_id' => $conn->resourceId,
        ]);
    }
    public function onClose(Conn $conn) {
        $this->focus_tracker->disconnect($conn);
    }
    public function onError(Conn $conn, \Exception $e) {}

    public function onExtMesg($msg) {
        $parsed = json_decode($msg);
        if ($parsed && is_string($parsed->cat) && isset($this->subscribedTopics[$parsed->cat])) {
            $this->subscribedTopics[$parsed->cat]->broadcast(json_decode($msg));
        }
    }

    public function onDebugConnectionOpened($cid)
    {
        $this->broadcastDebugConnectionChanged();
    }

    public function onNotificationReceived($msg) {
        $this->broadcast('debug/notification', $msg);
    }

    public function setDebugApp($dbgp_app) {
        $this->dbgp_app = $dbgp_app;
    }

    protected function broadcastDebugConnectionChanged()
    {
        $this->broadcast('control/debug-connections-changed', $this->getDebugConnections());
    }

    protected function getDebugConnections()
    {
        $dc = $this->dbgp_app->listConnections();
        return $this->focus_tracker->processDebugConnectionList($dc);
    }

    protected function broadcast($topic, $msg)
    {
        if (isset($this->subscribedTopics[$topic])) {
            $this->subscribedTopics[$topic]->broadcast($msg);
        }
    }
}
