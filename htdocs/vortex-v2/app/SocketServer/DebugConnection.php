<?php

namespace App\SocketServer;

use Ratchet\ConnectionInterface as Conn;
use App\Exceptions\MalformedDebugCommandException;

class DebugConnection
{
    protected $host;
    protected $file;
    protected $language;
    protected $time;
    protected $codebase_id;
    protected $codebase_root;

    // Disallow public read access to fields starting with '_'
    protected $_conn;
    protected $_tid;
    protected $_callbacks;
    protected $_notify_ready;
    protected $_handle_notification;
    protected $_message_buffer;

    public function __construct($conn, $handle_notification, $notify_ready)
    {
        $this->_tid  = 1;
        $this->_conn = $conn;
        $this->_handle_notification = $handle_notification;
        $this->_notify_ready = $notify_ready;;
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
        $file = $this->file;
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
                $this->{$child['name']} = $child['_value'];
            }
            ($this->_notify_ready)();
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

        if ($msg_parsed['transaction_id'] ?? null) {
            $tid = $msg_parsed['transaction_id'];
            if (isset($this->_callbacks[$tid])) {
                $this->_callbacks[$tid]($msg_parsed);
                unset($this->_callbacks[$tid]);
            }
        } else {
            if ($msg_parsed['_tag'] == 'init') {
                $this->file     = $msg_parsed['fileuri'];
                $this->language = $msg_parsed['language'];
                ($this->_notify_ready)();
                $this->identifyCodeBase();
            }
            ($this->_handle_notification)($msg_parsed);
        }
    }

    public function deserializeXml($xml)
    {
        if (is_string($xml)) {
            $xml = simplexml_load_string($xml);
        }
        if (!$xml) {
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
            $out['_children'][] = $this->deserializeXml($child);
        }

        return $out;
    }
}
