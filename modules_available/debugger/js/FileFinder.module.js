import File from './File.module.js'

namespace( 'CodeInspector' ).FileFinder = (function( $ )
{
	var dir_aliases = {};
	var tab_pressed = false;
	var CodePanel = CodeInspector.CodePanel;

	function onGlobberKeydown( e )
	{
		if ( e.which == 9 ) // tab
		{
			tab_pressed = true;
			e.preventDefault();
			current_val = $( e.target ).val();
			if ( dir_aliases[ current_val ] )
			{
				$( e.target ).val( dir_aliases[ current_val ] );
				e.target.scrollLeft = e.target.scrollWidth;
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
						var base, min, items_for_rendering = [];
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
			processGlobOnServer( file, function( item )
			{
				if ( item.length == 1 && item.type == 'file' )
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
					item.forEach( function( el )
					{
						if ( el.name == file && el.type == 'file' )
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
			BasicApi.Debugger.command( 'feature_set', { name : 'max_depth', value : 2 } );
			var e = await BasicApi.Debugger.command( 'eval', `eval(<<<\'VORTEXEVAL\'\n$__ = [];
				foreach ( glob( '${current_val}*' ) as $item )
				{
						$type = is_dir( $item ) ? 'dir' : 'file';
						$__[ $item ] = [ 'type' => $type, 'name' => $item ];
				}
				return $__;\nVORTEXEVAL\n);` );
			var items = ( e.parsed.value[ 0 ].children || []).map( function( item )
			{
				var ret = [];
				( item.children || [] ).map( function( el )
				{
					ret[ el.name ] = el.value;
				} );
				return ret;
			} );
			cb( items );
			BasicApi.Debugger.command( 'feature_set', { name : 'max_depth', value : 1 } );
		}
	}

	function onGlobberFocus( e )
	{
		if ( ! $( '#file_finder' ).val().trim() )
		{
			var def = (CodePanel.getCurrentFile() || '').replace( /^file:\/\//, '' ).replace( /\/+[^\/]*$/, '' );
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

	function onSessionStatusChanged( e )
	{
		BasicApi.Debugger.command( 'X-ctrl:peek_queue' );
	}

	function onGlobberBlur()
	{
		$( '#file_buttons' ).removeClass( 'blur-hidden' );
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

	subscribe( 'session-status-changed',    onSessionStatusChanged );

	$( document ).on( 'keydown',  '#file_finder',     onGlobberKeydown );
	$( document ).on( 'click',    '.globber-option',  onGlobberOptionClicked );
	$( document ).on( 'focusin',  '#file_finder',     onGlobberFocus );
	$( document ).on( 'focusout', '#file_finder',     onGlobberBlur );

}( jQuery ));
