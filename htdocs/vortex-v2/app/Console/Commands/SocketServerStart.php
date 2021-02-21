<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\SocketServer\WebSocketCoordinator;
use App\SocketServer\DbgpApp;;
use React\Socket\Server as SocketServer;
use Ratchet\Server\IoServer;

class SocketServerStart extends Command
{
    /**
     * @brief
     *	Crash loop protection: Don't bring the socket server back up if we start it up more than
     *	TIGHT_LOOP_KILL_THRESHOLD times in TIGHT_LOOP_KILL_SAMPLE_WINDOW_SECONDS seconds.
     *
     * @var TIGHT_LOOP_KILL_THRESHOLD             integer
     * @var TIGHT_LOOP_KILL_SAMPLE_WINDOW_SECONDS integer
     */
    const TIGHT_LOOP_KILL_THRESHOLD             = 10;
    const TIGHT_LOOP_KILL_SAMPLE_WINDOW_SECONDS = 1;

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
        $samples = array_fill(0, static::TIGHT_LOOP_KILL_THRESHOLD, 0);
        while (true) {
            $least_recent_sample = array_shift($samples);
            $now = microtime(true);
            $samples[] = $now;
            if ($now - $least_recent_sample < static::TIGHT_LOOP_KILL_SAMPLE_WINDOW_SECONDS) {
                logger()->warn("Potential infinite loop - killing in 3 seconds");
                sleep(3);
                exit(1);
            }

            $cmd_output = [];
            $last_line = exec(__DIR__ . '/../../../artisan socket-server:run', $cmd_output, $status);
            logger()->info("socket-server:run exited with exit status $status: \n\n " .implode("\n", $cmd_output));
            if ($last_line == 'stop') {
                exit($status);
            }
        }
    }
}

