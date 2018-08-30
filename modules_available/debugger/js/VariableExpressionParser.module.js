export default Parser

/**
 * @file
 *	Find and parse simple variable expressions to aid in showing values when expressions in the
 *	code window are hovered
 */
var TokenIterator = ace.require( "./token_iterator" ).TokenIterator;
var Range = ace.require( 'ace/range' ).Range;
var variable_regex = /^variable($|\..*)/;

var parse_sequence_arrows = [
	function( token )
	{
		if ( token.type == 'keyword.operator' && token.value == '->' )
		{
			return parse_actions.APPEND_CONTINUE
		}
		else
		{
			return parse_actions.RETURN;
		}
	},
	function( token )
	{
		if ( variable_regex.test( token.type ) )
		{
			return parse_actions.RECURSE_RESTART;
		}
		else if ( token.type == 'identifier' )
		{
			return parse_actions.RESTART;
		}
		else
		{
			return parse_actions.RETURN;
		}
	},
];

var parse_sequence_brackets = [
	function( token )
	{
		if ( token.type == 'paren.lparen' && token.value == '[' )
		{
			return parse_actions.APPEND_CONTINUE
		}
		else
		{
			return parse_actions.RETURN;
		}
	},
	function( token )
	{
		if ( variable_regex.test( token.type ) )
		{
			return parse_actions.RECURSE;
		}
		else if ( token.type == 'string' || token.type.match( /^constant\./ ) )
		{
			return parse_actions.APPEND_CONTINUE;
		}
		else
		{
			return parse_actions.RETURN;
		}
	},
	function( token )
	{
		if ( token.type == 'paren.rparen' && token.value.match( /]\)*/ ) )
		{
			token.value = ']';
			return parse_actions.RESTART
		}
		else
		{
			return parse_actions.RETURN;
		}
	},
];

var parse_actions = {
	APPEND_CONTINUE : Symbol( 'APPEND_CONTINUE' ),
	RESTART         : Symbol( 'RESTART' ),
	RECURSE         : Symbol( 'RECURSE' ),
	RECURSE_RESTART : Symbol( 'RECURSE_RESTART' ),
	RETURN          : Symbol( 'RETURN' ),
};

function Parser( token_iterator )
{
	this.iter         = token_iterator;
	this.full_expr    = '';
	this.pending_expr = '';
	this.start        = token_iterator.getCurrentTokenPosition() || { row : 0, column : 0 };
	this.end          = { row : this.start.row, column : this.start.column };
}

Parser.sequences = {
	parse_sequence_brackets,
	parse_sequence_arrows,
};

/**
 * @brief
 *	Given a hovered token, find the variable expression that contains the hovered token
 *
 * @param TokenIterator it
 *
 * @retval object|false
 *	The return value of Parser.parse(), or false if the hovered character is not within a
 *	variable expression
 */
Parser.getContainingExpression = function( it )
{
	// Get the token that was hovered
	var token = it.getCurrentToken();
	var pos   = token && it.getCurrentTokenPosition();

	while ( token )
	{
		// Keep walking backwards in search of a variable token.
		while ( !variable_regex.test( token.type ) )
		{
			it.stepBackward();
			token = it.getCurrentToken();

			// If we walked back to the beginning of the token stream, or encountered an
			// expression separator, the hovered character is not within a variable expression.
			if ( !token || this.expression_separators.has( token.value ) )
			{
				return false;
			}
		}

		// Create a copy of our token iterator, and pass it to parseVariableExpression, which
		// will give us `token`'s full variable expression (and modify it_copy in the process,
		// which is why we copy it)
		var it_copy = $.extend( {}, it, true );
		var candidate_expr = this.parse( it_copy );

		// If the hovered character is within `token`'s full variable expression, we've found
		// the containing expression.
		if ( pos.row      >= candidate_expr.range.start.row
			&& pos.column >= candidate_expr.range.start.column
			&& pos.row    <= candidate_expr.range.end.row
			&& pos.column <= candidate_expr.range.end.column )
		{
			return candidate_expr;
		}
		// Otherwise, continue walking backwards. This covers cases where, e.g., `$bar` is
		// hovered in the expression $biz[ $foo ][ $bar ].
		else
		{
			it.stepBackward();
			token = it.getCurrentToken();
		}
	}
	return false;
}

Parser.expression_separators = new Set( [ ':', ';', ')', '(', ',' ] );

Parser.prototype.selectSequence = function( token )
{
	if ( token )
	{
		var sequences = this.constructor.sequences;
		for ( var key in sequences )
		{
			var action = sequences[ key ][ 0 ]( token );
			if ( action != parse_actions.RETURN )
			{
				return {
					sequence : sequences[ key ],
					action,
				};
			}
		}
	}
	return false;
}

