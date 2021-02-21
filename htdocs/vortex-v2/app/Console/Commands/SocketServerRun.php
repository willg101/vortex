<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\SocketServer\WebSocketCoordinator;
use App\SocketServer\DbgpApp;;
use App\SocketServer\RouterManagementClient;
use App\SocketServer\DebugConnectionsClient;
use React\Socket\Server as SocketServer;
use Ratchet\Server\IoServer;

use Thruway\Peer\Router;
use Thruway\Transport\RatchetTransportProvider;
use Thruway\ClientSession;
use Thruway\Peer\Client;
use Thruway\Transport\PawlTransportProvider;

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

        $router = new Router($loop);

        $transportProvider = new RatchetTransportProvider("0.0.0.0", 7003);
        $router->addTransportProvider($transportProvider);
        $router->start(false);

        $router_mgmt_client = new RouterManagementClient("realm1", $loop);
        $router_mgmt_client->addTransportProvider(new PawlTransportProvider("ws://127.0.0.1:7003/"));
        $router_mgmt_client->start(false);

        $debug_conns_client = new DebugConnectionsClient($dbgp, "realm1", $loop);
        $debug_conns_client->addTransportProvider(new PawlTransportProvider("ws://127.0.0.1:7003/"));
        $debug_conns_client->start(false);

        $loop->run();
    }
}
