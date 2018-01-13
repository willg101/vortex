<?php

class LoginException        extends Exception{}
class BadPasswordException  extends LoginException{}
class AccessDeniedException extends LoginException{}

function login_preboot()
{
	login_create_tables();
}

function login_boot()
{
	login_try_one_time_login();

	if ( !any_users_exist() )
	{
		if ( !IS_AJAX_REQUEST )
		{
			echo render( 'login_page', [ 'mode' => 'create' ] );
			exit;
		}
	}
	elseif ( !dpoh_session_id_is_valid() )
	{
		request_handlers()->register( 'login', 'login_handle_login' );
	}
	else
	{
		request_handlers()->register( 'logout',             'login_handle_logout' );
		request_handlers()->register( 'api/users/list',     'login_handle_list_users_api' );
		request_handlers()->register( 'api/users/invite/%', 'login_handle_invite_user_api' );
		request_handlers()->register( 'api/users/%/remove', 'login_handle_delete_account_api' );
	}

	request_handlers()->register( 'api/create-account', 'login_handle_account_creation_api' );
	request_handlers()->register( 'api/reset-password', 'login_handle_new_password_api' );
	request_handlers()->register( 'api/users/%/reset-password', 'login_handle_reset_password_api' );

	login_expire_old_sessions();
}

function login_preprocess_request( &$options )
{
	$is_logged_in = dpoh_session_id_is_valid();
	$access       = array_get( $options, 'options.access' );

	if ( $is_logged_in && $access == 'anonymous_only' )
	{
		$options[ 'callback' ] = 'login_access_denied';
		$options[ 'access_denied' ] = TRUE;
	}
	elseif ( !$is_logged_in && $access == 'authenticated_only' )
	{
		login_render_interface();
		exit;
	}
}

function login_handle_invite_user_api( $url )
{
	$url   = explode( '/', $url );
	$email = $url[ 3 ];
	header( 'Content-Type: text/plain' );

	if ( !filter_var( $email, FILTER_VALIDATE_EMAIL ) )
	{
		header( "HTTP/1.1 400 Bad request" );
		echo "'$email' is not a valid email address.";
	}
	elseif ( login_load_account( $email ) )
	{
		header( "HTTP/1.1 400 Bad request" );
		echo "An account is already associated with the email address '$email'.";
	}
	else
	{
		login_invite_user( $email );
		echo "An invitation to create an account has been sent to '$email'.";
	}
	exit;
}

function login_invite_user( $email )
{
	$token = bin2hex( openssl_random_pseudo_bytes( 20 ) );
	db_query( 'INSERT INTO invitation_tokens (token, expires) VALUES (:token, :expires)', [
		':token' => login_hash_password( $token ),
		':expires' => date('Y-m-d H:i:s', strtotime( '+1 day' ) ),
	] );
	$message = render( 'invite_user_email', [
		'join_url' => base_url() . '?' . http_build_query( [ 'it' => $token, 'iid' => db()->lastInsertId() ] ) ] );
	$headers[] = 'MIME-Version: 1.0';
	$headers[] = 'Content-type: text/html; charset=iso-8859-1';
	mail( $email, 'Vortex | Create your account', $message, implode( "\r\n", $headers ) );
}

function login_access_denied()
{
	throw new AccessDeniedException( "You are not authorized to access this page." );
}

function login_verify_otlt( $otlt, $tid )
{
	if ( $otlt && $tid )
	{
		$record = db_query( 'SELECT * FROM login_tokens WHERE id = :id AND expires > CURRENT_TIMESTAMP', [ ':id' => $tid ] );
		$otlt_hash = array_get( $record, '0.token' );
		if ( password_verify( $otlt, $otlt_hash ) )
		{
			return TRUE;
		}
	}
	return FALSE;
}

