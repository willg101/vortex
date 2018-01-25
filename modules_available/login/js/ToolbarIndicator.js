(function( $ )
{
	function provideSettingsQuickActions( e )
	{
		e.items.unshift( {
			content : 'Log out',
			attr : {
				'data-action' : 'logout'
			},
		} );
	}

	function onLogoutClicked()
	{
		$( 'body > *' ).css( { transition : '500ms', opacity : 0, transform : 'scale(.8)', filter: 'blur(10px)' } );
		$.get( makeUrl( 'logout' ), function()
		{
			location.reload();
		} );
	}

	subscribe( 'alter-settings-quick-actions', provideSettingsQuickActions );
	$( document ).on( 'click', '[data-action=logout]', onLogoutClicked )
}( jQuery ));
