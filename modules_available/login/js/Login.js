Login = (function( $ )
{
	$( document ).on( 'click', '.login-sign-out', function( e )
	{
		$.post( makeUrl( 'logout' ), function(){ location.reload(); } );
	} );

	$( document ).on( 'keypress', '.login-form input', tryLogin );
	$( document ).on( 'click', 'button.login', tryLogin );

	function tryLogin( e )
	{
		if ( e.type == 'keypress' && e.which != 13 )
		{
			return;
		}

		$.post( makeUrl( 'login' ), {
			username : $( '[name=username]' ).val(),
			password : $( '[name=password]' ).val(),
			action   : 'login',
		},
		function( data )
		{
			if ( data.login_result )
			{
				$( '#form_container' ).addClass( 'small' );
				location.reload();
			}
			else
			{
				shakeForm();
			}
		} );
	}

	function shakeForm()
	{
		$( '#login_form_container' ).removeClass( 'shake' );
		setTimeout( function(){ $( '#login_form_container' ).addClass( 'shake' ); }, 30 );
	}

	$( document ).on( 'click', '#create_account', function( e )
	{
		$.post( makeUrl( 'api/create-account' ), {
			username  : $( '[name=username]' ).val(),
			email     : $( '[name=email]' ).val(),
			password1 : $( '[name=password1]' ).val(),
			password2 : $( '[name=password2]' ).val(),
			it        : $( '[name=it]' ).val(),
			iid       : $( '[name=iid]' ).val(),
		},
		function( data )
		{
			location.reload();
		} ).fail( function( message )
		{
			shakeForm();
		} );
	} );

	$( document ).on( 'click', '#reset_password', function( e )
	{
		$.post( makeUrl( 'api/reset-password' ), {
			otlt      : $( '[name=otlt]' ).val(),
			tid       : $( '[name=tid]' ).val(),
			password1 : $( '[name=password1]' ).val(),
			password2 : $( '[name=password2]' ).val(),
		},
		function( data )
		{
			location.reload();
		} ).fail( function( message )
		{
			shakeForm();
		} );
	} );

	function onResetConfirmed( e )
	{
		var username_or_email = $( '[name=username_reset_pw]' ).val();

		var form = $( '#login_form_container' );
		$.post( makeUrl( 'api/users/' + username_or_email + '/reset-password' ), function( data ){
			$( '[name=username_reset_pw]' ).val( '' );
			new Theme.Popover( 'A link to reset your password has been sent to your email address.', [], { my : 'center', at : 'center', of : form }, form );
		} ).fail( shakeForm );
	}

	function onRemoveClicked( e )
	{
		var row = $( e.target ).closest( '[data-user-id]' );
		var user_id = row.attr( 'data-user-id' );
		new Theme.Popover( render( 'login.confirmation', { user_id : user_id, comfirm_type : 'remove' } ), [ 'remove-account-popover' ], { at : 'left bottom', my : 'left top', of : $( e.target ).closest( 'button' ) }, $( e.target ).closest( 'button' ) );
	}

	function onRemoveConfirmed( e )
	{
		var user_id = $( e.target ).closest( '[data-user-id]' ).attr( 'data-user-id' );
		var form = $( '.modal' );
		$.post( makeUrl( 'api/users/' + user_id + '/remove' ), function( data ){
			new Theme.Popover( 'This account has been removed.', [], { my : 'center', at : 'center', of : form }, form );
		} ).fail( shakeForm );
	}

	function provideSettingsPage( e )
	{
		e.pages.push( {
			val   : 'users',
			icon  : 'user',
			title : 'User Accounts',
		} );
	}

	function provideSettingsPageWidgets( e )
	{
		if ( e.page == 'users' )
		{
			requestUserAccounts( function( success, accounts )
			{
				if ( success )
				{
					$( '.user-accounts-listing' ).html( render( 'login.user_accounts_listing', {
						accounts : accounts,
					} ) );
				}
				else
				{
					$( '.user-accounts-listing' ).text( 'User accounts failed to load.' );
				}
			} );

			e.widgets.push( render( 'login.settings', {
				spinner : new Theme.Spinner,
			} ) );
		}
	}

	function requestUserAccounts( cb )
	{
		$.get( makeUrl( 'api/users/list' ), cb.bind( undefined, true ) ).fail( cb.bind( undefined, false, {} ) );
	}

	var selected_item = false;
	function saveSettings( e )
	{
		if ( selected_item && selected_item != getCurrentMode() )
		{
			localStorage.setItem( 'vortex_autoplay_mode', selected_item );
		}
	}

	function cacheSettings( e )
	{
		if ( e.page == 'autorun' )
		{
			selected_item = $( '[name=autorun_mode]:checked' ).val();
		}
	}

	function clearCachedSettings()
	{
		selected_item = false;
	}

	function switchToReset()
	{
		$( '.reset-pw-form, .login-form' ).toggleClass( 'inactive' );
	}

	function inviteUser( e )
	{
		if ( e.type == 'keypress' && e.which != 13 )
		{
			return;
		}

		var email = $( '#invite_user' ).val();
		$.ajax( { method: 'post', url : makeUrl( 'api/users/invite/' + $( '#invite_user' ).val() ), complete : function( xhr )
		{
			if ( xhr.status < 400 )
			{
				$( '#invite_user' ).val( '' );
			}
			new Theme.Popover( ( xhr.status >= 400 ? '<i class="fa fa-warning margin-right"></i>' : '' ) + xhr.responseText, [], { 'of' : $( '#invite_user' ) }, $( '#invite_user' ) );
		} } );
	}

	$( document ).on( 'click', '.btn.reset-pw, .cancel-reset', switchToReset );

	$( document ).on( 'click', '.all-user-accounts .remove-account', onRemoveClicked )
	$( document ).on( 'click', '[data-confirm=remove]', onRemoveConfirmed )

	$( document ).on( 'click', '.reset-pw-submit', onResetConfirmed )

	$( document ).on( 'click', '.invite-user', inviteUser );
	$( document ).on( 'keypress', '#invite_user', inviteUser );

	subscribe( 'gather-settings-pages', provideSettingsPage );
	subscribe( 'gather-settings-page-widgets', provideSettingsPageWidgets );
	subscribe( 'save-settings', saveSettings );
	subscribe( 'cache-settings', cacheSettings );
	subscribe( 'clear-cached-settings', clearCachedSettings );


}( jQuery ));
