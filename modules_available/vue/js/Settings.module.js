var most_recent_page;

$( document ).on( 'click', '#settings_toolbar', function()
{
	var indicator = $( '#settings_toolbar' );
	var items = getQuickActions();
	new vTheme.PopoverList( {
		lists : [
			{
				title : '',
				options : items,
			},
		],
		classes : [ 'auto-size' ],
		el      : indicator,
		side    : 'right',
	} );
} );

$( document ).on( 'click', '[data-action=open-settings]', function()
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

	vTheme.showModal( 'Settings', render( 'vue.settings_modal', {
		widgets : gatherSettingsPageWidgets( pages_info.default_page ),
		icon : current_page.icon,
		title : current_page.title,
	} ) );
} );

$( document ).on( 'click', '.save-settings', function()
{
	cacheSettings();
	publish( 'save-settings' );
	vTheme.hideModal();
	publish( 'settings-saved' );
} );

$( document ).on( 'change', '.settings-page', function()
{
	cacheSettings();
	var page = $( '.settings-page' ).val();
	most_recent_page = page;
	$( '.settings-widgets' ).html( gatherSettingsPageWidgets( page ) );
} );

subscribe( 'gather-settings-pages', function( e )
{
	e.pages.push( {
		val   : 'about',
		icon  : 'info-circle',
		title : 'About',
	} );
} );

subscribe( 'gather-settings-page-widgets', function( e )
{
	if ( e.page == 'about' )
	{
		e.widgets.push( 'Vortex Debugger &copy; 2018 Will Groenendyk.' );
	}
} );

$( document ).on( 'click', '[data-show-settings-page]', function( e )
{
	cacheSettings();
	var page_id = $( e.target ).closest( '[data-show-settings-page]' ).attr( 'data-show-settings-page' );
	most_recent_page = page_id;
	$( '.settings-page' ).html( $( e.target ).closest( '[data-show-settings-page]' ).html() );
	$( '.settings-widgets' ).html( gatherSettingsPageWidgets( page_id ) );
} );

$( document ).on( 'click', '.settings-page', function()
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
	new vTheme.PopoverList( {
		lists : [
			{
				title : '',
				options : list_processed,
			},
		],
		classes : [],
		el      : $( '.settings-page' ),
		side    : 'left',
	} );
} );

function getQuickActions()
{
	var items = [
		{
			content : 'All settings...',
			attr : {
				'data-action' : 'open-settings',
			},
		},
	];
	publish( 'alter-settings-quick-actions', { items : items } );
	return items;
}

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

function cacheSettings()
{
	publish( 'cache-settings', { page : most_recent_page } );
}

function clearCachedSettings()
{
	publish( 'clear-cached-settings' );
}