Parser.prototype.next = function()
{
	do
	{
		var current = this.iter.stepForward();
	}
	while ( current && current.type == 'text' && current.value.match( /^\s+$/ ) );
	return current;
}

Parser.parse = function( token_iterator )
{
	var parser = new this( token_iterator );
	parser.parse();
	return {
		expr  : parser.full_expr,
		range : new Range( parser.start.row, parser.start.column, parser.end.row, parser.end.column ),
	};
}

Parser.prototype.parse = function()
{
	var current = this.iter.getCurrentToken();

	if ( current && variable_regex.test( current.type ) )
	{
		this.full_expr  += current.value;
		this.end.column += current.value.length;
	}
	else
	{
		return;
	}

	// Flags
	var flags = {
		skip_seek : false,
		stop      : false,
		restart   : false
	};
	var sequence = [];
	var current;
	var action;

	for ( var step = 0; !step || step < sequence.length; step++ )
	{
		if ( flags.skip_seek )
		{
			current = this.iter.getCurrentToken();
		}
		else
		{
			current = this.next();
		}

		if ( step == 0 )
		{
			let selection = this.selectSequence( current );
			if ( !selection )
			{
				return;
			}
			({ sequence, action } = selection);
		}
		else
		{
			action = sequence[ step ]( current );
		}

		flags = { no_seek : false, stop : false, restart : false };
		this.applyAction( action, current, flags );
		if ( flags.stop )
		{
			return;
		}
		else if ( flags.restart )
		{
			step = -1; // Loop increment will make this 0
			continue;
		}
	}
}

Parser.prototype.applyAction = function( action, token, flags )
{
	flags = flags || {};
	switch ( action )
	{
		case parse_actions.APPEND_CONTINUE:
			this.pending_expr += token.value;
			break;

		case parse_actions.RECURSE: // fall through
		case parse_actions.RECURSE_RESTART:
			var parsed = Parser.parse( this.iter );
			if ( parsed )
			{
				this.pending_expr += parsed.expr;
				this.end.column = parsed.range.end.column; // TODO: we need a pending end?
				this.end.row    = parsed.range.end.row;    // TODO: we need a pending end?
				flags.skip_seek = true; // We're already at the correct token now;
			}
			else
			{
				throw new Error( 'Failed to parse variable expression' );
			}

			if ( action == parse_actions.RECURSE_RESTART )
			{
				this.full_expr   += this.pending_expr;
				this.pending_expr = '';
				flags.restart     = true;
			}
			break;

		case parse_actions.RESTART:
			this.full_expr   += this.pending_expr + token.value;
			this.pending_expr = '';
			this.end.column   = this.iter.getCurrentTokenColumn() + token.value.length;
			this.end.row      = this.iter.getCurrentTokenRow();
			flags.restart     = true;
			break;


		case parse_actions.RETURN:
			flags.stop = true;
			break;
	}
}

