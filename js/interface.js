Interface = (function( $ )
{
	var interval = null;
	var editor = null;
	var interval = null;
	var poll_delay_ms = 1000;

	var pending_breakpoints = {};
	var confirmed_breakpoints = {};
	var xdebug_response_handlers = {
		breakpoint_set : onBreakpointSet,
		breakpoint_remove : onBreakpointRemoved,
		context_get : onContextGet,

	};

	var file_cache = {};
	var current_file = '';
	var get_tids = {};

	function init()
	{
		dpoh.subscribe( 'response_recevied', onResponseReceived );
		dpoh.subscribe( 'session_init',      onSessionInit );
		/*dpoh.subscribe( 'before_send',       function( alter_data )
		{
			if ( alter_data.command == 'get' )
			{
				alter_data.immediate_callback = function(){
					setTimeout( function(){
						dpoh.sendCommand( "get" )
					} , poll_delay_ms ) };
			}
		} );*/

		dpoh.listRecentFiles( '/srv/preachingandworship.org', onRecentFilesReceived );

		editor = ace.edit( "editor" );
		editor.setTheme( "ace/theme/solarized_dark" );
		editor.session.setMode( "ace/mode/php" );
		editor.setOption("showPrintMargin", false);

		editor.setReadOnly( true );

		editor.on( "guttermousedown", function(e) {
		    var target = e.domEvent.target;
		    if (target.className.indexOf("ace_gutter-cell") == -1)
			return;
		    //if (!editor.isFocused())
			//return;

			if ( !confirmed_breakpoints[ current_file ] )
			{
				confirmed_breakpoints[ current_file ] = {};
			}

			var breakpoints = e.editor.session.getBreakpoints(row, 0);
			var row = e.getDocumentPosition().row;
			if ( !confirmed_breakpoints[ current_file ][ row + 1 ] )
			{

				var tid = dpoh.sendCommand( "breakpoint_set -t line -n " + (row + 1) + " -f " + current_file );
				e.editor.getSession().addGutterDecoration( row, "pending-breakpoint" );
				confirmed_breakpoints[ current_file ][ row + 1 ] = "pending";
				pending_breakpoints[ tid ] = {
					file : current_file,
					line : row + 1,
				};
			}
			else if ( confirmed_breakpoints[ current_file ][ row + 1 ] != "pending" )
			{
				e.editor.session.clearBreakpoint( row );
				e.editor.getSession().addGutterDecoration( row, "pending-breakpoint" );
				var tid = dpoh.sendCommand( "breakpoint_remove -d " + confirmed_breakpoints[ current_file ][ row + 1 ] );
				confirmed_breakpoints[ current_file ][ row + 1 ] = "pending";
				pending_breakpoints[ tid ] = {
					file : current_file,
					line : row + 1,
				};
			}
			else
			{
				alert( "we're still working on that breakpoint" );
			}
		    e.stop();
		});
		
		dpoh.sendCommand( "get" );

		window.setTimeout( glassifyWindows, 200 );
		window.setTimeout( ajdustHeight, 100 );
	}
	
	function onCommandButtonClicked( e )
	{
		var command_name = $( e.target ).closest( '[data-command]' ).attr( 'data-command' );
		dpoh.sendCommand( command_name );
	}

	function stopPolling()
	{
		allow_polling = false;
		clearInterval( interval );
	}

	function onResponseReceived( jq_message, tid )
	{
		var command = jq_message.attr( 'command' );
		if ( typeof xdebug_response_handlers[ command ] == "function" )
		{
			xdebug_response_handlers[ command ]( jq_message, tid );
		}
		
		// Jump to file
		var filename = jq_message.attr( 'filename' ) || jq_message.find( ':not(breakpoint)[filename]' ).attr( 'filename' );
		var lineno = jq_message.attr( 'lineno' ) || jq_message.find( ':not(breakpoint)[lineno]' ).attr( 'lineno' );
		if ( filename && lineno )
		{
			goToFile( filename, lineno );
		}

		// Don't hold on to stopping sessions
		if ( jq_message.is( '[status=stopping]' ) )
		{
			dpoh.sendCommand( "run" );
		}
		else if ( command != "context_get" && filename && lineno )
		{
			dpoh.sendCommand( "context_get" );
		}
	}
	
	function onBreakpointSet( jq_message, tid )
	{
		var bp_id = jq_message.attr( 'id' );
		if ( pending_breakpoints[ tid ] )
		{
			if ( current_file == pending_breakpoints[ tid ].file )
			{
				editor.getSession().removeGutterDecoration( pending_breakpoints[ tid ].line - 1, "pending-breakpoint" );
				editor.session.setBreakpoint( pending_breakpoints[ tid ].line - 1 );
			}
			confirmed_breakpoints[ pending_breakpoints[ tid ].file ][ pending_breakpoints[ tid ].line ] = bp_id;
			delete pending_breakpoints[ tid ];
		}
	}
	
	function onBreakpointRemoved( jq_message, tid )
	{
		var bp_id = jq_message.attr( 'id' );
		if ( pending_breakpoints[ tid ] )
		{
			if ( current_file == pending_breakpoints[ tid ].file )
			{
				editor.getSession().removeGutterDecoration( pending_breakpoints[ tid ].line - 1, "pending-breakpoint" );
			}
			delete confirmed_breakpoints[ pending_breakpoints[ tid ].file ][ pending_breakpoints[ tid ].line ];
			delete pending_breakpoints[ tid ];
		}
	}
	
	function onContextGet( jq_message )
	{
		$( '#context' ).jstree( "destroy" );
		$( '#context' ).html( buildContextTree( $( jq_message ) ) ).jstree({"core" : { "themes" : { "name" : "default-light" } } } );
	}
		
	function onLoadFileChanged( e )
	{
		if ( e.which == 13 )
		{
			var file_name = $( e.target ).val();
			goToFile( 'file://' + file_name );
			$( e.target ).val( "" );
			modal.hide();
		}
	}

	function goToFile( file, line )
	{
		if ( ! line || ! ( line = Number( line ) ) || line % 1 != 0 || line < 1 )
		{
			line = 1;
		}

		var onFileReceived = function( data )
		{
			if ( ! file_cache[ file ] )
			{
				file_cache[ file ] = data;
			}

			if ( file != current_file )
			{
				current_file = file;
				editor.setValue( data )
				showBreakpointsForFile( file );
			}
			
			editor.resize( true );
			editor.scrollToLine( line, true, true, function(){} );
			editor.gotoLine( line, 10, true );
		};
		
		if ( ! file_cache[ file ] )
		{
			$.post( '/xdebug_http/connect.php', { commands: [ 'get_file ' + file ] }, onFileReceived );
		}
		else
		{
			onFileReceived( file_cache[ file ] );
		}
	}
	
	function showBreakpointsForFile( filename )
	{
		editor.session.clearBreakpoints();
		if ( confirmed_breakpoints[ current_file ] )
		{
			for ( var line in confirmed_breakpoints[ current_file ] )
			{
				editor.session.setBreakpoint( line - 1 );
			}
		}
	}
	
	function sendAllBreakpoints()
	{
		for ( var filename in confirmed_breakpoints )
		{
			for ( var lineno in confirmed_breakpoints[ filename ] )
			{
				dpoh.sendCommand( "breakpoint_set -t line -n " + lineno + " -f " + filename );
			}
		}
	}
	
	function onSessionInit( jq_message )
	{
		alert( 'init' );
		dpoh.sendCommand( 'feature_set -n max_depth -v 1' );
		dpoh.sendCommand( 'step_into' );
		sendAllBreakpoints();
	}
	
	function buildContextTree( jq_element, is_recursive )
	{
		var html = '';
		
		jq_element.children( 'property' ).each( function( index, element )
		{
			if ( ! html )
			{
				html = '<ul>';
			}

			var value = $( element ).find( 'property' ).length
				? '' // nested values
				: element.innerHTML.replace( '<!--[CDATA[', '' ).replace( /]]-->$/, '' );

			if ( $( element ).is( '[encoding=base64]' ) )
			{
				value = atob( value );
			}
			
			value = $('<div>').text( value ).html(); 
			
			html += '<li>'
				+ $( element ).attr( is_recursive ? 'name' :'fullname' )
				+ " ("
				+ $( element ).attr( 'type' )
				+ "): "
				+ value
				+ buildContextTree( $( element ), true )
				+ '</li>';
		} );
		
		return html && html + '</ul>';
	}
	
	function onRecentFilesReceived( data )
	{
		var html = '';
		for ( var i in data )
		{
			if ( ! data[ i ].match( /\.(php|module|inc)$/ ) )
			{
				continue;
			}
			var last_slash = data[ i ].lastIndexOf( '/' ) + 1;
			var short_name = data[ i ].substr( last_slash );
			html += '<button data-file="' + data[ i ] + '">' + short_name + '</button>';
		}
		$( "#recents" ).html( html ); 
	}
	
	function onRecentFileClicked( e )
	{
		var file = $( e.target ).attr( 'data-file' );
		goToFile( file );
	}
	
	function onDocumentKeyPressed( e )
	{
		if ( e.ctrlKey && e.which == 'O'.charCodeAt( 0 ) )
		{
			e.preventDefault();
			modal.set( {
				title : 'Open File',
				content : '<input type="text" id="load_file" placeholder="/abs/path/to/file"/>'
			} );
			modal.show();
		}
	}

	function glassifyWindows()
	{
		var width  = $( window ).width() + 10;
		var height = $( window ).height() + 10;
		$( '.window-glass' ).css( 'left', null ).css( 'top', null )
		.each( function( i, element )
		{
			element = $( element );
			var offset = element.offset();
			element.width( width ).height( height );
			element.css( 'left', - ( Math.abs( offset.left ) + 10 ) + 'px' );
			element.css( 'top',  - ( Math.abs( offset.top ) + 10 ) + 'px' );
		} );
	}

	function ajdustHeight()
	{
		var total_height = $(window).height();
		var toolbar_height = $( '.toolbar' ).height();
		$( '.windows' ).css( "max-height", (window.innerHeight - toolbar_height)  + "px" );
	}
	
	$( init );
	$( document ).on( 'click', '[data-command]', onCommandButtonClicked );
	$( document ).on( 'click', '[data-file]', onRecentFileClicked );
	$( document ).on( 'keypress', '#load_file', onLoadFileChanged );
	$( document ).on( 'keydown', onDocumentKeyPressed )
	$( window   ).on( 'resize', ajdustHeight );
	return { g : glassifyWindows };

}( jQuery ));
