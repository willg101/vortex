<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\SocketServer\WebSocketCoordinator;
use App\SocketServer\DbgpApp;;
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

        /*

        $server = new \Ratchet\App('vortex-v2.wgroenen.dart.ccel.org', 7003, '0.0.0.0', $loop);
        $server->route('/pubsub', $wsc);
        $server->run();
        */
        $wsc = new WebSocketCoordinator;

        $dbgp    = new DbgpApp($wsc);
        $dbgp_ss = new SocketServer('0.0.0.0:55455', $loop);
        $dbgp_app = new IoServer($dbgp, $dbgp_ss, $loop);

        $wsc->setDebugApp($dbgp);

$router = new Router($loop);

$transportProvider = new RatchetTransportProvider("0.0.0.0", 7003);
$router->addTransportProvider($transportProvider);
$router->start(false);

$client = new Client("realm1", $loop);
$client->addTransportProvider(new PawlTransportProvider("ws://127.0.0.1:7003/"));
$client->on('open', function (ClientSession $session) {

    // 1) subscribe to a topic
    $onevent = function ($args) {
        echo "Event {$args[0]}\n";
    };
    $session->subscribe('com.myapp.hello', $onevent);

    // 2) publish an event
    $session->publish('com.myapp.hello', ['Hello, world from PHP!!!'], [], ["acknowledge" => true])->then(
        function () {
            echo "Publish Acknowledged!\n";
        },
        function ($error) {
            // publish failed
            echo "Publish Error {$error}\n";
        }
    );

    // 3) register a procedure for remoting
    $add2 = function ($args) {
        return $args[0] + $args[1];
    };
    $session->register('com.myapp.add2', $add2);

    // 4) call a remote procedure
    $session->call('com.myapp.add2', [2, 3])->then(
        function ($res) {
            echo "Result: {$res}\n";
        },
        function ($error) {
            echo "Call Error: {$error}\n";
        }
    );
});


$client->start(false);

$loop->run();    }
}
