<?php

function login_preboot()
{
	if ( !dpoh_session_id_is_valid() )
	{
		user_config()->set( 'theme_module', 'login' );
		foreach ( modules()->get() as $module_name => $module )
		{
			if ( $module_name != 'login' )
			{
				modules()->set( "$module_name.js", [] );
			}
		}
	}
}

function login_get_salt()
{
	if ( ! file_exists( __DIR__ . '/.salt' ) )
	{
		file_put_contents_safe( __DIR__ . '/.salt', openssl_random_pseudo_bytes( 20 ) );
	}

	return file_get_contents( __DIR__ . '/.salt' );
}

function login_user( $username, $password = NULL )
{
	if ( $password !== NULL )
	{
		if ( @file_get_contents( __DIR__ . '/users/' . $username ) != login_generate_hashed_password( $username, $password ) )
		{
			return FALSE;
		}
	}
	$sessid = bin2hex( openssl_random_pseudo_bytes( 15 ) );
	file_put_contents_safe( __DIR__ . '/sessions/' . $sessid, $username );
	setcookie( 'dpoh_session_id', $sessid, 0 );
	return $sessid;
}

function login_generate_hashed_password( $username, $password )
{
	return md5( login_get_salt() . md5( $username ) . $password );
}

function dpoh_session_id_is_valid()
{
	$session_id = array_get( $_COOKIE, 'dpoh_session_id' );
	return $session_id && file_exists( realpath( __DIR__ . '/sessions/' . $session_id ) );
}

function any_users_exist()
{
	return count( glob( __DIR__ . '/users/*' ) );
}
