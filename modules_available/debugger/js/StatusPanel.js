namespace( 'CodeInspector' ).StatusPanel = (function( $ )
{
	async function onNodeDoubleClicked( e )
	{
		var li = $( e.target ).closest( 'li' );
		if ( li.is( '[data-no-alter]' ) )
		{
			return;
		}

		var identifier  = li.attr( 'data-identifier' );
		var stack_depth = li.attr( 'data-stack-depth' );
		var cid         = li.attr( 'data-cid' );
		var size        = li.attr( 'data-size' );

		var e = await BasicApi.Debugger.command( 'property_get', {
			name        : identifier,
			stack_depth : stack_depth,
			context     : cid,
			max_data    : size,
		} );
		var current_val = $('<div>').text( e.parsed[ 0 ].value || '' ).html();
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

	async function onNewValueGiven( e )
	{
		if ( e.which == 13 && !e.ctrlKey && !e.shiftKey )
		{
			e.preventDefault();
			var new_value   = $( e.target ).text();
			var stack_depth = $( e.target ).attr( 'data-stack-depth' );
			var cid         = $( e.target ).attr( 'data-cid' );
			var identifier  = $( e.target ).attr( 'data-identifier' );

			Theme.Modal.hide();

			await BasicApi.Debugger.command( 'property_set', {
				name        : identifier,
				stack_depth : stack_depth,
				context     : cid
			}, new_value );
			// updateContext( stack_depth );
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

	function validateContext( context )
	{
		var expanded = [];
		$( '#context li[aria-expanded=true]' ).each( function( i, el )
		{
			expanded.push( $( el ).attr( 'data-address' ) );
		} );
		$( '#context' ).jstree( "destroy" );
		$( '#context' ).jstree( { core : { data : buildContextTree( context ) } } ).removeClass( 'blur-hidden' );
		var tree = $.jstree.reference( '#context' );
		expanded.forEach( function( address )
		{
			tree.open_node( '[data-address=' + address + ']', function(){}, false );
		} );
	}

	class StackView extends View
	{
		process( vars ){ return { frames : vars }; }
	}
	StackView.template = 'debugger.stack_frame';

	subscribe( 'program-state-changed', ( e ) =>
	{
		var stack = e.program_state.stack
		$( '#stack' ).html( new StackView( stack.frames ) + '' );
		updateStackDepth( stack.depth );

		var context = e.program_state.contexts;
		var expanded = [];
		$( '#context li[aria-expanded=true]' ).each( function( i, el )
		{
			expanded.push( $( el ).attr( 'data-address' ) );
		} );
		$( '#context' ).jstree( "destroy" );
		$( '#context' ).jstree( { core : { data : buildContextTree( context ) } } ).removeClass( 'blur-hidden' );
		var tree = $.jstree.reference( '#context' );
		expanded.forEach( function( address )
		{
			tree.open_node( '[data-address=' + address + ']', function(){}, false );
		} );
	} );

	async function updateProperty( identifier, stack_depth, cid, address, data )
	{
		var data = await BasicApi.Debugger.command( 'property_get', {
			name        : identifier,
			context     : cid,
			stack_depth : stack_depth,
		} );
		$( '#context' ).jstree( "destroy" );
		var t = $( '[data-address=' + address + ']' );
		t.after( buildContextTree( data.parsed ).replace( /(^\<ul\>|\<\/ul\>$)/g, '' ) );
		$( '#context' ).jstree();
	}

	function buildContextTree( context, is_recursive )
	{
		var nodes = [];

		(context instanceof Array ? context : context.children || [] ).forEach( function( property )
		{
			var stack_depth = property.stackDepth;
			var cid         = property.cid;
			var value       = $('<div>').text( property.value || '' ).html();

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
					'data-size'          : property.size,
				},
				icon    : 'identifier-icon fa fa-fw ' + icon,
				text    : '<span class="identifier">'
					+ ( is_recursive ? property.name : property.fullname )
					+ '</span>',
			};

			if ( property.isReadOnly ){ node.li_attr[ 'data-no-alter' ] = 'true'; }
			if ( property.address  ){ node.li_attr[ 'data-address' ]  = property.address; }
			if ( cid               ){ node.li_attr[ 'data-no-alter' ] = cid; }

			if ( [ 'uninitialized', 'object', 'array', 'Superglobals', 'Locals' ]
				.indexOf( property.type ) == -1 )
			{
				node.text += ( property.name ? ': ' : '' ) + value;
			}

			if ( property.children )
			{
				node.children = buildContextTree( property.children, true );
			}
			else if ( property.hasChildren )
			{
				node.children     = true;
				node.get_children = async function( cb )
				{
					var children = await property.fetchChildren();
					var tree = buildContextTree( children, true );
					cb( tree );
					return tree;
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
					obj.original.get_children( cb );
				}
			};
		}
	}

	function updateStack()
	{
		BasicApi.Debugger.command( 'stack_get' );
	}

//	async function updateContext( nodes )
//	{
//		validateContext( all_contexts, stack_depth || 0 );
//	}

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
		// updateContext( stack_depth ); TODO
	}

	async function updateMemoryUsage()
	{
		var data = await BasicApi.Debugger.command( 'eval', 'memory_get_usage()' );
		var mem_data = data.parsed.value[ 0 ] || {};
		$( '#mem_usage' ).text( bytesToHumanReadable( mem_data.value || 0 ) );
	}

	function onFileChanged( e )
	{
		if ( e.source != 'stack' )
		{
			stackDeviated();
		}
	}

	function onSessionStatusChanged( e )
	{
		if ( e.status == 'active' )
		{
			toggleIndicators( true );
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
	subscribe( 'session-status-changed', onSessionStatusChanged );

	return {
		buildContextTree : buildContextTree,
	};

}( jQuery ));
