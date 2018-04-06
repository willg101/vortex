namespace( 'BasicApi' ).ResponseParsers = (function( $ )
{
	function ParserError(){};
	ParserError.prototype = new Error;
	ParserError.prototype.name = 'BasicApi.ResponseParsers.ParserError';

	/**
	 * @brief
	 *	Parses CDATA from within an XML element
	 *
	 * @param jQuery jq_element
	 *
	 * @retval mixed
	 */
	function parseCdata( jq_element )
	{
		if ( !jq_element.length )
		{
			return;
		}

		var data = jq_element.html().replace( '<!--[CDATA[', '' ).replace( ']]-->', '' );
		return jq_element.is( '[encoding=base64]' )
			? atob( data )
			: data;
	}

	/**
	 * @brief
	 *	Extracts a list of attributes from a jQuery-wrapped object into a plain object
	 *
	 * @param jQuery jq_el
	 * @param Array attr_list
	 *	An Array of attribute names
	 *
	 * @retval object
	 *	A key for each attribute name from attr_list will exist, even if the corresponding value is
	 *	undefined
	 */
	function extractAttrs( jq_element, attr_list )
	{
		if ( !jq_element.length )
		{
			return {};
		}

		var result = {};
		attr_list.forEach( function( attr_name )
		{
			result[ attr_name ] = jq_element.attr( attr_name );
		} );
		return result;
	}

	// Parsers for responses to various commands sent to the DE. Keys are command names and point to
	// functions that process the response into a more useful format. Parsed data returned by these
	// functions is included on 'response-received' events, under the key 'parsed'
	var response_parsers = {
		/**
		 * @brief
		 *	Parses the response from an 'eval' command
		 *
		 * @param jQuery jq_message
		 *
		 * @retval object
		 */
		eval : function( jq_message )
		{
			var data     = {};
			data.value   = parseContextGet( jq_message );
			data.message = parseCdata( jq_message.find( 'message' ) );
			return data;
		},

		/**
		 * @brief
		 *	Parses the response from a stack_get command
		 *
		 * @param jQuery jq_message
		 *
		 * @retval object
		 */
		stack_get : function( jq_message )
		{
			var stack = [];
			jq_message.find( 'stack' ).each( function( i, el )
			{
				stack.push( extractAttrs( $( el ), [ 'where', 'level', 'type', 'filename',
					'lineno' ] ) );
			} );
			return stack;
		},

		/**
		 * @brief
		 *	Parses the response from a context_names command
		 *
		 * @param jQuery jq_message
		 *
		 * @retval object
		 */
		context_names : function( jq_message )
		{
			var data = [];

			jq_message.find( 'context' ).each( function( i, el )
			{
				el = $( el );
				data.push( extractAttrs( el, [ 'name', 'id' ] ) );
			} );

			return data;
		},

		property_get      : parseContextGet,
		context_get       : parseContextGet,

		breakpoint_set    : parseBreakpointAddRemove,
		breakpoint_remove : parseBreakpointAddRemove,
		breakpoint_get    : parseBreakpoints,
		breakpoint_list   : parseBreakpoints,

		step_into         : parseContinuationCommand,
		step_over         : parseContinuationCommand,
		step_out          : parseContinuationCommand,
		stop              : parseContinuationCommand,
		detach            : parseContinuationCommand,
		run               : parseContinuationCommand,
		init              : parseContinuationCommand,
		status            : parseContinuationCommand,
	}

	/**
	 * @brief
	 *	Parses the response from a context_get command. This is defined as a standalone function due
	 *	to its recursive nature (items within the context can have items nested within them)
	 *
	 * @param jQuery jq_message
	 *
	 * @retval object
	 */
	function parseContextGet( jq_message )
	{
		var properties = [];
		jq_message.find( '> property' ).each( function( i, el )
		{
			el = $( el );
			var property = extractAttrs( el, [ 'name', 'type', 'fullname', 'address', 'size',
				'is_recursive', 'numchildren' ] );

			if ( el.children().length )
			{
				property.children = parseContextGet( el )
			}
			else if ( property.type != 'uninitialized' && property.type != 'null' )
			{
				property.value = parseCdata( el );
			}

			if ( typeof property.numchildren != "undefined" )
			{
				property.numchildren = parseInt( property.numchildren );
			}

			if ( /^int(eger)?/i.test( property.type ) )
			{
				property.value = parseInt( property.value );
			}
			else if ( /^(float|double)$/i.test( property.type ) )
			{
				property.value = parseFloat( property.value );
			}

			properties.push( property );
		} );
		return properties;
	}

	/**
	 * @brief
	 *	Parses the response from breakpoint_add and breakpoint_remove command.
	 *
	 * @param jQuery jq_message
	 *
	 * @retval object
	 */
	function parseBreakpointAddRemove( jq_message )
	{
		return {
			id : jq_message.attr( 'id' ),
		};
	}

	/**
	 * @brief
	 *	Parses the response from a continuation command such as 'step_into', 'step_over', 'run',
	 *	etc.
	 *
	 * @param jQuery jq_message
	 *
	 * @retval object
	 */
	function parseContinuationCommand( jq_message )
	{
		var info = extractAttrs( jq_message, [ 'status', 'reason' ] );
		info.is_continuation = true;
		if ( jq_message.children().length )
		{
			$.extend( info, extractAttrs( jq_message.children(), [ 'filename', 'lineno' ] ) );
		}
		return info;
	}

	/**
	 * @brief
	 *	Parses the response from a breakpoint_get or breakpoint_list command
	 *
	 * @param jQuery jq_message
	 *
	 * @retval object
	 */
	function parseBreakpoints( jq_message )
	{
		var breakpoints = {
			line        : [],
			call        : [],
			'return'    : [],
			exception   : [],
			conditional : [],
			watch       : [],
		};

		jq_message.find( 'breakpoint' ).each( function( i, el )
		{
			el = $( el );
			var attrs = extractAttrs( el, [ 'type', 'filename', 'lineno', 'state', 'function',
				'temporary', 'hit_count', 'hit_value', 'hit_condition', 'exception',
				'expression', 'id' ] );
			attrs.expression_element = parseCdata( el.find( 'expression' ) );
			if ( breakpoints[ attrs.type ] )
			{
				breakpoints[ attrs.type ].push( attrs );
			}
			else
			{
				throw new ParserError( 'Unknown breakpoint type ' + attrs.type )
			}
		} );

		return breakpoints;
	}

	subscribe( 'provide-response-parsers', function( e )
	{
		$.extend( e.parsers, response_parsers );
	} );

	subscribe( 'provide-tests', function()
	{
		function populateAttrs( prop, prefix, attrs )
		{
			for ( var i in attrs )
			{
				prop.attr( attrs[ i ], prefix + attrs[ i ] );
			}
			return prop;
		}

		function testAttrs( output, prefix, attrs )
		{
			for ( var i in attrs )
			{
				expect( output[ attrs[ i ] ] ).toBe( prefix + attrs[ i ] );
			}
		}

		describe( "BasicApi.Debugger - Parsers", function()
		{
			it( "parseContextGet", function()
			{
				var attrs = [
					'name',
					'type',
					'fullname',
					'address',
					'size',
					'is_recursive',
					'numchildren',
				];

				// Empty set of properties
				var jq_msg = $( '<root></root>' );
				var output = parseContextGet( jq_msg );

				expect( output instanceof Array ).toBe( true );
				expect( output.length ).toBe( 0 );

				// String
				jq_msg = $( '<root><property address="140736699922096" type="string"><![CDATA[vortex]]></property></root>' );
				output = response_parsers.eval( jq_msg );
				expect( output.message ).toBeUndefined();
				expect( typeof output.value ).toBe( 'object' );
				expect( output.value[ 0 ].value ).toBe( 'vortex' );
				expect( output.value[ 0 ].type ).toBe( 'string' );

				// Encoded string
				jq_msg = $( '<root><property address="140736699922096" encoding="base64" type="string"><![CDATA[dm9ydGV4]]></property></root>' );
				output = response_parsers.eval( jq_msg );
				expect( output.message ).toBeUndefined();
				expect( typeof output.value ).toBe( 'object' );
				expect( output.value[ 0 ].value ).toBe( 'vortex' );
				expect( output.value[ 0 ].type ).toBe( 'string' );

				// Array
				jq_msg = $( '<response><property address="140736699921712" type="array" children="1" numchildren="3" page="0" pagesize="128"><property name="0" address="139919608516592" type="int"><![CDATA[1]]></property><property name="1" address="139919608519464" type="string" size="3" encoding="base64"><![CDATA[YWJj]]></property><property name="2" address="139919608519720" type="array" children="0" numchildren="0" page="0" pagesize="128"></property></property></response>' );
				output = response_parsers.eval( jq_msg );
				expect( output.message ).toBeUndefined();
				expect( typeof output.value ).toBe( 'object' );
				expect( output.value[ 0 ].type ).toBe( 'array' );
				expect( output.value[ 0 ].numchildren ).toBe( 3 );
				expect( output.value[ 0 ].children[ 0 ].value ).toBe( 1 );
				expect( output.value[ 0 ].children[ 0 ].numchildren ).toBeUndefined();
				expect( output.value[ 0 ].children[ 1 ].value ).toBe( 'abc' );
				expect( output.value[ 0 ].children[ 1 ].numchildren ).toBeUndefined();
				expect( output.value[ 0 ].children[ 2 ].numchildren ).toBe( 0 );

				// Integer
				jq_msg = $( '<root><property address="140736699922096" type="int"><![CDATA[238752]]></property></root>' );
				output = response_parsers.eval( jq_msg );
				expect( output.message ).toBeUndefined();
				expect( typeof output.value ).toBe( 'object' );
				expect( output.value[ 0 ].value ).toBe( 238752 );
				expect( output.value[ 0 ].type ).toBe( 'int' );

				// Single, fully-populated property
				jq_msg = $( '<root></root>' ).append( populateAttrs( $( '<property>' ), 'xxx-test1-', attrs ) );
				output = parseContextGet( jq_msg );

				expect( output instanceof Array ).toBe( true );
				expect( output.length ).toBe( 1 );
				testAttrs( output[ 0 ], 'xxx-test1-', attrs );

				// Single, fully-populated property with superfluous attribute
				jq_msg = $( '<root></root>' ).append( populateAttrs( $( '<property superfluous="yes">' ), 'xxx-test2-', attrs ) );
				output = parseContextGet( jq_msg );

				expect( output instanceof Array ).toBe( true );
				expect( output[ 0 ].superfluous ).toBeUndefined();
				testAttrs( output[ 0 ], 'xxx-test2-', attrs );

				// Single, semi-populated property
				jq_msg = $( '<root></root>' ).append( $( '<property name="xxx-test3-name">' ) );
				output = parseContextGet( jq_msg );

				expect( output instanceof Array ).toBe( true );
				expect( output[ 0 ].name ).toBe( 'xxx-test3-name' );
				expect( output[ 0 ].fullname ).toBeUndefined();

				// Multiple fully-populated properties
				jq_msg = $( '<root></root>' )
					.append( populateAttrs( $( '<property>value_1</property>' ), 'xxx-test4a-', attrs ) )
					.append( populateAttrs( $( '<property>value_2</property>' ), 'xxx-test4b-', attrs ) )
					.append( populateAttrs( $( '<property>value_3</property>' ), 'xxx-test4c-', attrs ) );
				output = parseContextGet( jq_msg );

				expect( output instanceof Array ).toBe( true );
				testAttrs( output[ 0 ], 'xxx-test4a-', attrs );
				expect( output[ 0 ].value ).toBe( 'value_1' );
				testAttrs( output[ 1 ], 'xxx-test4b-', attrs );
				expect( output[ 1 ].value ).toBe( 'value_2' );
				testAttrs( output[ 2 ], 'xxx-test4c-', attrs );
				expect( output[ 2 ].value ).toBe( 'value_3' );
			} );

			it( "parseBreakpointAddRemove", function()
			{
				var jq_msg = $( '<root></root>' );
				var output = parseBreakpointAddRemove( jq_msg );

				expect( typeof output ).toBe( 'object' );
				expect( output.id ).toBeUndefined();

				jq_msg = $( '<root id="123abc"></root>' );
				output = parseBreakpointAddRemove( jq_msg );

				expect( typeof output ).toBe( 'object' );
				expect( output.id ).toBe( '123abc' );
			} );

			it( "parseBreakpoints", function()
			{
				function verifyOutputFormat( output, lengths )
				{
					expect( typeof output ).toBe( 'object' );
					for ( var i in bp_types )
					{
						expect( output[ bp_types[ i ] ] instanceof Array ).toBe( true );
						expect( output[ bp_types[ i ] ].length ).toBe( lengths[ bp_types[ i ] ] || lengths.def );
					}
				}
				var attrs = [
					'filename',
					'lineno',
					'state',
					'function',
					'temporary',
					'hit_count',
					'hit_value',
					'hit_condition',
					'exception',
					'expression',
					'id',
				];

				var bp_types = [
					'line',
					'call',
					'return',
					'exception',
					'conditional',
					'watch',
				];

				// Empty set
				var jq_msg = $( '<root></root>' );
				var output = parseBreakpoints( jq_msg );
				verifyOutputFormat( output, { def : 0 } );

				// Single bp
				jq_msg = $( '<root>' ).append(
					populateAttrs( $( '<breakpoint>' ), 'xxx-test2-', attrs ).attr( 'type', 'line' ) );
				output = parseBreakpoints( jq_msg );
				verifyOutputFormat( output, { def : 0, line : 1 } );
				var bp = output.line[ 0 ];
				testAttrs( bp, 'xxx-test2-', attrs );

				// Multiple bp
				jq_msg = $( '<root>' )
					.append( populateAttrs( $( '<breakpoint>' ), 'xxx-test3a-', attrs ).attr( 'type', 'line' ) )
					.append( populateAttrs( $( '<breakpoint>' ), 'xxx-test3b-', attrs ).attr( 'type', 'line' ) )
					.append( populateAttrs( $( '<breakpoint>' ), 'xxx-test3c-', attrs ).attr( 'type', 'call' ) );
				output = parseBreakpoints( jq_msg );
				verifyOutputFormat( output, { def : 0, line : 2, call : 1 } );
				testAttrs( output.line[ 0 ], 'xxx-test3a-', attrs );
				testAttrs( output.line[ 1 ], 'xxx-test3b-', attrs );
				testAttrs( output.call[ 0 ], 'xxx-test3c-', attrs );

				// Unrecognized bp type
				jq_msg = $( '<root>' )
					.append( populateAttrs( $( '<breakpoint>' ), 'xxx-test4-', attrs ).attr( 'type', 'xxx' ) );
				expect( function(){
					parseBreakpoints( jq_msg );
				} ).toThrow( new ParserError( 'Unknown breakpoint type xxx' ) );

				// One of each bp type
				jq_msg = $( '<root>' );
				bp_types.forEach( function( type )
				{
					jq_msg.append( populateAttrs( $( '<breakpoint>' ), 'xxx-test5-', attrs ).attr( 'type', type ) );
				} );
				output = parseBreakpoints( jq_msg );
				verifyOutputFormat( output, { def : 1 } );
			} );

			it( "parseContinuationCommand", function()
			{
				// Empty
				var jq_msg = $( '<root></root>' );
				var output = parseContinuationCommand( jq_msg );
				expect( output.is_continuation ).toBe( true );
				expect( output.status ).toBeUndefined();
				expect( output.reason ).toBeUndefined();
				expect( output.filename ).toBeUndefined();
				expect( output.lineno ).toBeUndefined();

				// reason & status, no filename or lineno
				var jq_msg = $( '<root status="xxx-status" reason="xxx-reason"></root>' );
				var output = parseContinuationCommand( jq_msg );
				expect( output.is_continuation ).toBe( true );
				expect( output.status ).toBe( 'xxx-status' );
				expect( output.reason ).toBe( 'xxx-reason' );
				expect( output.filename ).toBeUndefined();
				expect( output.lineno ).toBeUndefined();

				// filename & lineno, no reason or status
				var jq_msg = $( '<root><xdebug:message filename="xxx-fn" lineno="xxx-ln"></xdebug:message></response></root>' );
				var output = parseContinuationCommand( jq_msg );
				expect( output.is_continuation ).toBe( true );
				expect( output.status ).toBeUndefined();
				expect( output.reason ).toBeUndefined();
				expect( output.filename ).toBe( 'xxx-fn' );
				expect( output.lineno ).toBe( 'xxx-ln' );

				// filename & status, no lineno or reason
				var jq_msg = $( '<root status="xxx-status"><xdebug:message filename="xxx-fn" ></xdebug:message></response></root>' );
				var output = parseContinuationCommand( jq_msg );
				expect( output.is_continuation ).toBe( true );
				expect( output.status ).toBe( 'xxx-status' );
				expect( output.reason ).toBeUndefined();
				expect( output.filename ).toBe( 'xxx-fn' );
				expect( output.lineno ).toBeUndefined();

				// lineno and reason, no filename or status
				var jq_msg = $( '<root reason="xxx-reason"><xdebug:message lineno="xxx-ln" ></xdebug:message></response></root>' );
				var output = parseContinuationCommand( jq_msg );
				expect( output.is_continuation ).toBe( true );
				expect( output.status ).toBeUndefined();
				expect( output.reason ).toBe( 'xxx-reason' );
				expect( output.filename ).toBeUndefined();
				expect( output.lineno ).toBe( 'xxx-ln' );
			} );

			it( "parseEvalCommand", function()
			{
				// Empty
				var jq_msg = $( '<root></root>' );
				var output = response_parsers.eval( jq_msg );
				expect( output.message ).toBeUndefined();
				expect( typeof output.value ).toBe( 'object' );
			} );
		} );
	} );

	return {
		listAll     : function(){ return response_parsers; },
		ParserError : ParserError,
	};

}( jQuery ));
