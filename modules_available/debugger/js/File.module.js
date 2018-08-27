var $ = jQuery;

class File
{
	
}

/**
 * @param string filename
 * @retval string
 */
File.basename = function( filename )
{
	filename = filename || '';
	return filename.replace( /^.*\//, '' );
}

/**
 * @param string filename
 * @retval string
 */
File.stripScheme = function( filename )
{
	filename = filename || '';
	return filename.replace( /^file:\/\//, '' ).replace( /\/{2,}/, '/' );
}

/**
 * @param int size
 * @retval string
 */
File.bytesToHumanReadable = function( size )
{
	if ( size == 0 )
	{
		return '0 B';
	}
	var i = Math.floor( Math.log( size ) / Math.log(1024) );
	return ( size / Math.pow( 1024, i) ).toFixed (2 ) * 1 + ' ' + [ 'B', 'kB', 'MB', 'GB', 'TB' ][ i ];
}

export default File;
