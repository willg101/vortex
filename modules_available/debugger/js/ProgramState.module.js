var $ = jQuery;
var d = 10000
import File from './File.module.js';

/**
 * @brief
 *	A series of a stack frames received from the DE
 */
class Stack
{
	/**
	 * @param Array frame_array
	 */
	constructor( frame_array )
	{
		this.frames = ( frame_array || []).map( raw_frame =>
		{
			return {
				filename_full  : raw_frame.filename,
				lineno         : raw_frame.lineno,
				level          : raw_frame.level,
				filename_short : File.basename( raw_frame.filename ),
			};
		} );
	}

	get depth() {
		return this.frames.length;
	}
}

class ContextNode {
	constructor( parent, properties )
	{
		this.parent     = parent || null;
		this.properties = properties;

		if ( this.children )
		{
			this._constructChildNodes( this.children )
		}
	}

	_constructChildNodes( children )
	{
		this.properties.children = children.map( ( child ) =>
		{
			return new ContextNode( this, child );
		} );
	}

	_searchRecursivelyForValue( value_name )
	{
		if ( typeof this[ value_name ] != 'undefined' )
		{
			return this[ value_name ];
		}
		else
		{
			return this.parent
				? this.parent._searchRecursivelyForValue( value_name )
				: undefined;
		}
	}

	get name()        { return    this.properties.name;        }
	get value()       { return    this.properties.value;       }
	get fullname()    { return    this.properties.fullname;    }
	get type()        { return    this.properties.type;        }
	get address()     { return    this.properties.address;     }
	get hasChildren() { return !! this.properties.numchildren; }
	get size()        { return    this.properties.size;        }
	get children()    { return    this.properties.children;    }

	fetchChildren()
	{
		if ( !this.fetchingChildrenPromise )
		{
			if ( this.children )
			{
				this.fetchingChildrenPromise = new Promise( resolve => resolve( this.children ) )
			}
			if ( !this.hasChildren )
			{
				this.fetchingChildrenPromise = new Promise( resolve => resolve( null ) );
			}
			else
			{
				this.fetchingChildrenPromise = new Promise( async ( resolve ) =>
				{
					var children = await BasicApi.Debugger.command( 'property_get', {
						name        : this.fullname,
						stack_depth : this.stackDepth || 0,
						context     : this.cid || undefined,
					} );
					children = children.parsed[ 0 ].children;
					this._constructChildNodes( children );
					resolve( this.properties.children );
				} );
			}
		}
		return this.fetchingChildrenPromise;
	}

	get cid()        { return this._searchRecursivelyForValue( '_cid' ); }
	get stackDepth() { return this._searchRecursivelyForValue( '_stackDepth' ); }

	get isReadOnly() { return false; }
}

class ContextRoot extends ContextNode
{
	constructor( name, cid, children, stackDepth )
	{
		children = children || [];
		super( false, { name, children, numchildren : children.length } );
		this._cid        = cid;
		this._stackDepth = stackDepth;
	}

	get value()    { return this.name; }
	get fullname() { return this.name; }
	get type()     { return this.name; }

	get isReadOnly() { return true; }
}

/**
 * The state of a program at a certain instance in time
 */
class ProgramState {
	constructor()
	{
		this._getStack()
			.then( this._getContexts.bind( this ) )
			.then( () => { publish( 'program-state-changed', { program_state : this } ); } );
	}

	async _getStack()
	{
		var response = await BasicApi.Debugger.command( 'stack_get' );
		this.stack   = new Stack( response.parsed );
	}

	async _getContexts()
	{
		var response = await BasicApi.Debugger.command( 'context_names', {
			stack_depth : this.stack.depth,
		} );
		var contexts = [];
		var context_descriptor = null;
		for ( var i = 0; i < response.parsed.length; i++ )
		{
			context_descriptor = response.parsed[ i ];
			var context_items = await BasicApi.Debugger.command( 'context_get', {
				context     : context_descriptor.id,
				stack_depth : 0,
			} );
			contexts.push( new ContextRoot( context_descriptor.name,
				context_descriptor.id, context_items.parsed, 0 ) );
		}
		this.contexts = contexts;
	}

	_getFile()
	{
	}
}

subscribe( 'response-received', e => {
	if ( e.parsed.is_continuation && !e.parsed.is_stopping )
	{
		new ProgramState;
	}
} );


