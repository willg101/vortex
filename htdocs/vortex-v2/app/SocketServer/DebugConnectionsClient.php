<?php

namespace App\SocketServer;

use Thruway\Peer\Client;
use Log;
use RuntimeException;
use Thruway\WampErrorException;
use React\EventLoop\LoopInterface;
use React\Promise\Deferred;

class DebugConnectionsClient extends Client
{
    protected $dbgp;
    protected $session;
    protected $wamp_dbgp_pairs;
    protected $active_wamp_sessions;

    /**
     * Constructor
     *
     * @param string $realm
     * @param \React\EventLoop\LoopInterface $loop
     */
    public function __construct(DbgpApp $dbgp, $realm, LoopInterface $loop = null)
    {
        parent::__construct($realm, $loop);
        $this->dbgp = $dbgp;
        $this->dbgp->setChangeHandler([$this, 'onConnectionsChanged']);
        $this->dbgp->setNotificationHandler([$this, 'onNotificationReceived']);
    }

    public function onNotificationReceived($cid, $msg)
    {
        $this->session->publish('vortex.debug-connection.notifications.' . $cid, [], $msg);
    }

    public function onConnectionsChanged($description)
    {
        $this->session->publish('vortex.debug_connections.change', [], $this->listConnections($description));
    }

    public function listConnections($description = ['status' => 'list'])
    {
        $out = $this->dbgp->listConnections();
        foreach ($out as $cid => &$info) {
            $info['wamp_session'] = $this->wamp_dbgp_pairs['dbgp'][$cid] ?? null;
        }
        return ['description' => $description, 'connections' => $out];
    }

    public function handleCallList()
    {
        return $this->listConnections();
    }

    public function updatingPairing(string $dbgp_cid, string $wamp_cid)
    {
        if (empty($this->active_wamp_sessions[$wamp_cid] ?? null)) {
            throw new WampErrorException('Invalid wamp session id received: ' . $wamp_cid);
        } elseif (!$this->dbgp->getConn($dbgp_cid)) {
            throw new WampErrorException('Invalid dbgp connection id received: ' . $dbgp_cid);
        } elseif ($this->wamp_dbgp_pairs['wamp'][$wamp_cid] ?? null !== $dbgp_cid
            || $this->wamp_dbgp_pairs['dbgp'][$dbgp_cid] ?? null !== $wamp_cid ) {
            $this->breakPairing('wamp', $wamp_cid, false);
            $this->wamp_dbgp_pairs['wamp'][$wamp_cid] = $dbgp_cid;
            $this->wamp_dbgp_pairs['dbgp'][$dbgp_cid] = $wamp_cid;
            $this->onConnectionsChanged('pairing_changed');
        }
    }

    public function pairWampWithDbgp($args, $kwargs)
    {
        if (empty($kwargs->wamp_cid)) {
            throw new WampErrorException('Missing kwargs[wamp_cid]');
        } elseif (empty($kwargs->dbgp_cid)) {
            throw new WampErrorException('Missing kwargs[dbgp_cid]');
        }
        $this->updatingPairing($kwargs->dbgp_cid, $kwargs->wamp_cid);
        return ['success' => true];
    }

    public function breakPairing(string $cid_type, string $cid, $notify = true)
    {
        if ($cid_type !== 'wamp' && $cid_type !== 'dbgp') {
            throw new RuntimeException('Invalid cid_type received: ' . $cid_type);
        } 
        $other_type = $cid_type == 'wamp' ? 'dbgp' : 'wamp';
        $other_cid = $this->wamp_dbgp_pairs[$cid_type][$cid] ?? null;
        if ($other_cid !== null) {
            unset($this->wamp_dbgp_pairs[$cid_type][$cid]);
            unset($this->wamp_dbgp_pairs[$other_type][$other_cid]);
            if ($notify) {
                $this->onConnectionsChanged('pairing_changed');
            }
        }
    }

    public function onWampSessionJoin($args, $kwargs)
    {
        $cid = $args[0]->session;
        $this->active_wamp_sessions[$cid] = $cid;
    }

    public function onWampSessionLeave($args, $kwargs)
    {
        $cid = $args[0]->session;
        unset($this->active_wamp_sessions[$cid]);
        $this->breakPairing('wamp', $cid);
    }

    public function handleListRecentFiles($args, $kwargs)
    {
        if (empty($kwargs->dbgp_cid)) {
            throw new WampErrorException('Missing dbgp_cid param');
        } elseif (!($dbgp_conn = $this->dbgp->getConn($kwargs->dbgp_cid))) {
            throw new WampErrorException('Invalid dbgp_cid param: ' . $kwargs->dbgp_cid);
        }

        $deferred = new Deferred;

        app(PhpAbstractions::class)->getRecentFiles(
            $params['max_files'] ?? null,
            $dbgp_conn->codebase_root,
            $params['excluded_dirs'] ?? null,
            $dbgp_conn,
            function ($data) use ($deferred) { $deferred->resolve($data); }
        );

        return $deferred->promise();
    }

    /**
     * @param \Thruway\ClientSession $session
     * @param \Thruway\Transport\TransportInterface $transport
     */
    public function onSessionStart($session, $transport)
    {
        $session->register('vortex.debug_connections.list', [$this, 'handleCallList']);
        
        $session->subscribe('wamp.metaevent.session.on_join',  [$this, 'onWampSessionJoin']);
        $session->subscribe('wamp.metaevent.session.on_leave',  [$this, 'onWampSessionLeave']);

        $session->register('vortex.debug_connection.pair', [$this, 'pairWampWithDbgp']);
        $session->register('vortex.debug_connection.list_recent_files', [$this, 'handleListRecentFiles']);
//        $session->register('vortex.debug-connection.list-recent-files', [$this, 'listRecentFiles']);
    }
}
