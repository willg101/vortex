<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\SocketServer\WebSocketCoordinator;
use App\SocketServer\DbgpApp;;
use React\Socket\Server as SocketServer;
use Ratchet\Server\IoServer;

class SocketServerRun extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'socket-server:run';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Start the socket server for bridging DBGp and websocket connections';

    protected $hidden = true;

    /**
     * Create a new command instance.
     *
     * @return void
     */
    public function __construct()
    {
        parent::__construct();
    }

    /**
     * Execute the console command.
     *
     * @return int
     */
    public function handle()
    {
        $loop = \React\EventLoop\Factory::create();
        
        $wsc = new WebSocketCoordinator;
        $dbgp    = new DbgpApp($wsc);
        $dbgp_ss = new SocketServer('0.0.0.0:55455', $loop);
        $dbgp_app = new IoServer($dbgp, $dbgp_ss, $loop);

        $wsc->setDebugApp($dbgp);

        $server = new \Ratchet\App('vortex-v2.wgroenen.dart.ccel.org', 7003, '0.0.0.0', $loop);
        $server->route('/pubsub', $wsc);
        $server->run();
    }
}
