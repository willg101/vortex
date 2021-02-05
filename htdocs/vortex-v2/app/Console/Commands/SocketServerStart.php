<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\SocketServer\WebSocketCoordinator;

class SocketServerStart extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'socket-server:start';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Start the socket server for bridging DBGp and websocket connections';

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
//        $wsc  = new WebSocketCoordinator;
//
//        $webSock = new \React\Socket\Server('0.0.0.0:7003', $loop); // Binding to 0.0.0.0 means remotes can connect
//        $webServer = new \Ratchet\Server\IoServer(
//            new \Ratchet\Http\HttpServer(
//                new \Ratchet\WebSocket\WsServer(
//                    new \Ratchet\Wamp\WampServer(
//                        $wsc
//                    )
//                )
//            ),
//            $webSock
//        );
//
        //        $loop->run();

        // Listen for the web server to make a ZeroMQ push after an ajax request
           $wsc = new WebSocketCoordinator;
           $context = new \React\ZMQ\Context($loop);
           $pull = $context->getSocket(\ZMQ::SOCKET_PULL);
           $pull->bind('tcp://127.0.0.1:5555'); // Binding to 127.0.0.1 means the only client that can connect is itself
           $pull->on('message', [$wsc, 'onExtMesg']);

           $server = new \Ratchet\App('vortex-v2.wgroenen.dart.ccel.org', 7003, '0.0.0.0', $loop);
           $server->route('/pubsub', $wsc);
           $server->run();
    }
}
