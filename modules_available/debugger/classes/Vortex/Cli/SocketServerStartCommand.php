<?php

namespace Vortex\Cli;

use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

/**
 * @brief
 *	Runs the socket server in a loop, allowing remote restarting of the socket server
 */
class SocketServerStartCommand extends Command
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

	protected function configure()
	{
		$this
			->setName( 'socket-server:start' )
			->setDescription( 'Starts the socket server' )
			->setHelp( 'The socket server is a bridge between the debugger engine and a websocket' );
	}

	protected function execute( InputInterface $input, OutputInterface $output )
	{
		$samples = array_fill( 0, static::TIGHT_LOOP_KILL_THRESHOLD, 0 );
		while ( TRUE )
		{
			$least_recent_sample = array_shift( $samples );
			$now = microtime( TRUE );
			$samples[] = $now;
			if ( $now - $least_recent_sample < static::TIGHT_LOOP_KILL_SAMPLE_WINDOW_SECONDS )
			{
				$output->writeln( "<warning>Potential infinite loop - killing in 3 seconds</warning>" );
				sleep( 3 );
				exit( 1 );
			}

			$cmd_output = [];
			$last_line = exec( 'php -d "xdebug.remote_port=9003" vcli socket-server:run', $cmd_output, $status );
			// TODO: Use built-in API for running a symphony cli command in another process
			// TODO: Don't hardcode `vortex-cli` name
			$last_line = exec( 'php -d "xdebug.remote_port=9003" vortex-cli socket-server:run', $cmd_output, $status );
			if ( $last_line == 'stop' )
			{
				exit( $status );
			}
		}
	}
}
