namespace( 'CodeInspector' ).CodePanel = (function( $ )
{
	var editor                = null;
	var current_line_marker   = '';
	var current_line          = false;
	var current_file          = false;
	var confirmed_breakpoints = {};
	var open_files            = {};
	var module_initialized    = false;
	var after_init_cb         = false;

	function init()
	{
		var data = {
			options : { theme : 'solarized_light', language : 'php' }
		};
		publish( 'alter-editor-options', data );

		editor = ace.edit( "editor" );
		editor.setTheme( "ace/theme/" + data.options.theme );
		editor.session.setMode( "ace/mode/"  + data.options.language );
		editor.setOption( "showPrintMargin", false );
		editor.on( "guttermousedown", onGutterClicked );
		editor.setReadOnly( true );

		publish( 'editor-ready', { editor : editor } );
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
		// Ensure a line number cell was clicked (this should always be true)
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
			Theme.Modal.set( {
				title : 'Conditional Breakpoint',
				content : render( 'code_inspector.conditional_bp_modal', {
					line : line,
					bp_id : bp_id,
					expression : expression,
				} ),
			} );
			Theme.Modal.show();
			setTimeout( function(){ $( '.bp-expression-input' ).focus(); }, 30 );
		}
		else
		{
			toggleBreakpoint( line );
		}
	}

	/**
	 * @brief
	 *	Called when an expression is confirmed for a conditional breakpoint
	 *
	 * @param Event e
	 */
	function onNewExpressionGiven( e )
	{
		// If enter was pressed (and not enter + ctl/shift/cmd)
		if ( e.which == 13 && !e.ctrlKey && !e.shiftKey && !e.metaKey )
		{
			e.preventDefault();
			var expression = $( e.target ).text();
			var line       = $( e.target ).attr( 'data-lineno' );
			var bp_id      = $( e.target ).attr( 'data-bp-id' );

			Theme.Modal.hide();

			// If we have a breakpoint id, update the breakpoint's expression; otherwise, create a
			// new breakpoint
			if ( bp_id )
			{
				confirmed_breakpoints[ current_file ][ line ].expression = expression;
				BasicApi.Debugger.command( 'breakpoint_update', { breakpoint : bp_id }, expression );
			}
			else
			{
				toggleBreakpoint( Number( line ), expression );
			}
		}
	}

	/**
	 * @brief
	 *	Updates the display of a breakpoint
	 *
	 * @param string status         One of 'pending', 'confirmed', 'removed'
	 * @param int    line           1-indexed line number
	 * @param bool   is_conditional Is the breakpoint a conditional breakpoint?
	 */
	function updateBreakpoint( status, line, is_conditional )
	{
		line--; // The incoming line number is 1-indexed; ace line numbers are 0-indexed
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

	/**
	 * @brief
	 *	Update the connection status indicator
	 *
	 * @param string level One of 'disconnected', 'connected', 'active-session'
	 */
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

	/**
	 * @brief
	 *	Gets a file from the server and displays it
	 *
	 * @param sring    filename   Absolute path of the file
	 * @param int      line       Optional; 1-indexed line number to highlight (indicates the current
	 *                            instruction)
	 * @param function cb         Optional; called after the file is loaded and displayed. This
	 *                            function is passed three arguments:
	 *                             - The filename
	 *                             - The line number (or undefined)
	 *                             - The file's contents
	 * @param bool     skip_cache Force the file to be loaded from the server
	 */
	function showFile( filename, line, cb, skip_cache )
	{
		if ( ! line || ! ( line = Number( line ) ) || line % 1 != 0 || line < 1 )
		{
			line = undefined;
		}

		filename = normalizeFilename( filename );

		BasicApi.RemoteFiles.get( filename, function( data )
		{
			if ( data === false )
			{
				Theme.notify( 'error', 'The file <b>' + filename.replace( /^.*\//, '' ) + '</b> failed to load' );
				return;
			}

			var text = data;
			if ( current_file != filename || skip_cache )
			{
				editor.setValue( text );
				$( '#filename' ).text( filename.replace( /^.*\//, '' ) );
				open_files[ filename ] = filename.replace( /^.*\//, '' );
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
				editor.scrollToLine( line , true, true, function(){} );
				current_line = line;
			}
			else
			{
				editor.scrollToLine( 1 , true, true, function(){} );
			}

			showBreakpointsForFile();

			if ( typeof cb == "function" )
			{
				cb( filename, line, text );
			}

			editor.clearSelection();
		}, skip_cache );
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
		BasicApi.Debugger.command( command_name );
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

		if ( !BasicApi.Debugger.sessionIsActive() )
		{
			create = !confirmed_breakpoints[ file ][ row ];
			if ( create )
			{
				confirmed_breakpoints[ file ][ row ] = {
					status : 'confirmed',
					expression : expression,
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
			BasicApi.Debugger.command( 'breakpoint_set', {
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
			var tid = BasicApi.Debugger.command( 'breakpoint_remove', {
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
			module_initialized = false;
			sendAllBreakpoints();
			if ( !Object.keys( confirmed_breakpoints ).length )
			{
				BasicApi.Debugger.command( 'breakpoint_list' );
			}
		}
		else
		{
			updateStatusIndicator( BasicApi.SocketServer.isConnected() ? 'connected' : 'disconnected' );
			clearCurrentLineIndicator();
		}
	}

	function normalizeFilename( fn )
	{
		return fn.replace( /^file:\/\//, '' ).replace( /\/{2,}/, '/' );
	}

	function onBreakpointList( data )
	{
		var import_each = function( bp )
		{
			var filename = normalizeFilename( bp.filename );
			confirmed_breakpoints[ filename ] = confirmed_breakpoints[ filename ] || {};
			confirmed_breakpoints[ filename ][ bp.lineno ] = {
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
		if ( data.is_continuation )
		{
			clearActiveContinuationCommand();

			if ( !data.status.match( /^stop/ ) && data.filename )
			{
				showFile( data.filename, data.lineno );
			}
		}

		switch( e.response_type )
		{
			case 'debugger_command:breakpoint_list':
				onBreakpointList( e );
				break;

			case 'debugger_command:stack_get':
				if ( !current_file && e.parsed[ 0 ] )
				{
					var filename = normalizeFilename( e.parsed[ 0 ].filename );
					var lineno = e.parsed[ 0 ].lineno;
					showFile( filename, lineno );
				}
				break;
		}
	}

	function onFileNavRequest( e )
	{
		var filename = normalizeFilename( e.filename );
		showFile( filename, e.lineno, function()
		{
			publish( 'file-changed', {
				file   : filename,
				lineno : e.lineno,
				source : e.source,
			} );
		}  );
	}

	function showBreakpointsForFile()
	{
		clearBreakpoints();
		var current_file = getCurrentFile();
		if ( confirmed_breakpoints[ current_file ] )
		{
			for ( var line in confirmed_breakpoints[ current_file ] )
			{
				updateBreakpoint( 'confirmed', line, confirmed_breakpoints[ current_file ][ line ].expression );
			}
		}
	}

	function startContinuationCommand()
	{
		clearActiveContinuationCommand();
		$( '.gutter-current-line' ).addClass( 'current-line-running' );
	}

	function clearActiveContinuationCommand()
	{
		$( '.current-line-running' ).removeClass( 'current-line-running' );
	}

	function sendAllBreakpoints()
	{
		var deferreds = [];
		Object.keys( confirmed_breakpoints ).forEach( function( filename )
		{
			Object.keys( confirmed_breakpoints[ filename ] ).forEach( function( lineno )
			{
				var deferred = $.Deferred();
				var expression = confirmed_breakpoints[ filename ][ lineno ].expression;
				var callback   = function( filename, lineno, data )
				{
					confirmed_breakpoints[ filename ][ lineno ].id = data.parsed.id;
					deferred.resolve();
				}.bind( undefined, filename, lineno );
				BasicApi.Debugger.command( 'breakpoint_set' , {
					type : expression ? 'line' : 'conditional',
					line : lineno,
					file : filename,
					}, callback, expression );
				deferreds.push( deferred );
			} );
		} );
		$.when.apply( $, deferreds ).then( onBreakpointsInitialized );
	}

	function onBreakpointsInitialized()
	{
		module_initialized = true;
		if ( after_init_cb )
		{
			after_init_cb();
			after_init_cb = false;
		}
	}

	function onShowCurrentlyOpenFilesClicked( e )
	{
		var target = $( e.target ).closest( '.no-close-popover' );
		var open_files_popover = target.data( 'toggles_popover' );
		if ( !open_files_popover )
		{
			var html = '';
			for ( var filename in open_files )
			{
				html += '<a data-open-file="' + filename + '">' + open_files[ filename ] + '</a>';
			}

			html = '<h2>Currenly Open</h2>' + (html || 'No files are open right now');
			open_files_popover = new Theme.Popover( html, [], { of : target }, $( target ) );
			$( e.target ).data( 'toggles_popover', open_files_popover )
		}
		else
		{
			open_files_popover.remove();
		}
	}

	function onLayoutChanged()
	{
		editor.resize();
	}

	function onBeforeSend( data )
	{
		if ( ( data.alter_data.command || '' ).match( /^(step_|run)/ ) )
		{
			startContinuationCommand();
		}
	}

	function onRefereshFileClicked( e )
	{
		var target = $( e.target ).closest( 'button' ).css( 'visibility', 'hidden' );
		var spinner = $( new Theme.Spinner + '' ).css( 'position', 'absolute' ).appendTo( '.file-bar' ).position( {
			my : 'center',
			at : 'center',
			of : target,
		} );
		showFile( current_file, editor.getSelectionRange().start.row, function(){
			spinner.remove();
			target.css( 'visibility', '' );
		}, true )
	}

	function beforeAutorun( e )
	{
		if ( !module_initialized )
		{
			after_init_cb = e.register();
		}
	}

	function onClearBpClicked()
	{
		Object.keys( confirmed_breakpoints ).forEach( function( filename )
		{
			Object.keys( confirmed_breakpoints[ filename ] ).forEach( function( lineno )
			{
				toggleBreakpoint( lineno, undefined, filename );
			} );
		} );
	}

	function alterUserMenuItems( e )
	{
		e.items.push( { content : 'Clear all breakpoints', attr : { 'data-action' : 'clear-all-breakpoints' } } );
	}

	$( init );
	$( document ).on( 'click',    '[data-command]',       onCommandButtonClicked );
	$( document ).on( 'click',    '.show-currently-open-files', onShowCurrentlyOpenFilesClicked );
	$( document ).on( 'keypress', '.bp-expression-input', onNewExpressionGiven )
	$( document ).on( 'click',    '.refresh-file',        onRefereshFileClicked )
	$( document ).on( 'click',    '[data-action=clear-all-breakpoints]', onClearBpClicked )

	subscribe( 'before-autorun',            beforeAutorun )
	subscribe( 'session-status-changed',    onSessionStatusChanged )
	subscribe( 'connection-status-changed', onConnectionStatusChanged )
	subscribe( 'response-received',         onResponseReceived )
	subscribe( 'file-nav-request',          onFileNavRequest )
	subscribe( 'layout-changed',            onLayoutChanged )
	subscribe( 'before-send',               onBeforeSend );
	subscribe( 'alter-user-menu-items',     alterUserMenuItems );

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
