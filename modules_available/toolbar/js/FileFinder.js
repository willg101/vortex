namespace( 'CodeInspector' ).FileFinder = (function( $ )
{
	var dir_aliases = {};

	function init()
	{
		BasicApi.Config.get( 'file_aliases', function( success, data )
		{
			dir_aliases = ( success && data ) || {};
		} );
	}

	function showFileButtons()
	{
		/*$( '<span id="file_buttons">'
				+ '<i class="fa fa-folder show-tree no-close-popover"></i>'
				+ '<i class="fa fa-history recent-file closed no-close-popover"></i>'
			+ '</span>'
		).appendTo( $( '#file_finder' ).parent() );
		repositionFileButtons();*/
	}

	function repositionFileButtons()
	{
		/*$( '#file_buttons' ).position( {
			my : 'right center',
			of : '#file_finder',
			at : 'right center'
		} );*/
	}

	function onRecentFilesClicked( e )
	{
		var recent_files_popover = $( e.target ).data( 'toggles_popover' );
		if ( !recent_files_popover )
		{
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
					recent_files_popover.setList( list );
				}
				else
				{
					recent_files_popover.setContent( '<i class="fa fa-warning"></i> An error occured.' );
				}
			} );

			recent_files_popover = new Theme.PopoverList( 'Recently Edited Files', false, [], { 'of' : e.currentTarget }, $( e.currentTarget ) );
		}
		else
		{
			recent_files_popover.remove();
		}
	}

	function onGlobberKeydown( e )
	{
		if ( e.which == 9 )
		{
			e.preventDefault();
			current_val = $( e.target ).val();
			if ( dir_aliases[ current_val ] )
			{
				$( e.target ).val( dir_aliases[ current_val ] );
				e.target.scrollLeft = e.target.scrollWidth;
			}
			else
			{
				BasicApi.SocketServer.send( 'X_glob', { p : current_val }, function( e )
				{
					var items = $( e.message_raw ).find( '[type]' );
					var popover = $( '#file_finder' ).data( 'toggles_popover' )
						|| new Theme.PopoverList( false, false, [], { my : 'left top', at : 'left bottom', of : '#file_finder' }, $( '#file_finder' ) );

					popover.setContent( '' );

					if ( items.length == 0 )
					{
						popover.remove();
					}
					else if ( items.length == 1 )
					{
						$( '#file_finder' ).blur().focus().val( '' ).val( items.text()
							+ ( items.attr( 'type' ) == 'dir' ? '/' : '' ) );
						popover.remove()
					}
					else if ( items.length > 1 )
					{
						var base, min, items_for_rendering = [];
						items.each( function( i, el )
						{
							el = $( el );
							var current_text = el.text();
							items_for_rendering.push( {
								attr : {
									'data-full-path' : current_text,
									class : 'globber-option globber-' + $( el ).attr( 'type' )
								},
								content : current_text.replace( /^.*\//, '' ),
							} );

							if ( !base )
							{
								base = current_text;
								min = base.length;
							}
							else
							{
								min = Math.min( min, current_text.length );
								for ( var i = 0; i < min; i++ )
								{
									if ( current_text[ i ] != base[ i ] )
									{
										min = i;
										break;
									}
								}
							}
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
						popover.setList( items_for_rendering );
						$( '#file_finder' ).blur().focus().val( '' ).val( base.substr( 0, min ) );
					}
					input = $( '#file_finder' )[ 0 ];

					// Warning: doesn't work in IE/Opera
					input.scrollLeft = input.scrollWidth;
				} );
			}
		}
		else if ( e.which == 13 )
		{
			e.preventDefault();
			var file = $( e.target ).val();
			BasicApi.SocketServer.send( 'X_glob ', { p : file }, function( e )
			{
				var item = $( e.message_raw ).find( 'item' );
				if ( item.length == 1 && item.is( '[type=file]' ) )
				{
					$( '#file_finder' ).val( '' ).blur();
					publish( 'file-nav-request', {
						filename : file,
						source   : 'glob',
					} );
				}
				else
				{
					var found_exact_match = false;
					$( e.message_raw ).find( 'item' ).each( function( i, el )
					{
						if ( $( el ).text() == file && $( el ).is( '[type=file]' ) )
						{
							$( '#file_finder' ).val( '' ).blur();
							publish( 'file-nav-request', {
								filename : file,
								source   : 'glob',
							} );
							found_exact_match = true;
							return false;
						}
					} );

					if ( !found_exact_match )
					{
						$( '#file_finder' ).addClass( 'shake' );
						setTimeout( function(){ $( '#file_finder' ).removeClass( 'shake' ); }, 500 );
					}
				}
			} );
		}
	}

	function onGlobberFocus( e )
	{
		$( '#file_buttons' ).addClass( 'blur-hidden' );
		if ( ! $( '#file_finder' ).val().trim() )
		{
			var def = (CodeInspector.CodePanel.getCurrentFile() || '').replace( /^file:\/\//, '' ).replace( /\/+[^\/]*$/, '' );
			def = def ? def + '/' : '';
			$( '#file_finder' ).val( def )
		}

		setTimeout( function()
		{
			var val = $( '#file_finder' ).val();
			$( '#file_finder' ).val( '' ).val( val );

			// Warning: doesn't work in IE/Opera
			var input = $( '#file_finder' )[ 0 ];
			input.scrollLeft = input.scrollWidth;
		}, 30 );
		return false;

	}

	function onGlobberBlur()
	{
		$( '#file_buttons' ).removeClass( 'blur-hidden' );
	}

	function onShowTreeClicked( e )
	{
		var tree_popover = $( e.target ).data( 'toggles_popover' );
		if ( !tree_popover )
		{
			var html = '<div class="file-tree popover"><h2>All Files</h2><div id="file_tree"></div></div>';
			tree_popover = new Theme.Popover( html, [], { 'of' : e.currentTarget }, $( e.currentTarget ) );

			$( '#file_tree' ).jstree( {
				'core' : {
					'data' : {
						'url' : function( node )
						{
							var path =  node.id == '#'
								? ''
								: node.li_attr[ 'data-full-path' ];
							return BasicApi.RemoteFiles.apiPath( path, { view : 'jstree' } );
						},
					}
				}
			} );
		}
		else
		{
			tree_popover.remove();
		}
	}

	function onNodeDoubleClicked( e, data )
	{
		var li = $( e.target ).closest( 'li' );
		var is_file = li.attr( 'data-is-file' );
		if ( !is_file || is_file === "false" )
		{
			return;
		}

		var filename = li.attr( 'data-full-path' );
		publish( 'file-nav-request', {
			filename : filename,
			source   : 'tree',
		} );
	}

	function onGlobberOptionClicked( e )
	{
		var target = $( e.target ).closest( '.globber-option' );
		var path = target.attr( 'data-full-path' );
		if ( target.is( '.globber-dir' ) )
		{
			input = $( '#file_finder' ).val( path + '/' )[ 0 ];

			// Warning: doesn't work in IE/Opera
			input.scrollLeft = input.scrollWidth;
			$( input ).focus();
		}
		else if ( target.is( '.globber-file' ) )
		{
			$( '#file_finder' ).val( '' );
			var filename = target.attr( 'data-full-path' );
			publish( 'file-nav-request', {
				filename : filename,
				source   : 'globber',
			} );
		}
	}

	$( init );
	$( window ).load( showFileButtons );
	$( window ).on( 'resize', function(){ setTimeout( repositionFileButtons, 500 ) } );

	$( document ).on( 'keydown',  '#file_finder',     onGlobberKeydown );
	$( document ).on( 'click',    '.show-tree',       onShowTreeClicked );
	$( document ).on( 'click',    '.globber-option',  onGlobberOptionClicked );
	$( document ).on( 'click',    '.recent-file',     onRecentFilesClicked );
	$( document ).on( 'focusin',  '#file_finder',     onGlobberFocus );
	$( document ).on( 'focusout', '#file_finder',     onGlobberBlur );
	$( document ).on( 'dblclick.jstree',              onNodeDoubleClicked );

}( jQuery ));
