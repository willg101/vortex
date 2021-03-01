<?php

namespace App\SocketServer;

use Ratchet\ConnectionInterface as Conn;
use App\Exceptions\MalformedDebugCommandException;

class DebugConnection
{
    protected $host;
    protected $initial_file;
    protected $language;
    protected $time;
    protected $codebase_id;
    protected $codebase_root;
    protected $current_line;
    protected $current_file;

    // Disallow public read access to fields starting with '_'
    protected $_conn;
    protected $_tid;
    protected $_callbacks;
    protected $_broadcast_state_change;
    protected $_broadcast_notification_msg;
    protected $_message_buffer;

    public function __construct($conn, $broadcast_state_change, $broadcast_notification_msg)
    {
        $this->_tid  = 1;
        $this->_conn = $conn;
        $this->_broadcast_notification_msg = $broadcast_notification_msg;
        $this->_broadcast_state_change = $broadcast_state_change;
        $this->time = time();
        $this->host = $conn->remoteAddress;
    }

    public function __get($key)
    {
        return ($key[0] ?? '_')  == '_'
            ? null
            : $this->$key ?? null;
    }

    public function sendCommand(
        string   $command,
        array    $args = [],
        string   $extra_data = '',
        callable $handle_response = null
    ): void
    {
        $tid = $this->_tid++;
        if ($handle_response) {
            $this->_callbacks[$tid] = $handle_response;
        }
        $full_command = "$command -i $tid";

        foreach ($args as $k => $v) {
            if (!preg_match('/^[A-Za-z]$/', $k)) {
                throw new MalformedDebugCommandException("Received invalid argument name '$k'");
            } elseif (!is_string($v) && !is_int($v) && !is_float($v)) {
                throw new MalformedDebugCommandException("Received invalid argument for -$k "
                    . "(expected a number or string)");
            }
            $v = json_encode($v);
            $full_command .= " -$k $v";
        }

        if ($extra_data) {
            $full_command .= " -- " . base64_encode($extra_data);
        }

        $full_command .= "\0";
        $this->_conn->send($full_command);
    }

    public function handleMessage($msg)
    {
        $this->_message_buffer .= $msg;
        $this->checkBufferForFullMessages();
    }

    public function handleError($e)
    {
    }

    public function advancedEval($code, $callback = null)
    {
        $code = base64_encode($code);
        $this->sendCommand('eval', [], "eval(base64_decode('$code'))", $callback);
    }

    public function identifyCodeBase()
    {
        $file = $this->initial_file;
        $code = <<<"EOF"
            if (strpos('$file', 'file://') === 0) {
                \$parts = explode('/', substr('$file', 7));
                \$full = '';
                foreach (\$parts as \$part) {
                    \$full .= "/\$part";
                    if (is_file("\$full/.git/config")) {
                        \$parsed = parse_ini_file("\$full/.git/config", true);
                        return [
                            'codebase_id'   => \$parsed['remote origin']['url'] ?? '',
                            'codebase_root' => \$full,
                        ];
                    }
                }
            }
            return [
                'codebase_id'   => '',
                'codebase_root' => '/',
            ];
EOF;
        $this->advancedEval($code, function($data) {
            foreach ($data['_children'][0]['_children'] ?? [] as $child) {
                if (in_array($child['name'] ?? null, ['codebase_root', 'codebase_id'])) {
                    $this->{$child['name']} = $child['_value'];
                }
            }
            ($this->_broadcast_state_change)('ready');
        });
    }

    protected function checkBufferForFullMessages()
    {
        $msg_pieces = explode("\0", trim($this->_message_buffer));
        while (count($msg_pieces) > 1) {
            if (mb_strlen($msg_pieces[1]) === (int) $msg_pieces[0]) {
                $this->handleFullMessage($msg_pieces[1]);
                array_shift($msg_pieces);
                array_shift($msg_pieces);
            } else {
                break;
            }
        }
        $this->_message_buffer = implode("\0", $msg_pieces);
    }

    public function handleFullMessage(string $msg)
    {
        $msg_parsed = $this->deserializeXml($msg) ?: $msg;

        $this->skimDataFromMessage($msg_parsed);

        if ($msg_parsed['transaction_id'] ?? null) {
            $tid = $msg_parsed['transaction_id'];
            if (isset($this->_callbacks[$tid])) {
                $this->_callbacks[$tid]($msg_parsed);
                unset($this->_callbacks[$tid]);
            }
        } else {
            ($this->_broadcast_notification_msg)($this->cid, $msg_parsed);
        }
    }

    public function deserializeXml($xml, ?array $namespaces = null)
    {
        if (is_string($xml)) {
            $xml = simplexml_load_string($xml);
            $namespaces = $xml->getNamespaces(true);
        }
        if ((!is_object($xml) && !$xml) || (is_object($xml) && !$xml->attributes())) {
            return [];
        }
        $out = ((array) $xml->attributes())['@attributes'];
        $out['_tag'] = $xml->getName();
        $out['_value'] = (string) $xml;
        if (($out['encoding'] ?? null) == 'base64') {
            $out['_value'] = base64_decode($out['_value']);
        }

        $out['_children'] = [];
        foreach ($xml->children() as $child) {
            $out['_children'][] = $this->deserializeXml($child, $namespaces);
        }
        foreach ($namespaces as $ns) {
            foreach ($xml->children($ns) as $child) {
                $out['_children'][] = $this->deserializeXml($child, $namespaces);
            }
        }

        return $out;
    }

    protected function skimDataFromMessage(array $msg): void
    {
        if ($msg['_tag'] == 'init') {
            $this->initial_file = $msg['fileuri'];
            $this->language = $msg['language'];
            ($this->_broadcast_state_change)('ready');
            $this->configureConnection();
            $this->identifyCodeBase();
            $this->sendCommand('step_into');
        }

        $position_changed = false;
        if ($updated_line = ($msg['_children'][0]['lineno'] ?? null)) {
            if ($updated_line != $this->current_line) {
                $this->current_line = $updated_line;
                $position_changed = true;
            }
        }
        if ($updated_file = ($msg['_children'][0]['filename'] ?? null)) {
            if ($updated_file != $this->current_file) {
                $this->current_file = $updated_file;
                $position_changed = true;
            }
        }
        if ($position_changed) {
            ($this->_broadcast_state_change)('ready');
        }
    }

    public function configureConnection()
    {
        $this->sendCommand('feature_set', ['n' => 'max_depth', 'v' => 5]);
        $this->sendCommand('feature_set', ['n' => 'resolved_breakpoints', 'v' => 1]);
    }
}
