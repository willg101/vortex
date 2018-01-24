namespace( 'Autorun' ).Controller = (function( $ )
{
	function getCurrentMode()
	{
		return localStorage.getItem( 'vortex_autoplay_mode' ) || 'not_focused';
	}

	function onSessionInit( e )
	{
		whenReadyTo( 'inspect-context' ).then( function()
		{
			BasicApi.Debugger.command( 'property_get', { name : '$_GET["VORTEX_NO_AUTORUN"]' }, function( data )
			{
				if ( !data.parsed || !data.parsed[ 0 ] )
				{
					var mode = getCurrentMode();

					if ( mode != 'disabled' && ( document.visibilityState == 'hidden' || mode == 'always' ) )
					{
						whenReadyTo( 'autorun' ).then( BasicApi.Debugger.command.bind( null, 'run' ) );
					}
				}
			} );
		} );
	}

	function getModes()
	{
		var current_mode = getCurrentMode();
		var modes = [
			{
				title : 'Take no action',
				id    : 'disabled',
			},
			{
				title : 'Run to the first breakpoint',
				id    : 'always',
			},
			{
				title : 'Run to the first breakpoint when this tab is not focused',
				id    : 'not_focused',
			},
		];

		for ( var i in modes )
		{
			if ( current_mode == modes[ i ].id )
			{
				modes[ i ].selected = true;
			}
		}

		return modes;
	}

	function provideSettingsPage( e )
	{
		e.pages.push( {
			val   : 'autorun',
			icon  : 'bolt',
			title : 'Autorun',
		} );
	}

	function provideSettingsPageWidgets( e )
	{
		if ( e.page == 'autorun' )
		{
			e.widgets.push( render( 'autorun.settings', {
				modes : getModes(),
			} ) );
		}
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

	function alterDummySessionRequest( e )
	{
		e.options.params.VORTEX_NO_AUTORUN = 1;
	}

	subscribe( 'gather-settings-pages', provideSettingsPage );
	subscribe( 'gather-settings-page-widgets', provideSettingsPageWidgets );
	subscribe( 'save-settings', saveSettings );
	subscribe( 'cache-settings', cacheSettings );
	subscribe( 'clear-cached-settings', clearCachedSettings );
	subscribe( 'session-init', onSessionInit );
	subscribe( 'alter-dummy-session-request', alterDummySessionRequest );
}( jQuery ));
