#!/usr/bin/python
# Will Groenendyk, 2017
# A simple socket server framework for DPOH. This socket server implements no real logic; instead,
# it defers to modules to define connections and do the interesting stuff

import os
import sys
from twisted.python   import log
from twisted.internet import reactor
from exceptions       import AttributeError

class PluginManager:
    """
    Register and call hooks on plugins
    """

    def __init__( self, current_dir ):
        """
        Check each enabled plugin for a 'ss_plugin.py' file, and execute each existing file
        """
        self._plugins = dict()
        self.plugins_marked_for_deletion = []
        for sd in os.listdir( current_dir + '/modules_enabled' ):
            plugin_file = current_dir + '/modules_enabled/' + sd + '/ss_plugin.py'
            if os.path.isfile( plugin_file ):
                execfile( plugin_file, { 'plugin_manager' : self, '__dir__' : current_dir } )

    def register( self, name, plugin_instance ):
        """
        Register a plugin for use in this socket server
        """
        self._plugins[ name ] = plugin_instance

    def unregister( self, name ):
        """
        Remove a plugin from the socket server.

        Depending on when this is called, it may or may not have an effect on which sockets are
        listened to, but regardless of when this is called, the plugin's hooks will no longer be
        called.
        """
        removed = self._plugins[ name ]
        del self._plugins[ name ]
        return removed

    def list( self ):
        """
        List all registered plugins
        """
        return self._plugins.copy()

    def callHook( self, hook_name, data_dict ):
        """
        Call a hook on each plugin that supports the hook; pass around data_dict to each
        implementation
        """
        for name in self.list():
            try:
                method = getattr( self._plugins[ name ], hook_name )
                if callable( method ):
                    method( data_dict )
            except AttributeError as e:
                pass

if __name__ == '__main__':
    log.startLogging(sys.stdout)
    plugin_manager = PluginManager( os.path.dirname( os.path.realpath( __file__ ) ) )

    # Allow plugins to perform initialization as necessary and optionally unregister other plugins
    plugin_manager.callHook( 'preboot', { 'plugin_manager' : plugin_manager } )

    # Allow plugins to perform additional initialization (don't unregister plugins at or after this
    # point unless absolutely necessary)
    plugin_manager.callHook( 'boot',    { 'plugin_manager' : plugin_manager } )

    # Request plugins to define the connections for this server
    data = { 'connections' : [] }
    plugin_manager.callHook( 'defineConnections', data )
    for conn in data['connections']:
        reactor.listenTCP( conn['port'], conn['factory'] )
    reactor.run()
