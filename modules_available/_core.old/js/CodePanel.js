CodePanel = (function( $ )
{
	var editor                = null;
	var current_line_marker   = '';
	var current_line          = false;
	var current_file          = false;
	var pending_breakpoints   = {};
	var confirmed_breakpoints = {};

	function init()
	{
		editor = ace.edit( "editor" );
		editor.setTheme( "ace/theme/solarized_light" );
		editor.session.setMode( "ace/mode/php" );
		editor.setOption( "showPrintMargin", false );
		editor.on( "guttermousedown", onGutterClicked );
		editor.setReadOnly( true );
	}

	/**
	 * @retval string
	 *	The full URI of the current file
	 */
	function getCurrentFile()
	{
		return current_file;
	}

	/**
	 * @brief
	 *	Click handler for the Ace editor gutter; adds/removes a breakpoint
	 *
	 * @param object e
	 */
	function onGutterClicked( e )
	{
		// Ensue a line number cell was clicked (this should always be true)
		var target = e.domEvent.target;
		if ( target.className.indexOf( "ace_gutter-cell" ) == -1 )
		{
			return;
		}

		var line = e.getDocumentPosition().row + 1;

		// Middle button or right button
		if ( !$( target ).is( '.ace_breakpoint:not(.conditional-breakpoint)' )
			&& ( e.domEvent.button == 1 || 1 == e.domEvent.button&2
			  || e.domEvent.button == 2 || 1 == e.domEvent.button&3 ) )
		{
			e.domEvent.preventDefault();
			var expression = ( confirmed_breakpoints[ current_file ]
				&& confirmed_breakpoints[ current_file ][ line ]
				&& confirmed_breakpoints[ current_file ][ line ].expression ) || '';
			var bp_id = ( confirmed_breakpoints[ current_file ]
				&& confirmed_breakpoints[ current_file ][ line ]
				&& confirmed_breakpoints[ current_file ][ line ].id ) || '';
			modal.set( {
				title : 'Conditional Breakpoint',
				content : '<label>Break on line ' + line + ' when the following expression is true:</span>'
					+ '</label><div class="bp-expression-input" contenteditable data-bp-id="' + bp_id
					+ '" data-lineno="' + line + '">' + expression + '</div>',
			} );
			modal.show();
			setTimeout( function(){ $( '.bp-expression-input' ).focus(); }, 30 );
		}
		else
		{
			toggleBreakpoint( line );
		}
	}

	function onNewExpressionGiven( e )
	{
		if ( e.which == 13 && !e.ctrlKey && !e.shiftKey )
		{
			e.preventDefault();
			var expression = $( e.target ).text();
			var line       = $( e.target ).attr( 'data-lineno' );
			var bp_id      = $( e.target ).attr( 'data-bp-id' );

			modal.hide();

			if ( bp_id )
			{
				confirmed_breakpoints[ current_file ][ line ].expression = expression;
				dpoh.command( 'breakpoint_update', { breakpoint : bp_id }, expression );
			}
			else
			{
				toggleBreakpoint( Number( line ), expression );
			}
		}
	}

	function updateBreakpoint( status, line, is_conditional )
	{
		line--;
		editor.session.clearBreakpoint( line );
		editor.getSession().removeGutterDecoration( line, "pending-breakpoint" );
		editor.getSession().removeGutterDecoration( line, "conditional-breakpoint" );

		switch ( status )
		{
			case 'pending':
				editor.getSession().addGutterDecoration( line, "pending-breakpoint" );
				break;

			case 'confirmed':
				editor.session.setBreakpoint( line );
				if ( is_conditional )
				{
					editor.getSession().addGutterDecoration( line, "conditional-breakpoint" );
				}
				break;

			case 'removed':
				// Do nothing
				break;
			
			default:
				throw new Error( 'Invalid status: ' + status );
		}
	}
	
	function updateStatusIndicator( level )
	{
		switch( level )
		{
			case 'disconnected':
				$( '#status_indicator' )
					.removeClass( 'connected session-in-progress fa-spin fa-circle-o-notch fa-circle' )
					.addClass( 'fa-warning disconnected' );
					break;
			
			case 'connected':
				$( '#status_indicator' )
					.removeClass( 'disconnected session-in-progress fa-warning fa-circle' )
					.addClass( 'fa-circle-o-notch fa-spin connected' );
					break;
							
			case 'active-session':
				$( '#status_indicator' )
					.removeClass( 'disconnected connected fa-circle-o-notch fa-spin fa-warning' )
					.addClass( 'fa-circle session-in-progress' );
					break;
			
			default:
				throw new Error( 'Unexpected status indicator level: ' + level );
		}
	}
	
	function showFile( filename, line, cb )
	{
		if ( ! line || ! ( line = Number( line ) ) || line % 1 != 0 || line < 1 )
		{
			line = undefined;
		}

		Files.load( filename, function( success, data )
		{
			if ( !success )
			{
				return;
			}

			var text = data.files[ filename ];
			if ( current_file != filename )
			{
				editor.setValue( text );
				$( '#filename' ).text( filename.replace( /^.*\//, '' ) );
				if ( text.match( /^\<\?php \/\* dpoh: ignore \*\// ) )
				{
					$( '#filename' ).prepend( '<span class="fa fa-low-vision"></span> ' );
				}
				editor.resize( true );
				current_file = filename;
			}

			if ( current_line_marker )
			{
				editor.session.removeMarker( current_line_marker );
				editor.getSession().removeGutterDecoration( current_line - 1, "gutter-current-line" );
			}

			if ( line )
			{
				var Range = ace.require('ace/range').Range;
				current_line_marker = editor.session.addMarker( new Range( line - 1, 0, line - 1, 1),
					"ace-current-line", "fullLine" );
				editor.getSession().addGutterDecoration( line-1, "gutter-current-line" );
				editor.clearSelection();
				editor.scrollToLine( line , true, true, function(){} );
				current_line = line;
			}

			showBreakpointsForFile();

			if ( typeof cb == "function" )
			{
				cb( filename, line, text );
			}
		} );
	}

	function clearBreakpoints()
	{
		editor.session.clearBreakpoints();
	}

	function clearCurrentLineIndicator()
	{
		editor.session.removeMarker( current_line_marker );
		editor.getSession().removeGutterDecoration( current_line - 1, "gutter-current-line" );
		
		current_line_marker = false;
		current_line = false;
	}
	
	function onCommandButtonClicked( e )
	{
		var command_name = $( e.currentTarget ).attr( 'data-command' );
		dpoh.command( command_name );
	}

	function addBreakpoint( file, row, expression )
	{
		if ( ! (confirmed_breakpoints[ current_file ] && confirmed_breakpoints[ current_file ][ row ] ) )
		{
			toggleBreakpoint( row, expression, file );
		}
	}

	function toggleBreakpoint( row, expression, file )
	{
		if ( !file )
		{
			file = current_file;
		}

		if ( !file )
		{
			return;
		}

		if ( !confirmed_breakpoints[ file ] )
		{
			confirmed_breakpoints[ file ] = {};
		}

		if ( !dpoh.sessionIsActive() )
		{
			create = !confirmed_breakpoints[ file ][ row ];
			if ( create )
			{
				confirmed_breakpoints[ file ][ row ] = {
					status : 'confirmed',
				};
			}
			else
			{
				delete confirmed_breakpoints[ file ][ row ];
			}
			updateBreakpoint( ( create ? 'confirmed' : 'removed' ), row );
			return;
		}

		if ( !confirmed_breakpoints[ file ][ row ] )
		{
			dpoh.command( 'breakpoint_set', {
				type : expression ? 'conditional' : 'line',
				line : row,
				file : file,
			},
			function( data )
			{
				updateBreakpoint( 'confirmed', row, expression );
				confirmed_breakpoints[ file ][ row ].status = 'confirmed';
				confirmed_breakpoints[ file ][ row ].id     = data.parsed.id;
			}, expression );
			
			updateBreakpoint( 'pending', row );
			confirmed_breakpoints[ file ][ row ] = {
				status     : 'pending',
				expression : expression
			};
		}
		else if ( confirmed_breakpoints[ file ][ row ].status != 'pending' )
		{
			updateBreakpoint( 'pending', row );
			var tid = dpoh.command( 'breakpoint_remove', {
				breakpoint : confirmed_breakpoints[ file ][ row ].id,
			},
			function( data )
			{
				delete confirmed_breakpoints[ file ][ row ];
				updateBreakpoint( 'removed', row );
			} );
		}
	}

	function onConnectionStatusChanged( e )
	{
		updateStatusIndicator( e.status == 'connected' ? 'connected' : 'disconnected' );
	}

	function onSessionStatusChanged( e )
	{
		if ( e.status == 'active' )
		{
			updateStatusIndicator( 'active-session' );
			if ( Object.keys( confirmed_breakpoints ).length )
			{
				sendAllBreakpoints();
			}
			else
			{
				dpoh.command( 'breakpoint_list' );
			}
			
		}
		else
		{
			updateStatusIndicator( dpoh.isConnected() ? 'connected' : 'disconnected' );
			clearCurrentLineIndicator();
		}
	}
	
	function onBreakpointList( data )
	{
		var import_each = function( bp )
		{
			confirmed_breakpoints[ bp.filename ] = confirmed_breakpoints[ bp.filename ] || {};
			confirmed_breakpoints[ bp.filename ][ bp.lineno ] = {
				status     : 'confirmed',
				id         : bp.id,
				expression : bp.expression || bp.expression_element,
			}
		};
		confirmed_breakpoints = {};
		data.parsed.line.forEach( import_each );
		data.parsed.conditional.forEach( import_each );
		showBreakpointsForFile();
	}
	
	function onResponseReceived( e )
	{
		var data = e.parsed || {};
		if ( data.is_continuation && !data.status.match( /^stop/ ) && data.filename )
		{
			showFile( data.filename, data.lineno );
		}
		
		switch( e.response_type )
		{			
			case 'breakpoint_list':
				onBreakpointList( e );
				break;
				
			case 'stack_get':
				if ( !current_file && e.parsed[ 0 ] )
				{
					var filename = e.parsed[ 0 ].filename;
					var lineno = e.parsed[ 0 ].lineno;
					showFile( filename, lineno );
				}
				break;
		}
	}
	
	function onFileNavRequest( e )
	{
		showFile( e.filename, e.lineno, function()
		{
			$( document ).trigger( {
				type   : 'dpoh-interface:file-changed',
				file   : e.filename,
				lineno : e.lineno,
				source : e.source,
			} );
		}  );
	}
	
	function showBreakpointsForFile()
	{
		clearBreakpoints();
		var current_file = CodePanel.getCurrentFile();
		if ( confirmed_breakpoints[ current_file ] )
		{
			for ( var line in confirmed_breakpoints[ current_file ] )
			{
				updateBreakpoint( 'confirmed', line, confirmed_breakpoints[ current_file ][ line ].expression );
			}
		}
	}
	
	function sendAllBreakpoints()
	{
		for ( var filename in confirmed_breakpoints )
		{
			for ( var lineno in confirmed_breakpoints[ filename ] )
			{
				var expression = confirmed_breakpoints[ filename ][ lineno ].expression;
				var callback = function( filename, lineno, data )
				{
					confirmed_breakpoints[ filename ][ lineno ].id = data.parsed.id;
				}.bind( undefined, filename, lineno );
				dpoh.command( 'breakpoint_set' , {
 					type : expression ? 'line' : 'conditional',
					line : lineno,
					file : filename,
					}, callback, expression );
			}
		}
	}
	
	function onLayoutChanged()
	{
		editor.resize();
	}
	
	$( init );
	$( document ).on( 'click',    '[data-command]',       onCommandButtonClicked );
	$( document ).on( 'keypress', '.bp-expression-input', onNewExpressionGiven )

	$( document ).on( 'dpoh:session-status-changed',     onSessionStatusChanged )
	$( document ).on( 'dpoh:connection-status-changed',  onConnectionStatusChanged )
	$( document ).on( 'dpoh:response-received',          onResponseReceived )
	$( document ).on( 'dpoh-interface:file-nav-request', onFileNavRequest )
	$( document ).on( 'dpoh-interface:layout-changed',   onLayoutChanged )
	
	return {
		clearBreakpoints          : clearBreakpoints,
		clearCurrentLineIndicator : clearCurrentLineIndicator,
		getCurrentFile            : getCurrentFile,
		showFile                  : showFile,
		updateStatusIndicator     : updateStatusIndicator,
		updateBreakpoint          : updateBreakpoint,
		addBreakpoint             : addBreakpoint,
	}
	
}( jQuery ));