function login_handle_new_password_api()
{
	require_method( 'POST' );

	$otlt          = input( 'otlt' );
	$tid           = input( 'tid' );
	$password      = input( 'password1' );
	$password_conf = input( 'password1' );

	if ( login_verify_otlt( $otlt, $tid ) )
	{
		$account = db_query( '
			SELECT users.*
			FROM users INNER JOIN login_tokens ON user_id = users.id
			WHERE login_tokens.id = :tid', [ ':tid' => $tid ] )[ 0 ];

		if ( $password != $password_conf )
		{
			error_response( 'Passwords do not match' );
		}
		elseif ( !$password )
		{
			error_response( 'Password cannot be empty' );
		}
		db_query( 'UPDATE users SET password = :pw WHERE id = :id', [
			':pw' => login_hash_password( $password ),
			':id' => $account[ 'id' ],
		] );
		db_query( 'DELETE FROM login_tokens where user_id = :user_id', [ ':user_id' => $account[ 'id' ] ] );
		send_json( [
			'success' => TRUE,
		] );
	}
	else
	{
		error_response( 'Invalid credentials', 401, 'Unauthorized' );
	}
}

function login_try_one_time_login()
{
	$otlt = input( 'otlt' );
	$tid  = input( 'tid' );
	if ( login_verify_otlt( $otlt, $tid ) )
	{
		echo render( 'reset_password', [ 'otlt' => $otlt, 'tid' => $tid ] );
		exit;
	}

	$it  = input( 'it' );
	$iid = input( 'iid' );
	if ( $_SERVER[ 'REQUEST_METHOD' ] == 'GET' && login_verify_it( $it, $iid ) )
	{
		echo render( 'login_page', [ 'mode' => 'create', 'it' => $it, 'iid' => $iid ] );
		exit;
	}
}

function login_verify_it( $it = FALSE, $iid = FALSE )
{
	$it  = $it  ?: input( 'it' );
	$iid = $iid ?: input( 'iid' );
	if ( $it && $iid )
	{
		$record = db_query( 'SELECT * FROM invitation_tokens WHERE id = :id AND expires > CURRENT_TIMESTAMP', [ ':id' => $iid ] );
		$it_hash = array_get( $record, '0.token' );
		if ( password_verify( $it, $it_hash ) )
		{
			return TRUE;
		}
	}
	return FALSE;
}

function login_ws_connection_opened( $data )
{
	$cookies_raw   = $data[ 'connection' ]->httpRequest->getHeader( 'Cookie' ) ?: [];
	$cookies       = parse_cookie_str( array_get( $cookies_raw, 0 ) );
	$session_id    = array_get( $cookies, 'dpoh_session_id', -1 );
	$session_token = array_get( $cookies, 'dpoh_session_token', '' );

	$user_ip       = array_get( $data[ 'connection' ]->httpRequest->getHeader( 'X-Forwarded-For' ), 0, '' );

	if ( !dpoh_session_id_is_valid( $session_id, $session_token, $user_ip ) )
	{
		$data[ 'logger' ]->info( "Connection {$data['connection']->resourceId}: user is not logged "
			. 'in; disconnecting...' );
		$data[ 'connection' ]->close();
	}
}

function login_handle_logout()
{
	if ( dpoh_session_id_is_valid() )
	{
		$session_id = array_get( $_COOKIE, 'dpoh_session_id' );
		db_query( 'DELETE FROM sessions WHERE id = :session_id', [ ':session_id' => $session_id ] );
		setcookie( 'dpoh_session_id', '', 1 );
		setcookie( 'dpoh_session_token', '', 1 );
	}
	else
	{
		return error_response( 'You are not currently logged in', 401, 'Unauthorized' );
	}

	if ( IS_AJAX_REQUEST )
	{
		echo 'Logout successful';
	}
	else
	{
		header( 'Location: ' . base_path() );
	}
}

function login_handle_account_creation_api()
{
	require_method( 'POST' );
	if ( !login_verify_it() && any_users_exist() && !dpoh_session_id_is_valid() )
	{
		error_response( 'You cannot anonymously create a new account', 401, 'Unauthorized' );
	}

	$username      = input( 'username' );
	$email         = input( 'email' );
	$password      = input( 'password1' );
	$password_conf = input( 'password2' );

	if ( !( $username && $password && $password_conf && $email ) )
	{
		error_response( 'Some required information is missing.' );
	}
	elseif ( $password != $password_conf )
	{
		error_response( 'Passwords do not match' );
	}
	elseif ( login_load_account( $username ) )
	{
		error_response( 'That username is already in use' );
	}
	elseif ( !filter_var( $email, FILTER_VALIDATE_EMAIL ) )
	{
		error_response( 'Invalid email address' );
	}

	login_create_account( $username, $email, $password );
	login_user( $username );
}

function login_handle_reset_password_api( $url )
{
	require_method( 'POST' );

	$url  = explode( '/', $url );
	$user = $url[ 2 ];
	if ( !($account = login_load_account( $user ) ) )
	{
		error_response( 'That account does not exist', 404, 'Not found' );
	}
	else
	{
		$token = bin2hex( openssl_random_pseudo_bytes( 20 ) );
		db_query( 'INSERT INTO login_tokens (token, user_id, expires) VALUES (:token, :user_id, :expires)', [
			':token' => login_hash_password( $token ),
			':user_id' => $user,
			':expires' => date('Y-m-d H:i:s', strtotime( '+1 day' ) ),
		] );
		$message = render( 'reset_password_email', [
			'ip' => $_SERVER[ 'REMOTE_ADDR' ],
			'reset_url' => base_url() . '?' . http_build_query( [ 'otlt' => $token, 'tid' => db()->lastInsertId() ] ) ] );
		$headers[] = 'MIME-Version: 1.0';
		$headers[] = 'Content-type: text/html; charset=iso-8859-1';
		mail( $account[ 'email' ], 'Vortex | Password Reset', $message, implode( "\r\n", $headers ) );
		send_json( [ 'success' => TRUE ] );
	}
}

function login_handle_list_users_api()
{
	send_json( db_query( 'SELECT id, email, username FROM users' ) );
}

function login_create_account( $username, $email, $password )
{
	if ( login_load_account( $username ) )
	{
		throw new LoginException( "An account already exists with the username '$username'" );
	}
	db_query( '
		INSERT INTO users (username, email, password)
		VALUES (:username, :email, :password);',
		[
			':username'     => $username,
			':email'        => $email,
			':password'     => login_hash_password( $password ),
		]
	);
}

function login_delete_account( $username_or_id )
{
	if ( $account = login_load_account( $username_or_id ) )
	{
		db_query( 'DELETE FROM users WHERE id = :id', [ ':id' => $account[ 'id' ] ] );
		return $account;
	}
	else
	{
		throw new LoginException( "Unknown account '$username_or_id'" );
	}
}

function login_handle_delete_account_api( $url )
{
	require_method( 'POST' );

	$url  = explode( '/', $url );
	$user = $url[ 2 ];
	try 
	{
		send_json( login_delete_account( $user ) );
	}
	catch ( LoginException $e )
	{
		error_response( 'That account does not exist', 404, 'Not found' );
	}
}

function login_load_account( $username_or_id )
{
	$result = db_query( 'SELECT * FROM users WHERE id = :param OR username = :param OR email = :param', [ ':param' => $username_or_id ] );
	if ( count( $result ) )
	{
		return $result[ 0 ];
	}
	else
	{
		return [];
	}
}

function login_create_tables()
{
	try
	{
		db_query( "
			CREATE TABLE IF NOT EXISTS users (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				username VARCHAR(30) NOT NULL UNIQUE,
				email VARCHAR(128) NOT NULL,
				password VARCHAR(128) NOT NULL
			);
		" );
		db_query( "
			CREATE TABLE IF NOT EXISTS sessions (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				user_id INTEGER NOT NULL,
				session_token VARCHAR(128) NOT NULL,
				user_ip VARCHAR(15) NOT NULL,
				CONSTRAINT fk_users
					FOREIGN KEY (user_id)
					REFERENCES users(id)
					ON DELETE CASCADE
			);
		" );
		db_query( "
			CREATE TABLE IF NOT EXISTS login_tokens (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				token VARCHAR(128) NOT NULL,
				user_id INTEGER NOT NULL,
				expires DATETIME DEFAULT CURRENT_TIMESTAMP,
				CONSTRAINT fk_tokens
					FOREIGN KEY (user_id)
					REFERENCES users(id)
					ON DELETE CASCADE
			);
		" );
		db_query( "
			CREATE TABLE IF NOT EXISTS invitation_tokens (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				token VARCHAR(128) NOT NULL,
				expires DATETIME DEFAULT CURRENT_TIMESTAMP
			);
		" );
	}
	catch ( Exception $e )
	{
		throw new LoginException( 'A problem occurred while initializing the login system. As a '
			. ' safety precaution, Vortex will not start up until this is fixed.', 0, $e );
	}
}

function login_handle_login()
{
	if ( $_SERVER[ 'REQUEST_METHOD' ] != 'POST' )
	{
		error_response( "This API only accepts POST requests" );
	}

	$result = FALSE;
	$username = input( 'username' );
	$password = input( 'password' );
	if ( $username && $password )
	{
		$result = login_user( $username, $password );
	}
	send_json( [ 'login_result' => $result ] );
}

function login_expire_old_sessions()
{
	$dir = escapeshellarg( __DIR__ . '/sessions/' );
	exec( "find $dir* -mtime +3 -exec rm {} \;" );
}

function login_render_interface()
{
	echo render( 'login_page', [ 'mode' => 'login' ] );
}

function login_user( $username, $password = NULL )
{
	$account = login_load_account( $username );

	if ( !$account || ( $password !== NULL && !password_verify( $password, $account[ 'password' ] ) ) )
	{
		return FALSE;
	}

	$session_token = bin2hex( openssl_random_pseudo_bytes( 25 ) );
	db_query( '
		INSERT INTO sessions (user_id, session_token, user_ip)
		VALUES (:user_id, :session_token, :user_ip)',
		[
			':user_id'       => $account[ 'id' ],
			':session_token' => login_hash_password( $session_token ),
			':user_ip'       => $_SERVER[ 'REMOTE_ADDR' ],
		]
	);
	setcookie( 'dpoh_session_id',    db()->lastInsertId(), 0, '/' );
	setcookie( 'dpoh_session_token', $session_token, 0, '/' );
	return TRUE;
}

function dpoh_session_id_is_valid( $session_id = FALSE, $session_token = FALSE, $user_ip = FALSE )
{
	$session_id    = $session_id    ?: array_get( $_COOKIE, 'dpoh_session_id' );
	$session_token = $session_token ?: array_get( $_COOKIE, 'dpoh_session_token' );
	$user_ip       = $user_ip ?: $_SERVER[ 'REMOTE_ADDR' ];

	$session_record = db_query( 'SELECT * FROM sessions WHERE id = :session_id', [
		':session_id' => $session_id
	] );
	if ( !db_query( 'SELECT COUNT(*) count FROM users WHERE id = :id',
		[ ':id' => array_get( $session_record, '0.user_id' ) ] )[ 0 ][ 'count' ] )
	{
		return FALSE;
	}
	$session_token_hashed = array_get( $session_record, '0.session_token' );
	return password_verify( $session_token, $session_token_hashed )
		&& $user_ip == array_get( $session_record, '0.user_ip' );
}

function any_users_exist()
{
	return !!db_query( 'SELECT COUNT(*) count FROM users;' )[ 0 ][ 'count' ];
}

function login_hash_password( $password )
{
	return password_hash( $password, PASSWORD_BCRYPT );
}
