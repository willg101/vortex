var $ = jQuery;

subscribe( 'alter-settings-quick-actions', function( e )
{
	e.items.unshift( {
		content : 'Log out',
		attr : {
			'data-action' : 'logout'
		},
	} );
} );

$( document ).on( 'click', '[data-action=logout]', function()
{
	$( 'body > *' ).css( { transition : '500ms', opacity : 0, transform : 'scale(.8)', filter: 'blur(10px)' } );
	$.get( makeUrl( 'logout' ), function()
	{
		location.reload();
	} );
} );
