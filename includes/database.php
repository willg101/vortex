<?php

class DatabaseException extends Exception {}

function db( $connection = 'default' )
{
	static $connections = [];

	if ( empty( $connections[ $connection ] ) )
	{
		if ( !( $filename = settings( "database.$connection" ) ) )
		{
			throw new DatabaseException( "The database '$connection' is not configured" );
		}
		$connections[ $connection ] = new PDO( "sqlite:$filename" );
		$connections[ $connection ]->query( 'PRAGMA foreign_keys = ON' );
	}

	return $connections[ $connection ];
}

function db_query( $query, array $params = [], $connection = NULL )
{
	$connection = $connection ?: db();
	$stmt = $connection->prepare( $query );
	if ( !$stmt )
	{
		$err = $connection->errorInfo();
		throw new DatabaseException( "Error $err[0]: $err[2]" );
	}
	$stmt->execute( $params );
	return $stmt->fetchAll( PDO::FETCH_ASSOC );
}
