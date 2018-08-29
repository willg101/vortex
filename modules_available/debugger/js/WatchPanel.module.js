import Persistor from './Persistor.module.js'
import Debugger  from './Debugger.module.js'

(function( $ )
{
	var expressions;
	const LOCAL_STORAGE_NAME = 'vortex_local_storage_watch_expressions';
	const MAGIC_EVAL_VAR_NAME = '$__';
	const HEREDOC_PREFIX      = 'eval(<<<\'VORTEXEVAL\'\n' + MAGIC_EVAL_VAR_NAME + ' = NULL;\n';
	const HEREDOC_SUFFIX      = '\nreturn ' + MAGIC_EVAL_VAR_NAME + ';\nVORTEXEVAL\n);';
	var eval_magic_var_regex  = new RegExp( '\\' + MAGIC_EVAL_VAR_NAME + '($|[^_\\w])' )

	var settings = new Persistor( 'watch_panel_settings' );
	var has_warned_this_session;

	function notifyUserOfWatchWarning()
	{
		if ( !settings.no_notify && !has_warned_this_session )
		{
			Theme.notify( 'error', 'A watched expression failed to execute and may cause stray'
				+ ' warnings or notices in your output.', '', { timeOut : 10000 } );
			has_warned_this_session = true;
		}
	}

	function prepareCommand( command_str )
	{
		command_str = typeof command_str == 'string' ? command_str : '';
		return command_str.match( eval_magic_var_regex )
			? HEREDOC_PREFIX + command_str + HEREDOC_SUFFIX
			: command_str;
	}

	function loadExpressions()
	{
		try
		{
			expressions = JSON.parse( localStorage.getItem( LOCAL_STORAGE_NAME ) ) || []; // TODO: use `settings`
		}
		catch ( e )
		{
			expressions = [];
		}
	}

	function saveExpressions()
	{
		localStorage.setItem( LOCAL_STORAGE_NAME, JSON.stringify( expressions.filter( function( a )
		{
			return a;
		} ) ) );
	}

	function init()
	{
		loadExpressions();
	}

	function renderExpressions()
	{
		$( '#watch' ).html( render( 'debugger.watch_panel', {
			expressions : expressions,
		} ) );
		expressions.forEach( function( expr, i )
		{
			evalWatchedExpression( expr.expression, $( '[data-watch-id="' + i + '"] .result' ) );
		} );
	}

	function onAddExpressionClicked( e )
	{
		Theme.Modal.set( {
			title : 'Watch Expression',
			content : render( 'debugger.watch_expression_modal' ),
		} );
		Theme.Modal.show();
	}

	async function evalWatchedExpression( expression, output )
	{
		output = $( output );
		Debugger.command( 'feature_set', { name : 'max_depth', value : 10 } );
		var data = await Debugger.command( 'eval', function( data )
		{
			if ( output.is( '.jstree' ) )
			{
				$( output ).jstree( 'destroy' );
			}

			if ( data.parsed.value && data.parsed.value.length )
			{
				data.parsed.value.forEach( function( item )
				{
					item.name     = item.name || '';
					item.fullname = item.fullname || '';
				} );
				$( output ).html( '' ).vtree( data.parsed.value );
			}
			else if ( data.parsed.message )
			{
				var message = $( '<i class="fa fa-warning"></i>' ).attr( 'title', message );
				$( output ).html( message );
				notifyUserOfWatchWarning();
			}
			else
			{
				var message = $( '<i class="fa fa-warning"></i>' )
					.attr( 'title', 'An empty response was received' );
				$( output ).html( message );
			}
		}, );
		Debugger.command( 'feature_set', { name : 'max_depth', value : 1 } );
	}

	function onExpressionInputKeypress( e )
	{
		if ( e.which == 13 && !e.ctrlKey && !e.metaKey && !e.shiftKey )
		{
			var id = $( '.we-expression-input' ).attr( 'data-expression-id' );
			var expression = $( '.we-expression-input' ).text().trim();
			if ( id )
			{
				expressions[ id ] = { expression };
			}
			else
			{
				expressions.push( { expression } );
				id = expressions.length - 1;
			}
			saveExpressions();
			renderExpression( expression, id );
			Theme.Modal.hide();
		}
	}

	function renderExpression( expr, id )
	{
		var faux_expressions = [];
		faux_expressions[ id ] = {
			expression : expr
		};
		var existing_row = $( '#watch [data-watch-id="' + id + '"]' );
		if ( !existing_row.length )
		{
			$( '#watch table.watch' ).append( render( 'debugger.watch_panel', {
				no_table : true,
				expressions : faux_expressions,
			} ) );
		}
		else
		{
			existing_row.find( '.display-expression' ).text( expr );
		}
		evalWatchedExpression( expr, '[data-watch-id="' + id + '"] .result' );
	}

	function onDeleteClicked( e )
	{
		var row = $( e.target ).closest( '[data-watch-id]' );
		var id = row.attr( 'data-watch-id' );
		delete expressions[ id ];
		saveExpressions();
		row.remove();
	}

	function onSessionStatusChanged( e )
	{
		if ( e.status == 'active' )
		{
			has_warned_this_session = false;
			renderExpressions();
			$( '#watch' ).fadeIn();
		}
		else
		{
			$( '#watch' ).fadeOut( function(){ $( this ).html( '' ); } );
		}
	}

	function onResponseReceived( e )
	{
		if ( e.parsed && e.parsed.is_continuation )
		{
			renderExpressions();
		}
	}

	function onExpressionDoubleClicked( e )
	{
		var row = $( e.target ).closest( '[data-watch-id]' );
		var id = row.attr( 'data-watch-id' );
		Theme.Modal.set( {
			title : 'Watch Expression',
			content : render( 'debugger.watch_expression_modal', { expression : expressions[ id ].expression, id : id } ),
		} );
		Theme.Modal.show();
	}

	subscribe( 'session-status-changed', onSessionStatusChanged );
	subscribe( 'response-received', onResponseReceived );

	$( init );
	$( document ).on( 'click',    '[data-watch-id] [data-role=delete]', onDeleteClicked );
	$( document ).on( 'click',    '#watch .add-expression', onAddExpressionClicked );
	$( document ).on( 'dblclick', '#watch .display-expression', onExpressionDoubleClicked );
	$( document ).on( 'keypress', '.we-expression-input',   onExpressionInputKeypress );

}( jQuery ));
