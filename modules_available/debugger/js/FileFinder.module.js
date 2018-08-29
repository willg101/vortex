import File                 from './File.module.js'
import RecentFiles          from './RecentFiles.module.js'
import ProgramStateUIRouter from './ProgramStateUIRouter.module.js'
import ProgrammingLanguage  from './ProgrammingLanguage.module.js'

var $ = jQuery;
var dir_aliases = {};

$.fn.moveCursorToEnd = function()
{
	return this.each( () =>
	{
		this[ 0 ].scrollLeft = this[ 0 ].scrollWidth;
	} );
}

$( document ).on( 'click', '#file_finder', function()
{
	var recent_files_popover = $( '#file_finder' ).data( 'toggles_popover' );
	if ( !recent_files_popover )
	{
		var lists = [
			{
				title : 'Recently Edited',
				id : 'recently_edited',
				options : false,
			},
		];
		var recent_files = listRecentlyOpenFiles();
		if ( recent_files.length )
		{
			lists.unshift( {
				title : 'Recently Viewed',
				options : recent_files,
			} );
		}
		recent_files_popover = new Theme.PopoverList( {
			lists   : lists,
			classes : [],
			el      : $( '#file_finder' ),
			side    : 'left',
		} );

		// Asynchronously fill in the recently edited files
		BasicApi.RemoteFiles.listRecent( function( success, data )
		{
			if ( success )
			{
				var list = [];
				for ( var i in data )
				{
					list.push( {
						attr : {
							'data-open-file' : data[ i ].fullpath,
						},
						content : data[ i ].name,
					} );
				}
				recent_files_popover.setList( 'recently_edited', {
					id      : 'recently_edited',
					title   : 'Recently Edited',
					options : list,
				} );
			}
			else
			{
				recent_files_popover.setContent( '<i class="fa fa-warning"></i> An error occured.' );
			}
		} );
	}
	else
	{
		recent_files_popover.remove();
	}
} );

$( document ).on( 'keydown', '#file_finder', function( e )
{
	if ( e.which == 9 ) // tab
	{
		e.preventDefault(); // Don't let `tab` remove focus from the element
		var current_val = $( e.target ).val();

		if ( dir_aliases[ current_val ] )
		{
			$( e.target ).val( dir_aliases[ current_val ] ).moveCursorToEnd();
		}
		else
		{
			processGlobOnServer( current_val, function( items )
			{
				var popover = $( '#file_finder' ).data( 'toggles_popover' );

				if ( items.length == 0 )
				{
					popover && popover.remove();
				}
				else if ( items.length == 1 )
				{
					$( '#file_finder' ).blur().focus().val( '' ).val( items[ 0 ].name
						+ ( items[ 0 ].type == 'dir' ? '/' : '' ) );
					popover && popover.remove()
				}
				else if ( items.length > 1 )
				{
					let common_prefix = new CommonPrefixFinder;
					let items_for_rendering = [];

					items.forEach( function( el, i )
					{
						var current_text = el.name;
						items_for_rendering.push( {
							attr : {
								'data-full-path' : current_text,
								class : 'globber-option globber-' + el.type,
							},
							content : File.basename( current_text ),
						} );
						common_prefix.add( current_text );
					} );

					items_for_rendering = items_for_rendering.sort( function( a, b )
					{
						if ( a.content.toLowerCase() > b.content.toLowerCase() )
						{
							return 1;
						}
						else if ( b.content.toLowerCase() > a.content.toLowerCase() )
						{
							return - 1;
						}
						else
						{
							return 0;
						}
					} );

					if ( !popover )
					{
						popover = new Theme.PopoverList( {
							lists : [
								{
									title : '',
									options : false,
								},
							],
							classes : [ '' ],
							el      : $( '#file_finder' ),
							side    : 'left',
						} );
					}

					popover.setLists( [ { title : '', options : items_for_rendering } ] );
					$( '#file_finder' ).blur().focus().val( '' ).val( common_prefix.get() );
				}

				$( '#file_finder' ).moveCursorToEnd();
			} );
		}
	}
	else if ( e.which == 13 ) // `Enter` key
	{
		e.preventDefault();
		var file = $( e.target ).val();
		processGlobOnServer( file, function( items )
		{
			if ( items.length == 1 && items[ 0 ].type == 'file' )
			{
				$( '#file_finder' ).val( '' ).blur();
				ProgramStateUIRouter.setFile( file );
			}
			else
			{
				var found_exact_match = false;
				items.some( function( el )
				{
					if ( el.name == file && el.type == 'file' )
					{
						$( '#file_finder' ).val( '' ).blur();
						ProgramStateUIRouter.setFile( file );
						found_exact_match = true;
						return true;
					}
				} );

				if ( !found_exact_match )
				{
					$( '#file_finder' ).addClass( 'shake' );
					setTimeout( function()
					{
						$( '#file_finder' ).removeClass( 'shake' );
					}, 500 );
				}
			}
		} );
	}
} );

