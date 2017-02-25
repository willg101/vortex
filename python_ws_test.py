
from autobahn.twisted.websocket import WebSocketServerProtocol, \
    WebSocketServerFactory
from twisted.internet.protocol import Factory, Protocol
import os
import sys

from twisted.python import log
from twisted.internet import reactor

from python.DpohWsProtocol import DpohWsProtocol
from python.DbgpServerProtocol import DbgpServerProtocol, DbgpServerProtocolFactory
from python.Bridge import Bridge
from python.PluginManager import PluginManager


if __name__ == '__main__':
    log.startLogging(sys.stdout)

    plugin_manager = PluginManager( os.path.dirname( os.path.realpath( __file__ ) ) )
    bridge = Bridge()
    dbg_factory = DbgpServerProtocolFactory()
    dbg_factory.dpoh_bridge = bridge
    dbg_factory.dpoh_plugin_manager = plugin_manager

    ws_factory = WebSocketServerFactory( u"ws://127.0.0.1:3001/bridge" )
    ws_factory.protocol = DpohWsProtocol
    ws_factory.dpoh_bridge = bridge
    ws_factory.dpoh_plugin_manager = plugin_manager
    # factory.setProtocolOptions(maxConnections=2)

    reactor.listenTCP(9000, dbg_factory)
    reactor.listenTCP(3001, ws_factory)
    reactor.run()

