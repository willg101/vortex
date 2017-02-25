Login = (function( $, sendApiRequest )
{
	$( document ).on( 'click', '.login-sign-out', function( e )
	{
		sendApiRequest( 'post', { action : 'logout' }, function(){ location = location; } );
	} );

	$( document ).on( 'keypress', '.login-form input', function( e )
	{
		if ( e.which != 13 )
		{
			return;
		}

		sendApiRequest( 'post', {
			username : $( '[name=username]' ).val(),
			password : $( '[name=password]' ).val(),
			action   : 'login',
		},
		function( data )
		{
			if ( data.login_result )
			{
				$( '#form_container' ).addClass( 'small' );
				location = location;
			}
			else
			{
				$( '.login-form' ).removeClass( 'shake' );
				setTimeout( function(){ $( '.login-form' ).addClass( 'shake' ); }, 30 );
			}
		} );
	} );
}( jQuery, send_api_request ));
