from exceptions import AttributeError
import os

class PluginManager:

    def __init__( self, cwd ):
        self._plugins = []
        for sd in os.listdir( cwd + '/modules_enabled' ):
            plugin_file = cwd + '/modules_enabled/' + sd + '/ws_plugin.py'
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
