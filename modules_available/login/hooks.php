<?php

class LoginException extends Exception
{
}
class BadPasswordException extends LoginException
{
}
class AccessDeniedException extends LoginException
{
}

/**
 * Implements hook_preboot
 */
function login_preboot()
{
    login_create_tables();
}

/**
 * Implements hook_boot
 */
function login_boot($data)
{
    login_try_one_time_login($data['request'], $data['response']);

    if (!any_users_exist()) {
        if (!IS_AJAX_REQUEST) {
            echo render('login_page', [ 'mode' => 'create' ]);
            exit;
        }
    } elseif (!dpoh_session_id_is_valid()) {
        request_handlers()->register('login', 'login_handle_login');
    } else {
        login_postpone_session_expiration();

        request_handlers()->register('logout', 'login_handle_logout');
        request_handlers()->register('api/users/list', 'login_handle_list_users_api');
        request_handlers()->register('api/users/invite/%', 'login_handle_invite_user_api');
        request_handlers()->register('api/users/%/remove', 'login_handle_delete_account_api');
    }

    request_handlers()->register('api/create-account', 'login_handle_account_creation_api');
    request_handlers()->register('api/reset-password', 'login_handle_new_password_api');
    request_handlers()->register('api/users/%/reset-password', 'login_handle_reset_password_api');

    login_clear_expired_sessions_and_tokens();
}

/**
 * Implements hook_alter_js_options
 */
function login_alter_js_options(&$options)
{
    $options[ 'authenticated' ] = dpoh_session_id_is_valid();
}

function login_preprocess_request(&$options)
{
    $is_logged_in = dpoh_session_id_is_valid();
    $access       = array_get($options, 'options.access');

    if ($is_logged_in && $access == 'anonymous_only') {
        $options[ 'callback' ] = 'login_access_denied';
        $options[ 'access_denied' ] = true;
    } elseif (!$is_logged_in && $access == 'authenticated_only') {
        login_render_interface();
        exit;
    }
}

function login_postpone_session_expiration()
{
    if (dpoh_session_id_is_valid()) {
        $sid = array_get($_COOKIE, 'dpoh_session_id');
        db_query(
            '
			UPDATE sessions
			SET expires = date( expires, "+3 day" )
			WHERE id = :sid',
            [ ':sid' => $sid ]
        );
    }
}

function login_handle_invite_user_api($url, $options, $response, $request)
{
    $url   = explode('/', $request->getPathInfo());
    $email = $url[ 3 ];
    header('Content-Type: text/plain');

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $response->setContent("'$email' is not a valid email address.");
        $response->addHeader("HTTP/1.1 400 Bad request");

    } elseif (login_load_account($email)) {
        $response->setContent("An account is already associated with the email address '$email'.");
        $response->addHeader("HTTP/1.1 400 Bad request");
    } else {
        login_invite_user($email);
        $response->setContent("An invitation to create an account has been sent to '$email'.");
    }
    exit;
}

function login_invite_user($email)
{
    $token = get_random_token(20);
    db_query('INSERT INTO invitation_tokens (token, expires) VALUES (:token, :expires)', [
        ':token' => login_hash_password($token),
        ':expires' => date('Y-m-d H:i:s', strtotime('+1 day')),
    ]);
    $message = render('invite_user_email', [
        'join_url' => base_url() . '?' . http_build_query([ 'it' => $token, 'iid' => db()->lastInsertId() ]) ]);
    $headers[] = 'MIME-Version: 1.0';
    $headers[] = 'Content-type: text/html; charset=iso-8859-1';
    mail($email, 'Vortex | Create your account', $message, implode("\r\n", $headers));
}

function login_access_denied()
{
    throw new AccessDeniedException("You are not authorized to access this page.");
}

function login_verify_otlt($otlt, $tid)
{
    if ($otlt && $tid) {
        $record = db_query('SELECT * FROM login_tokens WHERE id = :id AND expires > CURRENT_TIMESTAMP', [ ':id' => $tid ]);
        $otlt_hash = array_get($record, '0.token');
        if (password_verify($otlt, $otlt_hash)) {
            return true;
        }
    }
    return false;
}

