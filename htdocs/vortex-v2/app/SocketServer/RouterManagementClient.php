<?php

namespace App\SocketServer;

use Thruway\Peer\Client;
use Log;

class RouterManagementClient extends Client
{
    public function handleStop()
    {
        Log::info('Received stop command from wamp peer');
        echo "\nstop";
        exit;
    }

    public function handleRestart()
    {
        Log::info('Received restart command from wamp peer');
        exit;
    }

    /**
     * @param \Thruway\ClientSession $session
     * @param \Thruway\Transport\TransportInterface $transport
     */
    public function onSessionStart($session, $transport)
    {
        $session->register('vortex.management.stop',    [$this, 'handleStop']);
        $session->register('vortex.management.restart', [$this, 'handleRestart']);
    }
}
