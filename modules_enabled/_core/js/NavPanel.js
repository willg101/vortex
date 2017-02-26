NavPanel = (function( sendApiRequest, $ )
{
	var history_stack = [];
	var history_pos   = 0; 
	var pending_message = '';

	// TODO: Add interface for updating these
	var dir_aliases = {
	};

	function init()
	{
		$( '#file_tree' ).jstree( {
			'core' : {
				'data' : {
					'url' : function( node )
					{
						var params = {
							fetch_tree : node.id == '#'
								? '~ROOT~'
								: node.li_attr[ 'data-full-path' ],
						}
						return sendApiRequest( 'get', params, undefined, undefined, true );
					},
				}
			}
		} );
		resizeCell();
	}

	function onDocumentClick( e )
	{
		if ( !$( e.target ).closest( '.showing, [data-open-nav-panel]' ).length )
		{
			$( '.showing' ).removeClass( 'showing' );
		}
	}
	
	function onLoading( a, b, c ,d )
	{
		console.log( arguments );
	}

	function onNavButtonClicked( e )
	{
		var selector = $( e.currentTarget ).attr( 'data-open-nav-panel' );
		if ( selector == '#console' )
		{
			$( '#console .input' ).focus();
		}
		$( selector ).addClass( 'showing' );
		
	}
	
	function sortBreakpointList( breakpoints )
	{
		var sorted = {
			Files      : {},
			Functions  : {},
		};
		
		var process_line_bp = function( bp )
		{
			if ( !sorted.Files[ bp.filename ] )
			{
				sorted.Files[ bp.filename ] = [];
			}
			sorted.Files[ bp.filename ].push( bp )
		};
		breakpoints.line.forEach( process_line_bp );
		breakpoints.conditional.forEach( process_line_bp );
		
		var sort_file_bp = function( bp1, bp2 )
		{
			return ( bp1.lineno || Math.NEGATIVE_INFINITY ) - ( bp2.lineno || Math.NEGATIVE_INFINITY );
		};
		for ( var i in sorted.Files )
		{
			sorted.Files[ i ] = sorted.Files[ i ].sort( sort_file_bp );
		}
		
		var process_fn_bp = function( bp )
		{
			if ( !sorted.Functions[ bp[ 'function' ] ] )
			{
				sorted.Functions[ bp[ 'function' ] ] = [];
			}
			sorted.Functions[ bp[ 'function' ] ].push( bp );
		};
		breakpoints.call.forEach( process_fn_bp );
		breakpoints[ 'return' ].forEach( process_fn_bp );
		
		var sort_fn_bp = function( bp1, bp2 )
		{
			return ( bp1.type == 'call' ? 1 : 0 ) - ( bp2.type == 'call' ? 1 : 0 );
		};
		for ( var i in sorted.Functions )
		{
			sorted.Functions[ i ] = sorted.Functions[ i ].sort( sort_fn_bp );
		}
		
		return sorted;
	}

	function onOpenFileClicked( e )
	{
		var file = $( e.currentTarget ).attr( 'data-file' );
		$( document ).trigger( {
			type     : 'dpoh-interface:file-nav-request',
			filename : file,
			source   : 'file-nav',
		} );
		$( '#open_files_panel .open-file' ).removeClass( 'active' );
		$( e.currentTarget ).addClass( 'active' );
		$( '.nav-panel.showing' ).removeClass( 'showing' );
	}

	function getShortFileName( filename ) 
	{
		return filename.replace( /^.*\//, '' );
	}
	
	function onNodeDoubleClicked( e, data )
	{
		var li = $( e.target ).closest( 'li' );
		var is_file = li.attr( 'data-is-file' );
		if ( !is_file || is_file === "false" )
		{
			return;
		}

		$( '.nav-panel.showing' ).removeClass( 'showing' );
		var filename = li.attr( 'data-full-path' );
		$( document ).trigger( {
			type     : 'dpoh-interface:file-nav-request',
			filename : filename,
			source   : 'tree',
		} );
	}

	function onDocumentKeydown( e )
	{
		var target = $( e.target );
		if ( e.which == 'O'.charCodeAt(0) && e.ctrlKey )
		{
			e.preventDefault();
			$( '.showing' ).removeClass( 'showing' );
			$( '#open_files_panel' ).addClass( 'showing' );
			
		}
		else if ( e.which == 'E'.charCodeAt( 0 ) && e.ctrlKey )
		{
			e.preventDefault();
			$( '.showing' ).removeClass( 'showing' );
			$( '#console' ).addClass( 'showing' );
			$( '#console .input' ).focus();
		}
		else if ( e.which == 191 && e.ctrlKey )
		{
			if ( $( '.modal-hidden' ).length )
			{
				modal.set( {
					content : '<input class="glob-input" id="globber" />',
					title   : 'Open file',
				} );
				modal.show();
				$( '#globber' ).focus();
			}
		}
		else if ( e.which == 27 )
		{
			$( '.showing' ).removeClass( 'showing' );
		}
	}

	function onConsoleKeypress( e )
	{
		if ( e.which == 13 && !e.ctrlKey && !e.shiftKey )
		{
			e.preventDefault();
			var expression = $( e.target ).text();
			$( e.target ).text( '' );
			addConsoleText( 'out', expression, true );
			if( dpoh.sessionIsActive() )
			{
				var from_debugger = 
					addConsoleText( 'in',  '<i class="fa fa-spin fa-circle-o-notch"></i>', false );

				// After scouring the Xdebug protocol docs for a way to get a variable name from an
				// address, which would be required to lazy-load the response's object/array's nested
				// properties, I came up empty-handed. Lazy-loading doesn't seem to be a viable option
				// here, so let's deep-load the response instead
				dpoh.command( 'feature_set', { name : 'max_depth', value : 10 } );
				dpoh.command( 'eval', function( data )
				{
					if ( data.parsed.value && data.parsed.value.length )
					{
						var message_text = from_debugger.getjQuery().find( '.message-text' );
						data.parsed.value.forEach( function( item )
						{
							item.name     = item.name || '';
							item.fullname = item.fullname || '';
						} );
						message_text.html( '' ).jstree( { core : { data : StatusPanel.buildContextTree( data.parsed.value ) } } );
						$( '#console .history' ).scrollTop( $( '#console .history' )[0].scrollHeight );
					}
					else if ( data.parsed.message )
					{
						var message = $( '<div>' ).text( data.parsed.message ).html();
						message = '<span class="debugger-message">' + message + '</span>';
						from_debugger.updateMessage( message );
					}
					else
					{
						from_debugger.updateMessage( '<span class="no-debugger-message">Empty response '
							+ 'received</span>' );
					}
				}, expression );
				dpoh.command( 'feature_set', { name : 'max_depth', value : 1 } );
			}
			else
			{
				addConsoleText( 'in',  '<i class="fa fa-warning"></i> No session is currently active', false );
			}
		}

    }

	function onConsoleKeyup( e )
	{
		if ( this.selectionStart === 0 && e.keyCode === 38 )
		{
			if ( history_pos === 0 )
			{
				pending_message = this.value || '';
			}

			if ( history_pos < history_stack.length )
			{
				history_pos++;
				$( '#console .input' ).val( history_stack[ history_stack.length - history_pos ] ).focus()[ 0 ].selectionStart = 0;
			}
        }
		else if ( this.selectionStart === this.value.length && e.keyCode === 40 )
		{
			if ( history_pos > 0 )
			{
				history_pos--;
				var new_value = history_pos === 0
					? pending_message
					: history_stack[ history_stack.length - history_pos ];
				$( '#console .input' ).val( new_value ).focus()[ 0 ].selectionStart = new_value.length;
			}
        }
	}
	
	function addConsoleText( direction, text, escape )
	{
		var arrow = direction == 'in' ? 'left' : 'right';
		if ( direction == 'out' )
		{
			history_stack.push( text );
			pending_message = '';
			history_pos = 0;
		}
		var new_line = $( '<div class="message ' + direction + '"><span class="message-meta"><i class="fa fa-fw fa-chevron-'
			+ arrow + '"></i></span><span class="message-text"></span></div>' );
		new_line.find( '.message-text' )[ escape ? 'text' : 'html' ]( text );
		$( '#console .history' ).append( new_line ).scrollTop( $( '#console .history' )[0].scrollHeight );

		return {
			updateMessage : function( new_message, escape )
			{
				new_line.find( '.message-text' )[ escape ? 'text' : 'html' ]( new_message );
				return this;
			},
			getjQuery : function()
			{
				return new_line;
			},
		}
	}
	
	function resizeCell()
	{
		var height = $( '.toolbar .css-cell:not(.match-height)' ).height();
		$( '.toolbar .css-cell.match-height' ).height( height + 1 );
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
				dpoh.command( 'X_glob ', { pattern : current_val }, function( e )
				{
					var message = $( e.message_raw );
					if ( message.text() != 'FALSE' )
					{
						$( '#globber' ).blur().focus().val( '' ).val( message.text() );
						input = $( '#globber' )[ 0 ];

						// Warning: doesn't work in IE/Opera
						input.scrollLeft = input.scrollWidth;
					}
				} );
			}
		}
		else if ( e.which == 13 )
		{
			e.preventDefault();
			$( document ).trigger( {
				type     : 'dpoh-interface:file-nav-request',
				filename : $( e.target ).val(),
				source   : 'glob',
			} );
			modal.hide();
		}
	}

	$( init );

	$( document ).on( 'keypress',          '#console .input',    onConsoleKeypress );	
	$( document ).on( 'keyup',             '#console .input',    onConsoleKeyup );	
	$( document ).on( 'dblclick.jstree',   '#open_files_panel',  onNodeDoubleClicked );
	$( document ).on( 'loading.jstree',    '#breakpoints_panel', onLoading );
	$( document ).on( 'keydown',                                 onDocumentKeydown );
	$( document ).on( 'click',                                   onDocumentClick );
	$( document ).on( 'click', '[data-open-nav-panel]',          onNavButtonClicked );
	$( document ).on( 'click', '.open-file',                     onOpenFileClicked );
	$( window   ).on( 'resize',                                  resizeCell );
	$( document ).on( 'keydown',           '#globber',           onGlobberKeydown );

}( send_api_request, jQuery ));