$( document ).on( 'focusin', '#file_finder', function( e )
{
	if ( ! $( '#file_finder' ).val().trim() )
	{
		$( '#file_finder' ).val( File.dirname( ProgramStateUIRouter.getFile() || '/' ) );
	}

	setTimeout( function()
	{
		var val = $( '#file_finder' ).val();
		$( '#file_finder' ).val( '' ).val( val ).moveCursorToEnd();
	}, 30 );
	return false;
} );

$( document ).on( 'focusout', '#file_finder', function()
{
	$( '#file_buttons' ).removeClass( 'blur-hidden' );
} );

$( document ).on( 'click', '.globber-option', function( e )
{
	var target = $( e.target ).closest( '.globber-option' );
	var path = target.attr( 'data-full-path' );
	if ( target.is( '.globber-dir' ) )
	{
		$( '#file_finder' ).val( path + '/' ).focus().moveCursorToEnd();
	}
	else if ( target.is( '.globber-file' ) )
	{
		$( '#file_finder' ).val( '' );
		ProgramStateUIRouter.setFile( target.attr( 'data-full-path' ) );
	}
} );

async function processGlobOnServer( prefix, cb )
{
	if ( !BasicApi.Debugger.sessionIsActive() )
	{
		BasicApi.SocketServer.send( 'X-glob', { p : prefix }, function( e )
		{
			var items = [];
			$( e.message_raw ).find( '[type]' ).each( function()
				{
					items.push( {
						type : $( this ).attr( 'type' ),
						name : $( this ).text(),
					} );
				} );
			cb( items );
		} );
	}
	else
	{
		// Handling this via the DE allows us to use the program's host file system, which may
		// differ from the Vortex host
		cb( await ProgrammingLanguage.tx( 'globDirectory', prefix ) );
	}
}

function listRecentlyOpenFiles()
{
	var list = [];

	RecentFiles.list().forEach( ( filename ) =>
	{
		list.push( {
			content : File.basename( filename ),
			attr : {
				'data-open-file' : filename,
			},
		} );
	} );

	return list;
}

class CommonPrefixFinder
{
	constructor()
	{
		this.prefix = false;
	}

	add( str )
	{
		if ( this.prefix === false )
		{
			this.prefix = str;
			return;
		}

		this.prefix = this.prefix.substr( 0, Math.min( str.length, this.prefix.length ) );
		for ( var i = 0; i < this.prefix.length; i++ )
		{
			if ( str[ i ] != this.prefix[ i ] )
			{
				this.prefix = str.substr( 0, i );
				return;
			}
		}
	}

	get()
	{
		return this.prefix || '';
	}
}

subscribe( 'provide-tests', function()
{
	describe( 'FileFinder', function()
	{
		it( 'CommonPrefixFinder', function()
		{
			var finder = new CommonPrefixFinder;
			expect( finder.get() ).toBe( '' );

			finder.add( 'abcdefg' );
			expect( finder.get() ).toBe( 'abcdefg' );

			finder.add( 'abcdefghijk' );
			expect( finder.get() ).toBe( 'abcdefg' );

			finder.add( 'abc' );
			expect( finder.get() ).toBe( 'abc' );

			finder.add( 'xyz' );
			expect( finder.get() ).toBe( '' );

			finder.add( 'abc' );
			expect( finder.get() ).toBe( '' );
		} );
	} );
} );
