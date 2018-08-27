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
	return filename.replace( /^.*\//, '' );
}

export default File;
