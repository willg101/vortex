(function( $ )
{
	function getMenuItems()
	{
		var items = [ {
			content : 'Log out',
			attr : { 'data-action' : 'logout' },
		} ];
		publish( 'alter-user-menu-items', { items : items } );
		return items;
	}

	function onIndicatorClicked()
	{
		var indicator = $( '#login_indicator' );
		var items = getMenuItems();
		new Theme.PopoverList( '', items , [ 'auto-size' ], { my : 'right top', at : 'right bottom', of : indicator }, indicator );
	}

	function onLogoutClicked()
	{
		$( 'body > *' ).css( { transition : '500ms', opacity : 0, transform : 'scale(.8)', filter: 'blur(10px)' } );
		$.get( makeUrl( 'logout' ), function()
		{
			location.reload();
		} );
	}

	$( document ).on( 'click', '#login_indicator',     onIndicatorClicked );
	$( document ).on( 'click', '[data-action=logout]', onLogoutClicked )
}( jQuery ));
