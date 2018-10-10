<?php

/**
 * @brief
 *	Determines if the client can access the given file/directory based on the current config (this
 *	does NOT take into account OS privileges)
 *
 * @param string $path
 *
 * @return bool
 */
function client_can_access_path( $path )
{
	// Resolve symlinks, '..', etc.
	$path = realpath( $path ) . '/';

	foreach ( settings( 'allowed_directories' ) as $allowed_dir )
	{
		// Prevent /a/b/cdef from matching the path /a/b/c
		if ( strpos( $path, $allowed_dir . '/' ) === 0 )
		{
			return TRUE;
		}
	}

	return FALSE;
}

/**
 * @brief
 *	Determines if the user is allowed the view the given file. This takes into account:
 *		- The config regarding which paths AND file extensions the client can access
 *		- Whether the given file is *actually* a file (it exists and is not a directory)
 *
 * @param string $file_name
 *
 * @return bool
 */
function client_can_view_file( $file_name )
{
	$file_name       = preg_replace( '#^.*?://#', '', $file_name );
	$extension_regex = implode( '|', array_map( 'preg_quote', settings( 'allowed_extensions' ) ) );

	return client_can_access_path( $file_name )
		&& is_file( $file_name )
		&& ( preg_match( "/\.($extension_regex)$/", $file_name )
			|| ( in_array( '', settings( 'allowed_extensions' ) )
				&& preg_match( '/^\./', basename( $file_name ) ) ) );
}

/**
 * @brief
 *	Aquires a lock for a write, and then writes a file
 *
 * @note
 *	Source: http://stackoverflow.com/questions/5695145
 *
 * @param string $file_name
 * @param string $data_to_save
 */
function file_put_contents_safe( $file_name, $data_to_save )
{
	if ( $fp = fopen( $file_name, 'w' ) )
	{
		$start_time = microtime( TRUE );
		do
		{
			$can_write = flock( $fp, LOCK_EX );
			// If lock not obtained sleep for 0 - 100 milliseconds, to avoid collision and CPU load
			if( !$can_write )
			{
				usleep( round( rand( 0, 100 ) * 1000 ) );
			}
		} while ( ( !$can_write ) and ( ( microtime( TRUE ) - $start_time ) < 5 ) );

		// File was locked so now we can store information
		if ( $can_write )
		{
			fwrite( $fp, $data_to_save );
			flock( $fp, LOCK_UN );
		}
		fclose( $fp );
	}
}

/**
 * @brief
 *	Recursively scans a directory for files with a given extension
 *
 * @param string $extenstion (OMIT the leading '.'; e.g., 'ini' for ini files, not '.ini')
 * @param string $dir
 * @param array  $dirs_seen       OPTIONAL. Should only be passed when calling this function
 *                                recursively
 *
 * @return array
 *	An array where each element is the absolute path of a file within $dir with the
 *	extension $extension
 */
function recursive_file_scan( $extension, $dir, &$dirs_seen = [] )
{
	// Account for symlink cycles
	$real_path = realpath( $dir );
	if ( isset( $dirs_seen[ $real_path ] ) )
	{
		return [];
	}
	else
	{
		$dirs_seen[ $real_path ] = TRUE;
	}

	$result            = [];
	$extension_escaped = preg_quote( $extension, '/' );

	foreach ( glob( "$dir/*" ) as $item )
	{
		if ( is_dir( $item ) )
		{
			$result = array_merge( $result, recursive_file_scan( $extension, $item, $dirs_seen ) );
		}
		else
		{
			if ( preg_match( "/\.$extension_escaped$/", $item ) )
			{
				$result[] = $item;
			}
		}
	}
	return $result;
}

/**
 * @brief
 *	Converts a path to a filename stripped of its extension
 */
function without_file_extension( $path )
{
	return preg_replace( '/\..*$/', '', basename( $path ) );
}
