/**
 *
 */
namespace( 'Vue' ).Splash = (function( $ )
{
	var did_load = false;

	function onWindowLoad()
	{
		did_load = true;
		onWindowResized( '*' );
	}

	function onSessionStatusChanged( e )
	{
		if ( e.status == 'active' )
		{
			Theme.PageTitle.update( 'status', 'active' );
		}
		else
		{
			Theme.PageTitle.update( 'status', ( BasicApi.SocketServer.isConnected() ? 'waiting' : 'disconnected' ) );
		}
	}

	function onWindowResized( pane_name )
	{
		publish( 'layout-changed', {
			pane : pane_name,
		} );
	};

	function onAnimationEnd()
	{
		if ( did_load )
		{
			$( '.splash-outermost' ).addClass( 'out' )
				.find( '.full' )
				.css( 'animation-fill-mode', 'none' );
		}
		else
		{
			$( '.v' ).toggleClass( 'a b' );
		}
	}

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
	$( document ).on( 'animationend', '.v.v1', onAnimationEnd );
	$( document ).on( 'transitionend', '.splash-outermost', onTransitionEnd );
}( jQuery ));
