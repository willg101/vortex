
from autobahn.twisted.websocket import WebSocketServerProtocol, \
    WebSocketServerFactory
from twisted.internet.protocol import Factory, Protocol
import os
import sys

from twisted.python import log
from twisted.internet import reactor

from python.PluginManager import PluginManager


if __name__ == '__main__':
    log.startLogging(sys.stdout)
    plugin_manager = PluginManager( os.path.dirname( os.path.realpath( __file__ ) ) )

    plugin_manager.callHook( 'preboot', { 'plugin_manager' : plugin_manager } )
    plugin_manager.callHook( 'boot',    { 'plugin_manager' : plugin_manager } )

    data = { 'connections' : [] }
    plugin_manager.callHook( 'defineConnections', data )
    for conn in data['connections']:
        reactor.listenTCP( conn['port'], conn['factory'] )
    reactor.run()
