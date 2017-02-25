
from autobahn.twisted.websocket import WebSocketServerProtocol, \
    WebSocketServerFactory
from twisted.internet.protocol import Factory, Protocol
import os
import sys

from twisted.python import log
from twisted.internet import reactor

from exceptions import AttributeError

class PluginManager:

    def __init__( self, cwd ):
        self._plugins = []
        for sd in os.listdir( cwd + '/modules_enabled' ):
            plugin_file = cwd + '/modules_enabled/' + sd + '/ss_plugin.py'
            print "checking for " + plugin_file
            if os.path.isfile( plugin_file ):
                execfile( plugin_file, { 'plugin_manager' : self, '__dir__' : cwd } )

    def register( self, plugin ):
        self._plugins.append( plugin )

    def callHook( self, name, data ):
        for obj in self._plugins:
            try:
                method = getattr( obj, name )
                if callable( method ):
                    method( data )
            except AttributeError as e:
                pass

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