subscribe( 'provide-tests', function()
{
	function MockTokenIterator( tokens )
	{
		this.index = 0;
		this.tokens = tokens;
	}

	MockTokenIterator.prototype.indexInRange = function()
	{
		return this.index >= 0 && this.index < this.tokens.length;
	}

	MockTokenIterator.prototype.getCurrentTokenColumn = function()
	{
		return this.indexInRange() ? this.tokens[ this.index ].col : null;
	}

	MockTokenIterator.prototype.getCurrentTokenRow = function()
	{
		return this.indexInRange() ? this.tokens[ this.index ].row : null;
	}

	MockTokenIterator.prototype.getCurrentTokenPosition = function()
	{
		return this.indexInRange()
			? { row : this.tokens[ this.index ].row, column : this.tokens[ this.index ].col }
			: null;
	}

	MockTokenIterator.prototype.getCurrentToken = function()
	{
		return this.indexInRange()
			? { type : this.tokens[ this.index ].type, value : this.tokens[ this.index ].value }
			: null;
	}

	MockTokenIterator.prototype.stepForward = function()
	{
		this.index = Math.min( this.tokens.length, this.index + 1 );
		return this.getCurrentToken();
	}

	MockTokenIterator.prototype.stepBackward = function()
	{
		this.index = Math.max( -1, this.index - 1 );
		return this.getCurrentToken();
	}

	function verifyResult( iter, expected_expr, expected_range )
	{
		var result = Parser.parse( iter );
		expect( !! result ).toBe( true );
		expect( result.expr ).toBe( expected_expr );
		expect( result.range.start.row ).toBe( expected_range[ 0 ] );
		expect( result.range.start.column ).toBe( expected_range[ 1 ] );
		expect( result.range.end.row ).toBe( expected_range[ 2 ] );
		expect( result.range.end.column ).toBe( expected_range[ 3 ] );
	}

	describe( "CodeInspector.VariableExpressionParser", function()
	{
		it( "parse", function()
		{
			function verifyResult( iter, expected_expr, expected_range )
			{
				var result = Parser.parse( iter );
				expect( !! result ).toBe( true );
				expect( result.expr ).toBe( expected_expr );
				expect( result.range.start.row ).toBe( expected_range[ 0 ] );
				expect( result.range.start.column ).toBe( expected_range[ 1 ] );
				expect( result.range.end.row ).toBe( expected_range[ 2 ] );
				expect( result.range.end.column ).toBe( expected_range[ 3 ] );
			}
			function verifyResult( iter, expected_expr, expected_range )
			{
				var result = Parser.parse( iter );
				expect( !! result ).toBe( true );
				expect( result.expr ).toBe( expected_expr );
				expect( result.range.start.row ).toBe( expected_range[ 0 ] );
				expect( result.range.start.column ).toBe( expected_range[ 1 ] );
				expect( result.range.end.row ).toBe( expected_range[ 2 ] );
				expect( result.range.end.column ).toBe( expected_range[ 3 ] );
			}

			var empty_iter   = new MockTokenIterator( [] );
			var trivial_iter = new MockTokenIterator( [
				{ row : 1, col : 1, value : '$a', type : 'variable' },
			] );
			var array_single_index_iter = new MockTokenIterator( [
				{ row : 1, col : 1,  value : '$abc',  type : 'variable' },
				{ row : 1, col : 5,  value : '[',     type : 'paren.lparen' },
				{ row : 1, col : 6,  value : '"zyx"', type : 'string' },
				{ row : 1, col : 11, value : ']',     type : 'paren.rparen' },
			] );
			var array_double_index_iter = new MockTokenIterator( [
				{ row : 1, col : 1,  value : '$asdf', type : 'variable' },
				{ row : 1, col : 5,  value : '[',     type : 'paren.lparen' },
				{ row : 1, col : 6,  value : '"zyx"', type : 'string' },
				{ row : 1, col : 11, value : ']',     type : 'paren.rparen' },
				{ row : 1, col : 12, value : '[',     type : 'paren.lparen' },
				{ row : 1, col : 13, value : '"uv"',  type : 'string' },
				{ row : 1, col : 17, value : ']',     type : 'paren.rparen' },
			] );
			var array_multiline_iter = new MockTokenIterator( [
				{ row : 1, col : 1,  value : '$defa', type : 'variable' },
				{ row : 1, col : 6,  value : '[',     type : 'paren.lparen' },
				{ row : 1, col : 7,  value : '"zyx"', type : 'string' },
				{ row : 1, col : 12, value : ']',     type : 'paren.rparen' },
				{ row : 2, col : 1,  value : '    ',  type : 'text' },
				{ row : 2, col : 5, value : '[',      type : 'paren.lparen' },
				{ row : 2, col : 6, value : '"uv"',   type : 'string' },
				{ row : 2, col : 10, value : ']',     type : 'paren.rparen' },
			] );
			var array_variable_index_iter = new MockTokenIterator( [
				{ row : 1, col : 1,  value : '$fizz',    type : 'variable' },
				{ row : 1, col : 6,  value : '[',        type : 'paren.lparen' },
				{ row : 1, col : 7,  value : '$foo',     type : 'variable' },
				{ row : 2, col : 5,  value : '[',        type : 'paren.lparen' },
				{ row : 2, col : 6,  value : '"nested"', type : 'string' },
				{ row : 2, col : 10, value : ']',        type : 'paren.rparen' },
				{ row : 1, col : 11, value : ']',        type : 'paren.rparen' },
				{ row : 2, col : 1,  value : '    ',     type : 'text' },
				{ row : 2, col : 5,  value : '[',        type : 'paren.lparen' },
				{ row : 2, col : 6,  value : '"uv"',     type : 'string' },
				{ row : 2, col : 10, value : ']',        type : 'paren.rparen' },
			] );
			var obj_single_iter = new MockTokenIterator( [
				{ row : 1, col : 1, value : '$abc', type : 'variable' },
				{ row : 1, col : 5, value : '->',   type : 'keyword.operator' },
				{ row : 1, col : 7, value : 'zyx',  type : 'identifier' },
			] );
			var obj_double_iter = new MockTokenIterator( [
				{ row : 1, col : 1,  value : '$abc', type : 'variable' },
				{ row : 1, col : 5,  value : '->',   type : 'keyword.operator' },
				{ row : 1, col : 7,  value : 'zyx',  type : 'identifier' },
				{ row : 1, col : 11, value : '->',   type : 'keyword.operator' },
				{ row : 1, col : 13, value : 'fuzz', type : 'identifier' },
			] );
			var obj_multiline_iter = new MockTokenIterator( [
				{ row : 1, col : 1, value : '$hello', type : 'variable' },
				{ row : 2, col : 1, value : '->',     type : 'keyword.operator' },
				{ row : 2, col : 3, value : 'foo',    type : 'identifier' },
				{ row : 3, col : 1, value : '->',     type : 'keyword.operator' },
				{ row : 3, col : 3, value : 'bar',    type : 'identifier' },
			] );
			var obj_variable_iter = new MockTokenIterator( [
				{ row : 1, col : 1, value : '$hello', type : 'variable' },
				{ row : 2, col : 1, value : '->',     type : 'keyword.operator' },
				{ row : 2, col : 3, value : '$foo',   type : 'variable' },
				{ row : 3, col : 1, value : '->',     type : 'keyword.operator' },
				{ row : 3, col : 3, value : 'bar',    type : 'identifier' },
			] );
			var complex_iter = new MockTokenIterator( [
				{ row : 1, col : 1,  value : '$world', type : 'variable' },
				{ row : 2, col : 1,  value : '->',     type : 'keyword.operator' },
				{ row : 2, col : 3,  value : 'buzz',   type : 'identifier' },
				{ row : 2, col : 7,  value : '[',      type : 'paren.lparen' },
				{ row : 2, col : 8,  value : '$_GET',   type : 'variable.language' },
				{ row : 2, col : 12, value : ']',      type : 'paren.rparen' },
				{ row : 3, col : 1,  value : '->',     type : 'keyword.operator' },
				{ row : 3, col : 3,  value : 'bar',    type : 'identifier' },
			] );

			verifyResult( empty_iter,                '',                            [ 0, 0, 0, 0 ] );
			verifyResult( trivial_iter,              '$a',                          [ 1, 1, 1, 3 ] );
			verifyResult( array_single_index_iter,   '$abc["zyx"]',                 [ 1, 1, 1, 12 ] );
			verifyResult( array_double_index_iter,   '$asdf["zyx"]["uv"]',          [ 1, 1, 1, 18 ] );
			verifyResult( array_multiline_iter,      '$defa["zyx"]["uv"]',          [ 1, 1, 2, 11 ] );
			verifyResult( array_variable_index_iter, '$fizz[$foo["nested"]]["uv"]', [ 1, 1, 2, 11 ] );
			verifyResult( obj_single_iter,           '$abc->zyx',                   [ 1, 1, 1, 10 ] );
			verifyResult( obj_double_iter,           '$abc->zyx->fuzz',             [ 1, 1, 1, 17 ] );
			verifyResult( obj_multiline_iter,        '$hello->foo->bar',            [ 1, 1, 3, 6 ] );
			verifyResult( obj_variable_iter,         '$hello->$foo->bar',           [ 1, 1, 3, 6 ] );
			verifyResult( complex_iter,              '$world->buzz[$_GET]->bar',     [ 1, 1, 3, 6 ] );
		} );

		it( "getContainingExpression", function()
		{
			var no_expr = new MockTokenIterator( [
				{ row : 1, col : 1,  value : '"fizz"', type : 'string' },
			] );
			var simple_expr = new MockTokenIterator( [
				{ row : 1, col : 1,  value : '$fizz', type : 'variable' },
			] );
			expect( Parser.getContainingExpression( no_expr ) ).toBe( false );

			var nestest_iter = new MockTokenIterator( [
				{ row : 1, col : 1,  value : '$fizz',    type : 'variable' },
				{ row : 1, col : 6,  value : '[',        type : 'paren.lparen' },
				{ row : 1, col : 7,  value : '$foo',     type : 'variable' },
				{ row : 2, col : 5,  value : '[',        type : 'paren.lparen' },
				{ row : 2, col : 6,  value : '"nested"', type : 'string' },
				{ row : 2, col : 10, value : ']',        type : 'paren.rparen' },
				{ row : 1, col : 11, value : ']',        type : 'paren.rparen' },
				{ row : 2, col : 1,  value : '    ',     type : 'text' },
				{ row : 2, col : 5,  value : '[',        type : 'paren.lparen' },
				{ row : 2, col : 6,  value : '"uv"',     type : 'string' },
				{ row : 2, col : 10, value : ']',        type : 'paren.rparen' },
			] );
		} );

	} );
} );
