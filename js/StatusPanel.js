StatusPanel = (function( $ )
{
	function onNodeDoubleClicked( e )
	{
		var li = $( e.target ).closest( 'li' );
		if ( li.is( '[data-no-alter]' ) )
		{
			return;
		}

		var identifier  = li.attr( 'data-identifier' );
		var stack_depth = li.attr( 'data-stack-depth' );
		var cid         = li.attr( 'data-cid' );
		var current_val = li.attr( 'data-current-value' ) || '';
		
		modal.set( {
			title : 'Update Value',
			content : '<label>Assign a new value to <span class="identifier">' + identifier
				+':</span></label><div class="value-input" contenteditable data-identifier="' + identifier
				+ '" data-stack-depth="' + stack_depth + '" data-cid="' + cid + '">' + current_val + '</div>'
		} );
		modal.show();
		$( '.value-input' ).focus();
		document.execCommand( 'selectAll', false, null );
	}

	function onNewValueGiven( e )
	{
		if ( e.which == 13 && !e.ctrlKey && !e.shiftKey )
		{
			e.preventDefault();
			var new_value   = $( e.target ).text();
			var stack_depth = $( e.target ).attr( 'data-stack-depth' );
			var cid         = $( e.target ).attr( 'data-cid' );
			var identifier  = $( e.target ).attr( 'data-identifier' );

			modal.hide();

			dpoh.sendCommand( 'property_set -n ' + identifier + ' -d ' + stack_depth + ' -c ' + cid,
				updateContext.bind( undefined, stack_depth ), new_value );
		}
	}
	
	function updateStackDepth( level )
	{
		$( '#stack_depth' ).text( level );
	}

	function bytesToHumanReadable( size )
	{
		if ( size == 0 )
		{
			return '0 B';
		}
		var i = Math.floor( Math.log( size ) / Math.log(1024) );
		return ( size / Math.pow( 1024, i) ).toFixed (2 ) * 1 + ' ' + [ 'B', 'kB', 'MB', 'GB', 'TB' ][ i ];
	}

	function validateContext( context, depth )
	{
		var expanded = [];
		$( '#context li[aria-expanded=true]' ).each( function( i, el )
		{
			expanded.push( $( el ).attr( 'data-address' ) );
		} );
		$( '#context' ).jstree( "destroy" );
		$( '#context' ).html( buildContextTree( context, depth ) ).jstree().removeClass( 'blur-hidden' );
		var tree = $.jstree.reference( '#context' );
		expanded.forEach( function( address )
		{
			tree.open_node( '[data-address=' + address + ']', function(){}, false );
		} );
	}
	
	function validateStack( stack_array )
	{
		var html = '<div class="css-table stack-table">';
		var max_depth = 0;
		var active = 'active';
		stack_array.forEach( function( data )
		{
			var filename_full  = data.filename;
			var lineno         = data.lineno;
			var level          = data.level;
			var filename_short = filename_full.replace( /^.*\//, '' );
			html +=
				  '<div class="css-row stack-row ' + active + '" data-file="' + filename_full + '" data-line="' + lineno + '" data-stack-depth="' + level + '">'
					+ '<div class="css-cell depth">' + level + '</div>'
					+ '<div class="css-cell file">' + filename_short + '</div>'
					+ '<div class="css-cell line">' + lineno + '</div>'
				+ '</div>'
			
			max_depth = data.level;
			active = '';
		} );
		html += '</div>'
		$( '#stack' ).html( html );
		updateStackDepth( max_depth );
	}

	function updateProperty( identifier, stack_depth, cid, address, data )
	{
		dpoh.sendCommand( 'property_get -n ' + identifier + ' -c ' + cid + ' -d ' + stack_depth, function( data )
		{

			var html = 
			$( '#context' ).jstree( "destroy" );
			var t = $( '[data-address=' + address + ']' );
			t.after( buildContextTree( data.parsed, stack_depth ).replace( /(^\<ul\>|\<\/ul\>$)/g, '' ) );
			$( '#context' ).jstree();
			

		} );
	}
	
	function buildContextTree( context, stack_depth, cid, is_recursive )
	{
		var html = '';
		
		context.forEach( function( property )
		{
			if ( ! html )
			{
				html = '<ul>';
			}
			
			var value = $('<div>').text( property.value || '' ).html(); 
			
			var icon = 'fa-question-circle-o';
			switch ( property.type )
			{
				case 'Superglobals' : icon = 'fa-globe';          break; 
				case 'Locals'       : icon = 'fa-location-arrow'; break; 
				case 'bool'         : icon = 'fa-toggle-on';      break; 
				case 'null'         : icon = 'fa-close';          break; 
				case 'string'       : icon = 'fa-quote-left';     break; 
				case 'object'       : icon = 'fa-cogs';           break; 
				case 'array'        : icon = 'fa-th-list';        break;
				case 'int'          : icon = 'fa-hashtag';        break;
				case 'float'        : icon = 'fa-dot-circle-o';   break;
			}
			
			if ( property.type == 'null' )
			{
				value = 'NULL'
			}
			else if ( property.type == 'bool' )
			{
				value = Number( value ) ? 'TRUE' : 'FALSE';
			}
			
			if ( property.fullname == 'Superglobals' )
			{
				a =1;
			}
			
			html += '<li ' + ( property.no_alter ? 'data-no-alter="true"' : '' ) + ' data-identifier="'
				+ property.fullname + '" class="identifier-leaf" data-jstree="{ &quot;icon&quot; : &quot;identifier-icon fa fa-fw ' + icon + '&quot; }"'
				+ 'data-stack-depth="' + stack_depth + '"'
				+ 'data-current-value="' + value.replace( /"/g, '&quot;' ) + '"'
				+ ( property.address ? ' data-address="' + property.address + '"' : '' )
				+ ( cid ? ' data-cid="' + cid + '"' : '' ) + '>'
				+ '<span class="identifier">' + ( is_recursive ? property.name : property.fullname ) + '</span>'
				+ ( [ 'uninitialized', 'object', 'array', 'Superglobals', 'Locals' ].indexOf( property.type ) == -1 && property.name ? ": " : '' )
				+ ( property.type == 'string' ? '"' + value + '"' : value )
				+ ( property.children ? buildContextTree( property.children, stack_depth, property.cid || cid, true ) : '' )
				+ '</li>';
		} );
		
		return html && html + '</ul>';
	}

	function updateContext( stack_depth )
	{
		var command = 'context_names';
		var depth_arg ='';
		if ( stack_depth % 1 === 0 && stack_depth > -1 )
		{
			depth_arg += ' -d ' + stack_depth;
		}
		command += depth_arg;
		
		dpoh.sendCommand( command, function( context_names )
		{
			var all_contexts = [];
			context_names.parsed.forEach( function( info )
			{
				dpoh.sendCommand( 'context_get -c ' + info.id + depth_arg, function( context_data )
				{
					all_contexts.push( {
						name     : info.name,
						fullname : info.name,
						type     : info.name,
						address  : info.name,
						children : context_data.parsed,
						no_alter : true,
						cid      : info.id,
					} );
					
					if ( all_contexts.length == context_names.parsed.length )
					{
						validateContext( all_contexts, stack_depth || 0 );
					}
				} );
			} );
		} );
	}
	
	function toggleIndicators( show )
	{
		if ( show )
		{
			$( '.status-indicators' ).removeClass( 'blur-hidden' );
			$( '.status-indicators .status-indicator' ).text( '--' );
			$( '.status-panel .scroller' ).removeClass( 'blur-hidden' );
		}
		else
		{
			$( '.status-indicators' ).addClass( 'blur-hidden' );
			$( '.status-panel .scroller' ).addClass( 'blur-hidden' );
		}
	}
	
	function onStackRowClicked( e )
	{
		var file        = $( e.currentTarget ).attr( 'data-file' );
		var line        = $( e.currentTarget ).attr( 'data-line' );
		var stack_depth = $( e.currentTarget ).attr( 'data-stack-depth' );
		$( '.stack-row.active' ).removeClass( 'active' );
		$( e.currentTarget ).addClass( 'active' );
		$( document ).trigger( {
			type     : 'dpoh-interface:file-nav-request',
			filename : file,
			lineno   : line,
			source   : 'stack',
		} );
		updateContext( stack_depth );
		
	}
	
	function onResponseReceived( e )
	{
		var data = e.parsed || {};
		if ( data.is_continuation && !e.is_stopping )
		{
			updateAll();
		}
		
		if ( e.response_type == 'stack_get' )
		{
			validateStack( e.parsed );
		}
	}

	function updateMemoryUsage()
	{
		dpoh.sendCommand( 'eval', function( data )
		{
			var data = data.parsed.value[ 0 ] || {};
			$( '#mem_usage' ).text( bytesToHumanReadable( data.value || 0 ) );
		}, 'memory_get_usage()' );
	}
	
	function onFileChanged( e )
	{
		if ( e.source != 'stack' )
		{
			stackDeviated();
		}
	}

	function updateAll()
	{
		updateMemoryUsage();
		dpoh.sendCommand( 'stack_get' );
		updateContext();
	}
	
	function onSessionStatusChanged( e )
	{
		if ( e.status == 'active' )
		{
			toggleIndicators( true );
			updateAll();
		}
		else
		{
			toggleIndicators( false );
		}
	}

	function stackDeviated()
	{
		$( '.stack-row.active' ).removeClass( 'active' );
	}
 
	$( document ).on( 'dblclick.jstree', '#context',     onNodeDoubleClicked );
	$( document ).on( 'keypress',        '.value-input', onNewValueGiven );
	$( document ).on( 'click',           '.stack-row',   onStackRowClicked );

	$( document ).on( 'dpoh-interface:file-changed', onFileChanged );
	$( document ).on( 'dpoh:response-received',      onResponseReceived );
	$( document ).on( 'dpoh:session-status-changed', onSessionStatusChanged );
	
	return {
		buildContextTree : buildContextTree,
	}
	
}( jQuery ));