function login_handle_new_password_api($path, $options, $response, $request)
{
    require_method('POST');

    $otlt          = $request->request->get('otlt');
    $tid           = $request->request->get('tid');
    $password      = $request->request->get('password1');
    $password_conf = $request->request->get('password1');

    if (login_verify_otlt($otlt, $tid)) {
        $account = db_query('
			SELECT users.*
			FROM users INNER JOIN login_tokens ON user_id = users.id
			WHERE login_tokens.id = :tid', [ ':tid' => $tid ])[ 0 ];

        if ($password != $password_conf) {
            $response->setContent('Passwords do not match')->setStatusCode(400);
        } elseif (!$password) {
            $response->setContent('Password cannot be empty')->setStatusCode(400);
        }
        db_query('UPDATE users SET password = :pw WHERE id = :id', [
            ':pw' => login_hash_password($password),
            ':id' => $account[ 'id' ],
        ]);
        db_query('DELETE FROM login_tokens where user_id = :user_id', [ ':user_id' => $account[ 'id' ] ]);
        $response->setContent([ 'success' => true ]);
    } else {
        $response->setContent('Invalid credentials')->setStatusCode(401);
    }
}

function login_try_one_time_login($request, $response)
{
    $otlt = $request->query->get('otlt');
    $tid  = $request->query->get('tid');
    if (login_verify_otlt($otlt, $tid)) {
        $response->setContent(render('reset_password', [ 'otlt' => $otlt, 'tid' => $tid ]))->sendAndTerminate();
    }

    $it  = $request->query->get('it');
    $iid = $request->query->get('iid');
    if ($_SERVER[ 'REQUEST_METHOD' ] == 'GET' && login_verify_it($it, $iid)) {
        $response->setContent(render('login_page', [ 'mode' => 'create', 'it' => $it, 'iid' => $iid ]))->sendAndTerminate();
    }
}

function login_verify_it($it, $iid)
{
    if ($it && $iid) {
        $record = db_query('SELECT * FROM invitation_tokens WHERE id = :id AND expires > CURRENT_TIMESTAMP', [ ':id' => $iid ]);
        $it_hash = array_get($record, '0.token');
        if (password_verify($it, $it_hash)) {
            return true;
        }
    }
    return false;
}

function login_ws_connection_opened($data)
{
    $cookies_raw   = $data[ 'connection' ]->httpRequest->getHeader('Cookie') ?: [];
    $cookies       = parse_cookie_str(array_get($cookies_raw, 0));
    $session_id    = array_get($cookies, 'dpoh_session_id', -1);
    $session_token = array_get($cookies, 'dpoh_session_token', '');
    $user_ip       = array_get($data[ 'connection' ]->httpRequest->getHeader('X-Forwarded-For'), 0, '');
    $user_ip       = explode(',', $user_ip)[ 0 ];

    if (!dpoh_session_id_is_valid($session_id, $session_token, $user_ip)) {
        logger()->info("Connection {$data['connection']->resourceId}: user is not logged "
            . 'in; disconnecting...');
        $data[ 'connection' ]->close();
    }
}

function login_handle_logout($url, $options, $response)
{
    if (dpoh_session_id_is_valid()) {
        $session_id = array_get($_COOKIE, 'dpoh_session_id');
        db_query('DELETE FROM sessions WHERE id = :session_id', [ ':session_id' => $session_id ]);
        setcookie('dpoh_session_id', '', 1);
        setcookie('dpoh_session_token', '', 1);
    } else {
        $response->setContent('You are not currently logged in')->setStatusCode(401);
    }

    if (IS_AJAX_REQUEST) {
        $response->setContent('Logout successful');
    } else {
        $response->headers->set('Location: ' . base_path());
    }
}

function login_handle_account_creation_api($url, $options, $response, $request)
{
    require_method('POST');
    if (!login_verify_it($request->request->get('it'), $request->request->get('iid')) && any_users_exist() && !dpoh_session_id_is_valid()) {
        $response->setContent('You cannot anonymously create a new account')->setStatusCode(401);
    }

    $username      = $request->request->get('username');
    $email         = $request->request->get('email');
    $password      = $request->request->get('password1');
    $password_conf = $request->request->get('password2');

    if (!($username && $password && $password_conf && $email)) {
        $response->setContent('Some required information is missing.')->setStatusCode(400);
    } elseif ($password != $password_conf) {
        $response->setContent('Passwords do not match')->setStatusCode(400);
    } elseif (login_load_account($username)) {
        $response->setContent('That username is already in use.')->setStatusCode(400);
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $response->setContent('Invalid email address.')->setStatusCode(400);
    } else {
       login_create_account($username, $email, $password);
       login_user($username);
    }
}

function login_handle_reset_password_api($url)
{
    require_method('POST');

    $url  = explode('/', $url);
    $user = $url[ 2 ];
    if (!($account = login_load_account($user))) {
        $response->setContent('That account does not exist')->setStatusCode(404);
    } else {
        $token = get_random_token(20);
        db_query('INSERT INTO login_tokens (token, user_id, expires) VALUES (:token, :user_id, :expires)', [
            ':token' => login_hash_password($token),
            ':user_id' => $user,
            ':expires' => date('Y-m-d H:i:s', strtotime('+1 day')),
        ]);
        $message = render('reset_password_email', [
            'ip' => get_user_ip(),
            'reset_url' => base_url() . '?' . http_build_query([ 'otlt' => $token, 'tid' => db()->lastInsertId() ]) ]);
        $headers[] = 'MIME-Version: 1.0';
        $headers[] = 'Content-type: text/html; charset=iso-8859-1';
        mail($account[ 'email' ], 'Vortex | Password Reset', $message, implode("\r\n", $headers));
        $response->setContent(json_encode([ 'success' => true ]));
        $response->headers->set('Content-Type', 'application/json');
    }
}

function login_handle_list_users_api()
{
    $response->setContent(json_encode(db_query('SELECT id, email, username FROM users')));
    $response->headers->set('Content-Type', 'application/json');
}

function login_create_account($username, $email, $password)
{
    if (login_load_account($username)) {
        throw new LoginException("An account already exists with the username '$username'");
    }
    db_query(
        '
		INSERT INTO users (username, email, password)
		VALUES (:username, :email, :password);',
        [
            ':username'     => $username,
            ':email'        => $email,
            ':password'     => login_hash_password($password),
        ]
    );
}

function login_delete_account($username_or_id)
{
    if ($account = login_load_account($username_or_id)) {
        db_query('DELETE FROM users WHERE id = :id', [ ':id' => $account[ 'id' ] ]);
        return $account;
    } else {
        throw new LoginException("Unknown account '$username_or_id'");
    }
}

function login_handle_delete_account_api($url, $options, $response)
{
    require_method('POST');

    $url  = explode('/', $url);
    $user = $url[ 2 ];
    try {
        $response->setContent(json_encode(login_delete_account($user)));
        $response->headers->set('Content-Type', 'application/json');
    } catch (LoginException $e) {
        $response->setContent('That account does not exist')->setStatusCode(404);
    }
}

function login_load_account($username_or_id)
{
    $result = db_query('SELECT * FROM users WHERE id = :param OR username = :param OR email = :param', [ ':param' => $username_or_id ]);
    if (count($result)) {
        return $result[ 0 ];
    } else {
        return [];
    }
}

function login_create_tables()
{
    try {
        db_query("
			CREATE TABLE IF NOT EXISTS users (
				id       INTEGER      PRIMARY KEY AUTOINCREMENT,
				username VARCHAR(30)  NOT NULL    UNIQUE,
				email    VARCHAR(128) NOT NULL,
				password VARCHAR(60)  NOT NULL
			);
		");
        db_query("
			CREATE TABLE IF NOT EXISTS sessions (
				id            INTEGER      PRIMARY KEY AUTOINCREMENT,
				user_id       INTEGER      NOT NULL,
				session_token VARCHAR(128) NOT NULL,
				user_ip       VARCHAR(15)  NOT NULL,
				expires       DATETIME     DEFAULT CURRENT_TIMESTAMP,
				CONSTRAINT      fk_users
					FOREIGN KEY (user_id)
					REFERENCES  users(id)
					ON DELETE   CASCADE
			);
		");
        db_query("
			CREATE TABLE IF NOT EXISTS login_tokens (
				id      INTEGER     PRIMARY KEY AUTOINCREMENT,
				token   VARCHAR(60) NOT NULL,
				user_id INTEGER     NOT NULL,
				expires DATETIME    DEFAULT CURRENT_TIMESTAMP,
				CONSTRAINT      fk_tokens
					FOREIGN KEY (user_id)
					REFERENCES  users(id)
					ON DELETE   CASCADE
			);
		");
        db_query("
			CREATE TABLE IF NOT EXISTS invitation_tokens (
				id      INTEGER     PRIMARY KEY AUTOINCREMENT,
				token   VARCHAR(60) NOT NULL,
				expires DATETIME    DEFAULT CURRENT_TIMESTAMP
			);
		");
    } catch (Exception $e) {
        throw new LoginException('A problem occurred while initializing the login system. As a '
            . ' safety precaution, Vortex will not start up until this is fixed.', 0, $e);
    }
}

function user($key = null)
{
    static $user = null;
    if ($user === null) {
        if (dpoh_session_id_is_valid()) {
            $sid     = array_get($_COOKIE, 'dpoh_session_id');
            $results = db_query('SELECT user_id FROM sessions WHERE id = :sid', [ ':sid' => $sid ]);
            $uid     = array_get($results, '0.user_id', -1);
            $user    = login_load_account($uid);
        } else {
            $user = [];
        }
    }
    return $key !== null
        ? array_get($user, $key)
        : $user;
}

function login_handle_login($url, $options, $response, $request)
{
    require_method('POST');

    $result = false;
    $username = $request->request->get('username');
    $password = $request->request->get('password');
    if ($username && $password) {
        $result = login_user($username, $password);
    }
    $response->setContent(json_encode(login_delete_account($user)));
    $response->headers->set('Content-Type', 'application/json');
}

function login_clear_expired_sessions_and_tokens()
{
    $tables = [
        'login_tokens',
        'invitation_tokens',
        'sessions',
    ];
    foreach ($tables as $table) {
        db_query("DELETE FROM `$table` WHERE expires < CURRENT_timestamp");
    }
}

function login_render_interface()
{
    echo render('login_page', [ 'mode' => 'login' ]);
}

function login_user($username, $password = null)
{
    $account = login_load_account($username);

    if (!$account || ($password !== null && !password_verify($password, $account[ 'password' ]))) {
        return false;
    }

    $session_token = get_random_token(25);
    db_query(
        '
		INSERT INTO sessions (user_id, session_token, user_ip, expires)
		VALUES (:user_id, :session_token, :user_ip, date( CURRENT_TIMESTAMP, "+3 day"))',
        [
            ':user_id'       => $account[ 'id' ],
            ':session_token' => login_hash_password($session_token),
            ':user_ip'       => get_user_ip(),
        ]
    );
    setcookie('dpoh_session_id', db()->lastInsertId(), 0, '/');
    setcookie('dpoh_session_token', $session_token, 0, '/');
    return true;
}

function dpoh_session_id_is_valid($session_id = false, $session_token = false, $user_ip = false)
{
    $session_id    = $session_id    ?: array_get($_COOKIE, 'dpoh_session_id');
    $session_token = $session_token ?: array_get($_COOKIE, 'dpoh_session_token');
    $user_ip       = $user_ip ?: get_user_ip();

    $session_record = db_query('SELECT * FROM sessions WHERE id = :session_id', [
        ':session_id' => $session_id
    ]);
    if (!db_query(
        'SELECT COUNT(*) count FROM users WHERE id = :id',
        [ ':id' => array_get($session_record, '0.user_id') ]
    )[ 0 ][ 'count' ]) {
        return false;
    }
    $session_token_hashed = array_get($session_record, '0.session_token');
    return password_verify($session_token, $session_token_hashed)
        && $user_ip == array_get($session_record, '0.user_ip');
}

function any_users_exist()
{
    return !!db_query('SELECT COUNT(*) count FROM users;')[ 0 ][ 'count' ];
}

function login_hash_password($password)
{
    return password_hash($password, PASSWORD_BCRYPT);
}
