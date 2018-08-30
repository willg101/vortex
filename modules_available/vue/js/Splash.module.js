import WsClient from '../../debugger/js/WsClient.module.js'

/**
 *
 */
namespace( 'Vue' ).Splash = (function( $ )
{
	function onWindowLoad()
	{
		onWindowResized( '*' );
		$( '.splash-outermost' ).addClass( 'out' )
			.find( '.full' ).addClass( 'stop' );

		var i = 12
		$( '[data-role=window]' ).each( function()
		{
			setTimeout( function()
			{
				$( this ).removeClass( 'not-loaded' );
			}.bind( this ), i * 50 );
			i++;
		} );
	}

	function onSessionStatusChanged( e )
	{
		if ( e.status == 'active' )
		{
			Theme.PageTitle.update( 'status', 'active' );
		}
		else
		{
			Theme.PageTitle.update( 'status', ( WsClient.isConnected() ? 'waiting' : 'disconnected' ) );
		}
	}

	function onWindowResized( pane_name )
	{
		publish( 'layout-changed', {
			pane : pane_name,
		} );
	};

	function onTransitionEnd( e )
	{
		$( e.target ).remove();
	}

	$( window ).on( 'beforeunload', onUnload );
	function onUnload()
	{
		$( 'body' ).addClass( 'unload' );
	}

	subscribe( 'session-status-changed',    onSessionStatusChanged );
	$( window ).on( 'load', onWindowLoad );
	$( document ).on( 'transitionend', '.splash-outermost', onTransitionEnd );

}( jQuery ));
