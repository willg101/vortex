namespace( 'Autorun' ).Controller = (function( $ )
{
	// The currently-selected autorun mode (in the settings page)
	var selected_item = false;

	/**
	 * @retval string
	 */
	function getCurrentMode()
	{
		return localStorage.getItem( 'vortex_autoplay_mode' ) || 'not_focused';
	}

	/**
	 * @brief
	 *	Session init handler; determines if the debug session should use autorun
	 */
	function onSessionInit( e )
	{
		whenReadyTo( 'inspect-context' ).then( function()
		{
			// If the request includes a "VORTEX_NO_AUTORUN" GET param, we will not autorun
			BasicApi.Debugger.command( 'property_get', { name : '$_GET["VORTEX_NO_AUTORUN"]' }, function( data )
			{
				if ( !data.parsed || !data.parsed[ 0 ] ) // No "VORTEX_NO_AUTORUN" GET param
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

	/**
	 * @retval Array
	 *	An Array of plain objects that represent the available autorun modes
	 */
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

	/**
	 * @brief
	 *	gather-settings-pages handler
	 */
	function provideSettingsPage( e )
	{
		e.pages.push( {
			val   : 'autorun',
			icon  : 'bolt',
			title : 'Autorun',
		} );
	}

	/**
	 * @brief
	 *	gather-settings-page-widgets handler
	 */
	function provideSettingsPageWidgets( e )
	{
		if ( e.page == 'autorun' )
		{
			e.widgets.push( render( 'autorun.settings', {
				modes : getModes(),
			} ) );
		}
	}

	/**
	 * @brief
	 *	save-settings handler
	 */
	function saveSettings( e )
	{
		if ( selected_item && selected_item != getCurrentMode() )
		{
			localStorage.setItem( 'vortex_autoplay_mode', selected_item );
		}
	}

	/**
	 * @brief
	 *	cache-settings handler
	 */
	function cacheSettings( e )
	{
		if ( e.page == 'autorun' )
		{
			selected_item = $( '[name=autorun_mode]:checked' ).val();
		}
	}

	/**
	 * @brief
	 *	clear-cache-settings handler
	 */
	function clearCachedSettings()
	{
		selected_item = false;
	}

	/**
	 * @brief
	 *	alter-dummy-session-request handler; adds a GET param to the request to prevent autorun
	 */
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
