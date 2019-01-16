<?php

use Vortex\App;
use Vortex\Exceptions\DatabaseException;

/**
 * @brief
 *	Lazy initialize and/or retrieve a database connection
 *
 * @param string $connection OPTIONAL. The name of a database connection defined in settings
 *
 * @return PDO
 */
function db($connection = 'default')
{
    static $connections = [];

    if (empty($connections[ $connection ])) {
        if (!($filename = App::get('settings')->get("database.$connection"))) {
            throw new DatabaseException("The database '$connection' is not configured");
        }
        $connections[ $connection ] = new PDO("sqlite:$filename");
        $connections[ $connection ]->query('PRAGMA foreign_keys = ON');
    }

    return $connections[ $connection ];
}

/**
 * @brief
 *	Perform a query against the database and fetch an associative array of its results
 *
 * @param string $query
 * @param array  $params     OPTIONAL. An array of paramters to inject into the query
 * @param string $connection OPTIONAL. The DB connection to run the query on
 *
 * @return array
 */
function db_query($query, array $params = [], $connection = null)
{
    $connection = $connection ?: db();
    $stmt = $connection->prepare($query);
    if (!$stmt) {
        $err = $connection->errorInfo();
        throw new DatabaseException("Error $err[0]: $err[2]");
    }
    $stmt->execute($params);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}
