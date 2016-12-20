StatusPanel = (function( $ )
{
	var controller = null;
	
	function init( controller_local )
	{
		controller = controller_local;
	}

	function onNodeDoubleClicked( e )
	{
		var identifier = $( e.target ).closest( '[data-identifier]' ).attr( 'data-identifier' );
		modal.set( {
			title : 'Update Value',
			content : '<label>Assign a new value to <span class="identifier">' + identifier
				+'</span></label><div contenteditable data-identifier="' + identifier
				+ '" id="new_value"></div>'
		} );
		modal.show();
		$( '#new_value' ).focus();
	}

	function onNewValueGiven( e )
	{
		if ( e.which == 13 && !e.ctrlKey && !e.shiftKey )
		{
			e.preventDefault();
			var new_value = $( e.target ).text();
			var identifier = $( e.target ).attr( 'data-identifier' );
			modal.hide();

			controller.updateVariable( identifier, new_value );
		}
	}

	function updateMemoryUsage( bytes )
	{
		$( '#mem_usage' ).text( bytesToHumanReadable( bytes ) );
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

	function validateContext( jq_message )
	{
		$( '#context' ).jstree( "destroy" );
		$( '#context' ).html( buildContextTree( $( jq_message ) ) ).jstree().removeClass( 'blur-hidden' );
	}
	
	function validateStack( jq_message )
	{
		var html = '<div class="css-table stack-table">';
		var max_depth = 0;
		var active = 'active';
		jq_message.find( 'stack' ).each( function( i, el )
		{
			el = $( el );
			var filename_full  = el.attr( 'filename' );
			var line_n         = el.attr( 'lineno' );
			var filename_short = filename_full.replace( /^.*\//, '' );
			html +=
				  '<div class="css-row stack-row ' + active + '" data-file="' + filename_full + '" data-line="' + line_n + '">'
					+ '<div class="css-cell depth">' + i + '</div>'
					+ '<div class="css-cell file">' + filename_short + '</div>'
					+ '<div class="css-cell line">' + line_n + '</div>'
				+ '</div>'
			
			max_depth = Math.max( max_depth, Number( el.attr( 'level' ) ) );
			active = '';
		} );
		html += '</div>'
		$( '#stack' ).html( html );
		updateStackDepth( max_depth );
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
			
			var icon = 'fa-question-circle-o';
			switch ( $( element ).attr( 'type' ) )
			{
				case 'bool'   : icon = 'fa-toggle-on';    break; 
				case 'null'   : icon = 'fa-close';        break; 
				case 'string' : icon = 'fa-quote-left';   break; 
				case 'object' : icon = 'fa-cogs';         break; 
				case 'array'  : icon = 'fa-th-list';      break;
				case 'int'    : icon = 'fa-hashtag';      break;
				case 'float'  : icon = 'fa-dot-circle-o'; break;
			}
			
			if ( $( element ).attr( 'type' ) == 'null' )
			{
				value = 'NULL'
			}
			else if ( $( element ).attr( 'type' ) == 'bool' )
			{
				value = value ? 'TRUE' : 'FALSE';
			}
			
			html += '<li data-identifier="' + $( element ).attr( 'fullname' ) + '" class="identifier-leaf" data-jstree="{ &quot;icon&quot; : &quot;identifier-icon fa fa-fw ' + icon + '&quot; }">'
				+ '<span class="identifier">' + $( element ).attr( is_recursive ? 'name' :'fullname' ) + '</span>'
				+ ( $( element ).attr( 'type' ) != 'uninitialized' ? ": " : '' )
				+ ( $( element ).attr( 'type' ) == 'string' ? '"' + value + '"' : value )
				+ buildContextTree( $( element ), true )
				+ '</li>';
		} );
		
		return html && html + '</ul>';
	}

	function toggleIndicators( show )
	{
		if ( show )
		{
			$( '.status-indicators' ).removeClass( 'blur-hidden' );
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
		var file = $( e.currentTarget ).attr( 'data-file' );
		var line = $( e.currentTarget ).attr( 'data-line' );
		$( '.stack-row.active' ).removeClass( 'active' );
		$( e.currentTarget ).addClass( 'active' );
		controller.navigateStack( file, line );
	}
	
	function onStatusNavigation( e )
	{
		var selector_show = $( e.currentTarget ).attr( 'data-status-show' );
		$( '.status-panel' ).addClass( 'hidden' );
		$( selector_show ).removeClass( 'hidden' );
		$( '[data-status-show]' ).removeClass( 'active' );
		$( e.currentTarget ).addClass( 'active' );
	}

	$( document ).on( 'dblclick.jstree', '#context',           onNodeDoubleClicked );
	$( document ).on( 'keypress',        '#new_value',         onNewValueGiven );
	$( document ).on( 'click',           '.stack-row',         onStackRowClicked );
	$( document ).on( 'click',           '[data-status-show]', onStatusNavigation );

	return {
		init              : init,
		updateMemoryUsage : updateMemoryUsage,
		updateStackDepth  : updateStackDepth,
		validateContext   : validateContext,
		validateStack     : validateStack,
		toggleIndicators  : toggleIndicators,
	}
	
}( jQuery ));