<?php

namespace Vortex\Cli;

use Ratchet\ConnectionInterface;

/**
 * @brief
 *	Methods for handling key events related to adding/removing connections within a
 *	DbgpConnectionQueue
 */
interface DbgpConnectionQueueEventHandler
{
    /**
     * @brief
     *	Called when a connection is opened and is at the front of the queue
     *
     * @param ConnectionInterface $conn
     * @param string              $id
     */
    public function onNewConnectionFocused(ConnectionInterface $conn, $id);

    /**
     * @brief
     *	Called when a connection is opened and is NOT at the front of the queue
     *
     * @param ConnectionInterface $conn
     * @param string              $id
     */
    public function onNewConnectionQueued(ConnectionInterface $conn, $id);

    /**
     * @brief
     *	Called when a connection is opened but is not added to the queue because the queue is full
     *
     * @param ConnectionInterface $conn
     * @param string              $id
     */
    public function onNewConnectionDiscarded(ConnectionInterface $conn, $id);

    /**
     * @brief
     *	Called when a connection within the queue is moved to the front (without the connection
     *	previously at the front being discarded and/or closed)
     *
     * @param ConnectionInterface $conn
     * @param string              $id
     */
    public function onExistingConnectionFocused(ConnectionInterface $conn, $id);
}
