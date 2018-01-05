(function( $ )
{
	var interval           = null;
	var poll_delay         = 100;
	var seconds            = 10;
	var countdown_start    = false;
	var currently_ignoring = false;

	function init()
	{
		MainController.setTitleFormat( '{init} ({auto_ignore_status})' )
	}

	function getSeconds()
	{
		return Math.round( new Date().getTime() / 1000 );
	}

	function onVisibilityChange()
	{
		if ( document.visibilityState == 'hidden' )
		{
			if ( !BasicApi.Debugger.sessionIsActive() )
			{
				countdown_start = getSeconds();
				PageTitle.update( 'auto_ignore_status', seconds + 's' );
				PageTitle.setFormat( '{init} ({auto_ignore_status})' );
				setInterval( countdown, poll_delay );
			}
		}
		else
		{
			PageTitle.setFormat( null );
			clearInterval( interval );
			currently_ignoring = false;
		}
	}

	function countdown()
	{
		var n = countdown_start + seconds - getSeconds();
		if ( n > 0 )
		{
			PageTitle.update( 'auto_ignore_status', n + 's' );
		}
		else
		{
			PageTitle.update( 'auto_ignore_status', 'ignoring' );
			clearInterval( interval );
			countdown_start = false;
			currently_ignoring = true;
		}
	}

	function countdownFinished()
	{
		countdown_start = false;
		MainController.setTitleData( 'auto_ignore_status', 'ignoring' );
	}

	function onSessionInit()
	{
		if ( currently_ignoring )
		{
			BasicApi.Debugger.command( 'detach' );
		}
		else
		{
			clearInterval( interval );
			countdown_start = false;
			PageTitle.setFormat( false );
		}
	}

	$( document ).on( 'dpoh:session-init', onSessionInit )
	$( document ).on( 'visibilitychange',  onVisibilityChange );

}( jQuery ));
