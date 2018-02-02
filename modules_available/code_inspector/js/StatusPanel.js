namespace( 'CodeInspector' ).StatusPanel = (function( $ )
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

		Theme.Modal.set( {
			title : 'Update Value',
			content : '<label>Assign a new value to <span class="identifier">' + identifier
				+':</span></label><div class="value-input" contenteditable data-identifier="' + identifier
				+ '" data-stack-depth="' + stack_depth + '" data-cid="' + cid + '">' + current_val + '</div>'
		} );
		Theme.Modal.show();
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

			Theme.Modal.hide();

			BasicApi.Debugger.command( 'property_set', {
					name        : identifier,
					stack_depth : stack_depth,
					context     : cid
				},
				updateContext.bind( undefined, stack_depth ),
				new_value );
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
		$( '#context' ).jstree( { core : { data : buildContextTree( context, depth ) } } ).removeClass( 'blur-hidden' );
		var tree = $.jstree.reference( '#context' );
		expanded.forEach( function( address )
		{
			tree.open_node( '[data-address=' + address + ']', function(){}, false );
		} );
	}

	function validateStack( stack_array )
	{
		var html = '<div class="css-table stack-table no-max-height">';
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
		BasicApi.Debugger.command( 'property_get', {
				name        : identifier,
				context     : cid,
				stack_depth : stack_depth,
		},
		function( data )
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
		var nodes = [];

		context.forEach( function( property )
		{
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

			var node = {
				li_attr : {
					'data-identifier'    : property.fullname,
					'class'              : 'identifier-leaf',
					'data-stack-depth'   : stack_depth,
					'data-current-value' : value,
				},
				icon    : 'identifier-icon fa fa-fw ' + icon,
				text    : '<span class="identifier">'
					+ ( is_recursive ? property.name : property.fullname )
					+ '</span>',
			};

			if ( property.no_alter ){ node.li_attr[ 'data-no-alter' ] = 'true'; }
			if ( property.address  ){ node.li_attr[ 'data-address' ]  = property.address; }
			if ( cid               ){ node.li_attr[ 'data-no-alter' ] = cid; }

			if ( [ 'uninitialized', 'object', 'array', 'Superglobals', 'Locals' ]
				.indexOf( property.type ) == -1 )
			{
				node.text += ( property.name ? ': ' : '' ) + value;
			}

			if ( property.children )
			{
				node.children = buildContextTree( property.children, stack_depth, cid, true );
			}
			else if ( Number( property.numchildren ) && property.fullname )
			{
				node.children     = true;
				node.get_children = function( parent, cb )
				{
					BasicApi.Debugger.command( 'property_get', {
							name        : property.fullname,
							stack_depth : stack_depth || 0,
							context     : cid || undefined,
						},
						function( children )
						{
							// For eval, no property.fullname is given. Does that use a different parse method?
							cb( buildContextTree( children.parsed[ 0 ].children, stack_depth, cid, true ) );
						} );
				};
			}

			nodes.push( node );
		} );

		if ( is_recursive )
		{
			return nodes;
		}
		else
		{
			return function( obj, cb )
			{
				if ( obj.id == '#' )
				{
					cb( nodes );
				}
				else if ( typeof obj.original.get_children == 'function' )
				{
					obj.original.get_children( obj, cb );
				}
			};
		}
	}

	function updateStack()
	{
		BasicApi.Debugger.command( 'stack_get' );
	}

	function updateContext( stack_depth )
	{
		var command = 'context_names';
		if ( !( stack_depth % 1 === 0 && stack_depth > -1 ) )
		{
			stack_depth = undefined;
		}

		BasicApi.Debugger.command( 'context_names', {
				stack_depth : stack_depth,
			},
			function( context_names )
			{
				var all_contexts = [];
				context_names.parsed.forEach( function( info )
				{
					BasicApi.Debugger.command( 'context_get', {
							context     : info.id,
							stack_depth : stack_depth,
						},
						function( context_data )
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
			$( '.status-indicator' ).removeClass( 'blur-hidden' );
		}
		else
		{
			$( '.status-indicator' ).addClass( 'blur-hidden' );
		}
	}

	function onStackRowClicked( e )
	{
		var file        = $( e.currentTarget ).attr( 'data-file' );
		var line        = $( e.currentTarget ).attr( 'data-line' );
		var stack_depth = $( e.currentTarget ).attr( 'data-stack-depth' );
		$( '.stack-row.active' ).removeClass( 'active' );
		$( e.currentTarget ).addClass( 'active' );
		publish( 'file-nav-request', {
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

		if ( e.response_type == 'debugger_command:stack_get' )
		{
			validateStack( e.parsed );
		}
	}

	function updateMemoryUsage()
	{
		BasicApi.Debugger.command( 'eval', function( data )
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
		BasicApi.Debugger.command( 'stack_get' );
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

	subscribe( 'file-changed',           onFileChanged );
	subscribe( 'response-received',      onResponseReceived );
	subscribe( 'session-status-changed', onSessionStatusChanged );

	return {
		buildContextTree : buildContextTree,
	};

}( jQuery ));
