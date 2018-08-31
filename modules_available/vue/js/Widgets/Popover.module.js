export default Popover;

var $ = jQuery;

vTheme.Popover = Popover;

var template_name    = 'vue.popover';
var popover_selector = '.vue-popover';

function Popover( content, classes, position, toggle_button, delay_show )
{
	this.content       = content || '';
	this.classes       = classes || [];
	this.toggle_button = toggle_button;
	this.position      = $.extend( { my : 'right top', at : 'right bottom', collision : 'none none' }, position || {} );
	if ( toggle_button )
	{
		toggle_button.data( 'toggles_popover', this );
	}
	if ( !delay_show )
	{
		this.show();
	}
}

Popover.prototype.show = function()
{
	if ( !this.el )
	{
		this.el = $( this.render() ).data( 'popover_instance', this );
		this.el.appendTo( 'body' );
		if ( this.position.of )
		{
			this.el.css( 'min-width', $( this.position.of ).outerWidth() + 'px' );
		}
		this.reposition();

		var that = this;
		setTimeout( function()
		{
			that.el.addClass( 'removable' );
		}, 50 );
	}
}

Popover.prototype.reposition = function()
{
	if ( this.el )
	{
		this.el.position( this.position );
	}
}

Popover.prototype.render = function()
{
	return render( template_name, { classes : this.classes.join( ' ' ), content : this.content } );
}

Popover.prototype.setContent = function( new_content )
{
	if ( this.el )
	{
		this.el.html( new_content );
		this.reposition();
	}
	this.content = new_content;
}

Popover.prototype.remove = function()
{
	if ( !this.el.is( '.removable' ) )
	{
		return;
	}

	publish( 'popover:remove', { popover : this } );
	this.el.remove();
	this.toggle_button.data( 'toggles_popover', null );
	delete this.el;
	$( popover_selector ).each( function()
	{
		$( this ).data( 'popover_instance' ).reposition();
	} );
}

$( document ).on( 'click', function( e )
{
	$( popover_selector ).each( function()
		{
			var self = $( this );
			if ( !$( e.target ).closest( self ).length || $( e.target ).closest( '.close-popover-on-click' ).length )
			{
				self.data( 'popover_instance' ).remove();
			}
		} );
} );
