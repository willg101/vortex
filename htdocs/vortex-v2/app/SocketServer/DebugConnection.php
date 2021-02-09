<?php

namespace App\SocketServer;

use Ratchet\ConnectionInterface as Conn;
use App\Exceptions\MalformedDebugCommandException;

class DebugConnection
{
    protected $host;
    protected $file;
    protected $time;

    // Disallow public read access to fields starting with '_'
    protected $_conn;
    protected $_tid;
    protected $_callbacks;
    protected $_handle_notification;
    protected $_message_buffer;

    public function __construct($conn, $handle_notification)
    {
        $this->_tid  = 1;
        $this->_conn = $conn;
        $this->_handle_notification = $handle_notification;
        $this->time = time();
        $this->file = ''; // TODO
        $this->host = ''; // TODO
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
        if (preg_match('/transaction_id="(?P<tid>[^"]+)"/', $msg, $match)) {
            $tid = $match['tid'];
            if (isset($this->_callbacks[$tid])) {
                $this->_callbacks[$tid]($msg);
                unset($this->_callbacks[$tid]);
            }
        } else {
            ($this->_handle_notification)($msg);
        }
    }
}
