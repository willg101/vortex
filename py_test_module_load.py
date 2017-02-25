import os

plugins = []

def registerPlugin( item ):
    global plugins
    plugins.append( item )

for sd in os.listdir( 'modules_enabled' ):
    plugin_file = 'modules_enabled/' + sd + '/ws_plugin.py'
    print "checking for " + plugin_file
    if os.path.isfile( plugin_file ):
        execfile( plugin_file )
        print "\t loaded " + plugin_file

def callHook( name, data ):
    for obj in plugins:
        method = getattr( obj, name )
        if callable( method ):
            method( data )

data = { 'plugins' : plugins }
callHook( 'preboot', data )
callHook( 'boot',    data )