subscribe( 'provide-tests', function()
{
	describe( "ProgramState", function()
	{
		it( "Stack", function()
		{
			var s1 = new Stack( [] );
			expect( s1.depth ).toBe( 0 );

			var s2 = new Stack( [ { level : 0, type : 'file', filename : '/a/b/c', lineno: 123 } ] );
			expect( s2.depth ).toBe( 1 );
			expect( typeof s2.frames ).toBe( 'object' );
			expect( s2.frames instanceof Array ).toBe( true );
			var frame = s2.frames[ 0 ];
			expect( frame.level ).toBe( 0 );
			expect( frame.filename_full ).toBe( '/a/b/c' );
			expect( frame.filename_short ).toBe( File.basename( '/a/b/c' ) );
			expect( frame.lineno ).toBe( 123 );

			var s3 = new Stack( [
				{ level : 0, type : 'file', filename : '/aaa/bbb/ccc/ddd/eee', lineno: 123 },
				{ level : 1, type : 'file', filename : '/aaa/baaa',            lineno: 12  },
				{ level : 2, type : 'file', filename : '/aaaa',                lineno: 1   },
			] );
			expect( s3.depth ).toBe( 3 );
			expect( typeof s3.frames ).toBe( 'object' );
			expect( s3.frames instanceof Array ).toBe( true );
			frame = s3.frames[ 0 ];
			expect( frame.level ).toBe( 0 );
			expect( frame.filename_full ).toBe( '/aaa/bbb/ccc/ddd/eee' );
			expect( frame.filename_short ).toBe( File.basename( '/aaa/bbb/ccc/ddd/eee' ) );
			expect( frame.lineno ).toBe( 123 );
			frame = s3.frames[ 1 ];
			expect( frame.level ).toBe( 1 );
			expect( frame.filename_full ).toBe( '/aaa/baaa' );
			expect( frame.filename_short ).toBe( File.basename( '/aaa/baaa' ) );
			expect( frame.lineno ).toBe( 12 );
			frame = s3.frames[ 2 ];
			expect( frame.level ).toBe( 2 );
			expect( frame.filename_full ).toBe( '/aaaa' );
			expect( frame.filename_short ).toBe( File.basename( '/aaaa' ) );
			expect( frame.lineno ).toBe( 1 );
		} );

		it( "ContextNode", function()
		{
			var n1 = new ContextNode( false, {
				name        : '$lorem',
				value       : 'null',
				fullname    : '$lorem',
				type        : 'null',
				address     : '0x12346',
				numchildren : 0,
				size        : 0,
				children    : undefined,
			} );
			expect( n1.parent ).toBe( null );
			expect( n1.cid ).toBeUndefined();
			expect( n1.stackDepth ).toBeUndefined();
			expect( n1.name ).toBe( '$lorem' );
			expect( n1.fullname ).toBe( '$lorem' );
			expect( n1.value ).toBe( 'null' );
			expect( n1.size ).toBe( 0 );
			expect( n1.type ).toBe( 'null' );
			expect( n1.hasChildren ).toBe( false );
			expect( n1.isReadOnly ).toBe( false );

			var n2 = new ContextNode( false, {
				name        : '$lorem',
				value       : undefined,
				fullname    : '$lorem',
				type        : 'array',
				address     : '0x12346',
				numchildren : 1,
				size        : 6,
				children    :
				[ {
					name        : '"ipsum"',
					value       : 'hello',
					fullname    : '$lorem["ipsum"]',
					type        : 'string',
					address     : '0x123',
					numchildren : 0,
					size        : 6,
					children    : undefined,
				} ],
			} );
			expect( n2.parent ).toBe( null );
			expect( n2.cid ).toBeUndefined();
			expect( n2.stackDepth ).toBeUndefined();
			expect( n2.name ).toBe( '$lorem' );
			expect( n2.fullname ).toBe( '$lorem' );
			expect( n2.value ).toBeUndefined()
			expect( n2.size ).toBe( 6 );
			expect( n2.type ).toBe( 'array' );
			expect( n2.hasChildren ).toBe( true );
			expect( n2.isReadOnly ).toBe( false );
			var child = n2.children[ 0 ];
			expect( child.parent ).toBe( n2 );
			expect( child.cid ).toBeUndefined();
			expect( child.stackDepth ).toBeUndefined();
			expect( child.name ).toBe( '"ipsum"' );
			expect( child.fullname ).toBe( '$lorem["ipsum"]' );
			expect( child.value ).toBe( 'hello' )
			expect( child.size ).toBe( 6 );
			expect( child.type ).toBe( 'string' );
			expect( child.hasChildren ).toBe( false );
			expect( child.isReadOnly ).toBe( false );

			n2._cid        = 1;
			n2._stackDepth = 3;
			expect( n2.cid ).toBe( 1 );
			expect( child.cid ).toBe( 1 );
			expect( n2.stackDepth ).toBe( 3 );
			expect( child.stackDepth ).toBe( 3 );
		} );

		it( "ContextRoot", function()
		{
			var n1 = new ContextRoot( 'name', 123, [], 4 )
			expect( n1.parent ).toBe( null );
			expect( n1.cid ).toBe( 123 );
			expect( n1.stackDepth ).toBe( 4 );
			expect( n1.name ).toBe( 'name' );
			expect( n1.fullname ).toBe( 'name' );
			expect( n1.value ).toBe( 'name' );
			expect( n1.size ).toBeUndefined();
			expect( n1.type ).toBe( 'name' );
			expect( n1.hasChildren ).toBe( false );
			expect( n1.isReadOnly ).toBe( true );

			var n2 = new ContextRoot( 'name', 123, [ {
					name        : '"ipsum"',
					value       : 'hello',
					fullname    : '$lorem["ipsum"]',
					type        : 'string',
					address     : '0x123',
					numchildren : 0,
					size        : 6,
					children    : undefined,
				} ], 4 );
			expect( n2.parent ).toBe( null );
			expect( n2.cid ).toBe( 123 );
			expect( n2.stackDepth ).toBe( 4 );
			expect( n2.name ).toBe( 'name' );
			expect( n2.fullname ).toBe( 'name' );
			expect( n2.value ).toBe( 'name' );
			expect( n2.size ).toBeUndefined();
			expect( n2.type ).toBe( 'name' );
			expect( n2.hasChildren ).toBe( true );
			expect( n2.isReadOnly ).toBe( true );
		} );
	} );
} );
