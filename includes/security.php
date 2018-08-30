<?php

class SecurityException extends Exception {}

/**
 * @brief
 *	Generate a cryptographically secure random token
 *
 * @param int $bytes The number of random bytes (*NOT* characters)
 * @retval string
 *
 * @throws SecurityException if `openssl_random_pseudo_bytes` sets $crypto_strong to FALSE
 */
function get_random_token( $bytes )
{
	$is_secure = FALSE;
	$token = bin2hex( openssl_random_pseudo_bytes( $bytes, $is_secure ) );
	if ( !$is_secure )
	{
		throw new SecurityException( 'openssl_random_pseudo_bytes indicated that a weak token was generated' );
	}
	return $token;
}
