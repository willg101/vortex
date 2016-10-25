<?php

$con = stream_socket_client( 'tcp://localhost:1234' );
stream_set_timeout( $con, 2 );
header("Content-Type: application/json;charset=utf-8");

if ( ! $con )
{
	echo json_encode( [ 'error' => 'xdebug proxy connection timeout' ] );
	exit;
}

if ( !isset( $_POST[ 'commands' ] ) || !is_array( $_POST[ 'commands' ] ) )
{
	echo json_encode( [ 'error' => "'commands' parameter invalid or missing" ] );
	fclose( $con );
	exit;
}

$commands = $_POST[ 'commands' ];
$output = [];

foreach ( $commands as $command )
{
	fwrite( $con, $command );
	$output[] = fread( $con, 1000 );
}

echo json_encode( $output );
fclose( $con );
exit;
