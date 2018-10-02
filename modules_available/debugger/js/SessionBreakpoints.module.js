import File     from './File.module.js'
import Debugger from './Debugger.module.js'
import QueuedSessionsIndicator  from './QueuedSessionsIndicator.module.js'

class Breakpoint
{
	constructor( file, line, expression, id, codebase )
	{
		this.info = { file, line, expression, id, codebase };
		this.info.state = id ? 'confirmed' : 'offline';
		this.triggerStateChange();
		this.sendToDebugger();
	}

	get id()         { return this.info.id;         }
	get expression() { return this.info.expression; }
	get file()       { return this.info.file;       }
	get line()       { return this.info.line;       }
	get state()      { return this.info.state;      }
	get type()       { return this.expression ? 'conditional' : 'line' }

	triggerStateChange()
	{
		publish( 'breakpoint-state-change', { breakpoint : this } );
	}

	async sendToDebugger()
	{
		if ( !Debugger.sessionIsActive() || this.state == 'confirmed' )
		{
			return;
		}

		var cb = await QueuedSessionsIndicator.getCurrentCodebase();

		this.info.state = 'pending';
		this.triggerStateChange();

		if ( !cb.id || !this.info.codebase || this.info.codebase.id == cb.id )
		{
			let file = this.info.codebase
				? this.file.replace( File.stripScheme( this.info.codebase.root ), File.stripScheme( cb.root ) )
				: this.file;
			var data = await Debugger.command( 'breakpoint_set', {
				type : this.type,
				line : this.line,
				file,
			}, this.expression );
			this.info.id = data.parsed.id;

			this.info.state = 'confirmed'
			this.triggerStateChange();
		}
	}

	async removeFromDebugger()
	{
		if ( Debugger.sessionIsActive() && this.state != 'removed' )
		{
			this.info.state = 'pending';
			this.triggerStateChange();

			await Debugger.command( 'breakpoint_remove', { breakpoint : this.id } );
		}

		this.info.state = 'removed'
		this.triggerStateChange();
	}

	goOffline()
	{
		delete this.info.id;
		this.info.state = 'offline';
		this.triggerStateChange();
	}
}

class SessionBreakpoints
{
	constructor()
	{
		this.allBreakpoints      = {};
		this.codebaseBreakpoints = {};
		subscribe( 'session-status-changed', ( e ) =>
		{
			if ( e.status == 'active' )
			{
				this.importFromDebuggerEngine()
			}
			else
			{
				this.apply( bp => bp.goOffline() );
			}
		} );
	}

	listForFile( filename, id, cb_root )
	{
		if ( Debugger.sessionIsActive() && id && cb_root )
		{
			filename = File.stripScheme( filename ).replace( File.stripScheme( cb_root ), '' ).replace( /^\/+/, '' );
			if ( this.codebaseBreakpoints[ id ] && this.codebaseBreakpoints[ id ][ filename ] )
			{
				return this.codebaseBreakpoints[ id ][ filename ];
			}
		}

		return this.allBreakpoints[ filename ] || [];
	}

	apply( func )
	{
		for ( let file in this.allBreakpoints )
		{
			for ( let line in this.allBreakpoints[ file ] )
			{
				func( this.allBreakpoints[ file ][ line ] );
			}
		}
	}

	clearAll()
	{
		this.apply( breakpoint => this.del( breakpoint.file, breakpoint.line ) );
	}

	async importFromDebuggerEngine()
	{
		var breakpoints = await Debugger.command( 'breakpoint_list' );
		var importEach = bp =>
		{
			var filename = File.stripScheme( bp.filename );
			this.allBreakpoints[ filename ] = this.allBreakpoints[ filename ] || {};
			if ( this.allBreakpoints[ filename ][ bp.lineno ] )
			{
				this.allBreakpoints[ filename ][ bp.lineno ].info.state = 'confirmed';
				this.allBreakpoints[ filename ][ bp.lineno ].info.id    = bp.id;
			}
			else
			{
				this.allBreakpoints[ filename ][ bp.lineno ] = new Breakpoint( filename, bp.lineno,
					bp.expression || bp.expression_element, bp.id );
			}
			this.allBreakpoints[ filename ][ bp.lineno ].triggerStateChange();
		};
		breakpoints.parsed.line.forEach( importEach );
		breakpoints.parsed.conditional.forEach( importEach );

		this.apply( bp => bp.sendToDebugger() );
	}

	toggle( file, line, expression, codebase )
	{
		if ( this.allBreakpoints[ file ] && this.allBreakpoints[ file ][ line ] )
		{
			this.del( file, line );
		}
		else
		{
			this.create( file, line, expression, codebase );
		}
	}

	del( file, line )
	{
		if ( ! this.allBreakpoints[ file ] || ! this.allBreakpoints[ file ][ line ] )
		{
			return;
		}
		this.allBreakpoints[ file ][ line ].removeFromDebugger();
		delete this.allBreakpoints[ file ][ line ];
	}

	create( file, line, expression, codebase )
	{
		if ( !this.allBreakpoints[ file ] )
		{
			this.allBreakpoints[ file ] = {};
		}
		if ( !this.allBreakpoints[ file ][ line ] )
		{
			this.allBreakpoints[ file ][ line ] = new Breakpoint( file, line, expression, undefined, codebase );
		}

		if ( codebase && codebase.id && codebase.root )
		{
			let rel_file = File.stripScheme( file )
				.replace( File.stripScheme( codebase.root ), '' )
				.replace( /^\/+/, '' );
			if ( !this.codebaseBreakpoints[ codebase.id ] )
			{
				this.codebaseBreakpoints[ codebase.id ] = {};
			}
			if ( !this.codebaseBreakpoints[ codebase.id ][ rel_file ] )
			{
				this.codebaseBreakpoints[ codebase.id ][ rel_file ] = {};
			}
			if ( !this.codebaseBreakpoints[ codebase.id ][ rel_file ][ line ] )
			{
				this.codebaseBreakpoints[ codebase.id ][ rel_file ][ line ]
					= this.allBreakpoints[ file ][ line ];
			}
		}
	}

	get( file, line )
	{
		return this.allBreakpoints[ file ] && this.allBreakpoints[ file ][ line ] || null;
	}
}

var sessionBreakpoints = new SessionBreakpoints;

export default sessionBreakpoints;
