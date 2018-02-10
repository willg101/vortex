// This trivial wrapper around toastr allows other themes to use their own notification system
namespace( 'Theme' ).notify = function( level, msg, title, options )
{
	return toastr[ level ]( msg, title, options );
}
