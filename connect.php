<?php /* dpoh: ignore */

@$con = stream_socket_client( 'tcp://localhost:1234' );

if ( !$con )
{
	echo json_encode( [ 'error' => 'xdebug proxy connection timeout' ] );
	exit;
}
else
{
	stream_set_timeout( $con, 1 );
}

if ( !isset( $_POST[ 'commands' ] ) || !is_array( $_POST[ 'commands' ] ) )
{
	header("Content-Type: application/json;charset=utf-8");
	echo json_encode( [ 'error' => "'commands' parameter invalid or missing" ] );
	fclose( $con );
	exit;
}

$commands = $_POST[ 'commands' ];
$output = [];

foreach ( $commands as $command )
{
	if ( strpos( $command, 'get_file' ) === 0 )
	{
		echo file_get_contents( substr( $command, 9 ) );
		exit;
	}
	else if ( strpos( $command, 'list_recent_files' ) === 0 )
	{
		$dir = escapeshellarg( substr( $command, 18 ) );
		$files = shell_exec( "find $dir -type f -mmin -480" );
		header("Content-Type: application/json;charset=utf-8");
		echo json_encode( array_filter( explode( "\n", $files ) ) );
		exit;
	}
	fwrite( $con, $command );
	$data = '';
	while ( $line = fread( $con, 4096 ) )
	{
		$data .= $line;
	}
	$output[] = $data;
}

$data = '';
while ( $line = fread( $con, 4096 ) )
{
	$data .= $line;
}
$output[] = $data;

header("Content-Type: application/json;charset=utf-8");
$output =  json_encode( $output );
echo $output;
$file = fopen( "connect.php.log", "a" );
$time = date( 'Y-m-d h:i:s A' );
fwrite( $file, "$_SERVER[REMOTE_ADDR]\t$time\t$output\n" );
fclose( $file );
fclose( $con );
exit;
