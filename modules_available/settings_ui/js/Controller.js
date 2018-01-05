namespace( 'SettingsUI' ).Controller = (function( $ )
{
	var most_recent_page;

	function gatherSettingsPages()
	{
		var event = {
			pages : [],
		};
		publish( 'gather-settings-pages', event );

		var pages = event.pages.sort( function( a, b )
		{
			if ( a.title > b.title )
			{
				return 1;
			}
			else if ( b.title < a.title )
			{
				return -1;
			}
			else
			{
				return 0;
			}
		} )

		var default_page = most_recent_page;

		if ( !default_page && pages[ 0 ] )
		{
			default_page = pages[ 0 ].val;
		}

		for ( var i = 0; i < pages.length; i++ )
		{
			if ( pages[ i ].val == default_page )
			{
				pages[ i ].default_page = true;
				break;
			}
		}

		return {
			pages : pages,
			default_page : default_page,
		}
	}

	function gatherSettingsPageWidgets( page )
	{
		var event = {
			page : page,
			widgets : [],
		};
		publish( 'gather-settings-page-widgets', event );
		return event.widgets.join( '' );
	}

	function onSettingsClicked()
	{
		clearCachedSettings();

		var pages_info = gatherSettingsPages();

		var current_page = {};
		for ( var i in pages_info.pages )
		{
			if ( pages_info.pages[ i ].default_page )
			{
				current_page = pages_info.pages[ i ];
				break;
			}
		}

		Theme.Modal.set( {
			title   : 'Settings',
			content : render( 'settings_ui.settings_modal', {
				widgets : gatherSettingsPageWidgets( pages_info.default_page ),
				icon : current_page.icon,
				title : current_page.title,
			} ),
		} );
		Theme.Modal.show();
	}

	function cacheSettings()
	{
		publish( 'cache-settings', { page : most_recent_page } );
	}

	function clearCachedSettings()
	{
		publish( 'clear-cached-settings' );
	}

	function onSaveClicked()
	{
		cacheSettings();
		publish( 'save-settings' );
		Theme.Modal.hide();
		publish( 'settings-saved' );
	}

	function onSettingsPageChanged()
	{
		cacheSettings();
		var page = $( '.settings-page' ).val();
		most_recent_page = page;
		$( '.settings-widgets' ).html( gatherSettingsPageWidgets( page ) );
	}

	function provideSettingsPages( e )
	{
		e.pages.push( {
			val   : 'general',
			icon  : 'gear',
			title : 'General Settings',
		} );
		e.pages.push( {
			val   : 'about',
			icon  : 'info-circle',
			title : 'About',
		} );
	}

	function provideSettingsPageWidgets( e )
	{
		if ( e.page == 'about' )
		{
			e.widgets.push( 'Vortex Debugger &copy; 2017 Will Groenendyk.' );
		}
		else if ( e.page == 'general' )
		{
			e.widgets.push( '<table><tr><td class="sm-cell"><button class="btn black" data-command="ctrl:restart"><span class="fa fa-fw fa-undo"></span></button></td><td>Restart the socket bridge</td></tr></table>' );
		}
	}

	function onSettingsPageClicked( e )
	{
		cacheSettings();
		var page_id = $( e.target ).closest( '[data-show-settings-page]' ).attr( 'data-show-settings-page' );
		most_recent_page = page_id;
		$( '.settings-page' ).html( $( e.target ).closest( '[data-show-settings-page]' ).html() );
		$( '.settings-widgets' ).html( gatherSettingsPageWidgets( page_id ) );
	}

	function onSettingsSelectorClicked()
	{
		var list           = gatherSettingsPages().pages;
		var list_processed = [];
		for ( var i in list )
		{
			list_processed.push( {
				content : '<i class="fa fa-fw fa-' + list[i].icon + '"></i> ' + list[i].title,
				attr : { 'data-show-settings-page' : list[i].val },
			} );
		}
		new Theme.PopoverList( '', list_processed, [], { my : 'left top', at : 'left bottom', of : $( '.settings-page' ) }, $( '.settings-page' ) );
	}

	$( document ).on( 'click',  '.show-settings', onSettingsClicked );
	$( document ).on( 'click',  '.save-settings', onSaveClicked );
	$( document ).on( 'click',  '.settings-page', onSettingsSelectorClicked );
	$( document ).on( 'click',  '[data-show-settings-page]', onSettingsPageClicked );
	$( document ).on( 'change', '.settings-page', onSettingsPageChanged );

	subscribe( 'gather-settings-pages',        provideSettingsPages );
	subscribe( 'gather-settings-page-widgets', provideSettingsPageWidgets );

}( jQuery ));
