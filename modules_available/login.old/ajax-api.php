<?php

if ( input( 'action' ) == 'logout' )
{
	$session_id = array_get( $_COOKIE, 'dpoh_session_id' );
	if ( $session_id && !preg_match( '/\W/', $session_id ) && file_exists( __DIR__ . '/sessions/' . $session_id ) )
	{
		unlink( __DIR__ . '/sessions/' . $session_id );
	}
	setcookie( 'dpoh_session_id', '', 1 );
}
else if ( input( 'action' ) == 'login' )
{
	$result = FALSE;
	$username = input( 'username' );
	$password = input( 'password' );
	if ( $username && $password )
	{
		$result = login_user( $username, $password );
	}
	header("Content-Type: application/json;charset=utf-8");
	echo json_encode( [ 'login_result' => $result ] );
	exit;
}
