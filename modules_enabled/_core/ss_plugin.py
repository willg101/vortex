from autobahn.twisted.websocket import WebSocketServerFactory, WebSocketServerProtocol
from twisted.internet.protocol  import Factory, Protocol
import glob
import argparse

class Bridge:

    def __init__( self ):
        self._dbgConnection = None
        self._wsConnection  = None

    def hasWsConnection( self ):
        return self._wsConnection is not None

    def setWsConnection( self, conn ):
        self._wsConnection = conn

    def clearWsConnection( self, conn ):
        if self.hasWsConnection() and conn is None or self._wsConnection == conn:
            self._wsConnection = None

    def hasDbgConnection( self ):
        return self._dbgConnection is not None

    def setDbgConnection( self, conn ):
        self._dbgConnection = conn

    def clearDbgConnection( self, conn ):
        if self.hasDbgConnection() and conn is None or self._dbgConnection == conn:
            self._dbgConnection = None

    def sendToWs( self, data ):
        if self.hasWsConnection():
            data = str( len( data ) ) + '\0' + data + '\0'
            self._wsConnection.sendMessage( data )

    def sendToDbg( self, data ):
        if self.hasWsConnection():
            self._dbgConnection.transport.write( data )
   

class DbgpServerProtocol(Protocol):

    def __init__( self, bridge, plugin_manager ):
        self.connected_to_client = False
        self._bridge = bridge
        self._pluginManager = plugin_manager

    def connectionMade(self):
        print("Debug Client connecting:")
        if self._bridge.hasWsConnection():
            if self._bridge.hasDbgConnection():
                print( 'We already have an active debugger client; detaching' )
                self.transport.loseConnection()
                return
            self._bridge.setDbgConnection( self )
            print("We have a websocket client and a debug client")
            data = {
                'connection' : self,
            }
            self._pluginManager.callHook( 'onDbgOpen', data )
            self.connected_to_client = True;
        else:
            print("No websocket client, detching...")
            #self.transport.write( "detach -i 0\0" );
            self.transport.loseConnection()

    def connectionLost(self, reason):
        if self.connected_to_client:
            data = {
                'connection' : self,
                'reason'     : reason,
            }
            self._pluginManager.callHook( 'onDbgClose', data )
            self._bridge.clearDbgConnection( self )
            print("Removing callback bridge...")
            if self._bridge.hasWsConnection():
                print("Informing websocket client of disconnection");
                self.sendMessageToWebsocket( '<wsserver status="session_end"></wsserver>' )

    def sendMessageToWebsocket(self, message):
        self._bridge.sendToWs( message )

    def dataReceived(self, data):
        if self._bridge.hasWsConnection():
            try:
                root = ET.fromstring(data.split( "\0" )[1])
                if root.attrib['fileuri']:
                    with open( root.attrib['fileuri'].replace( 'file://', '') , 'r' ) as f:
                        first_line = f.readline();
                        if first_line.startswith( '<?php /* dpoh: ignore */' ):
                            print("File is marked to be ignored, deatching...")
                            self.transport.write( "detach -i 0\0" );
                            self.transport.loseConnection()
                            return
            except Exception as e:
                pass
            print data;
            hook_data = {
                'connection' : self,
                'message'    : data,
                'do_send'    : True,
                'bridge'     : self._bridge,
            }
            self._pluginManager.callHook( 'onDbgMessage', hook_data )
            if hook_data[ 'do_send' ] and hook_data[ 'message' ] and self._bridge.hasWsConnection():
                self._bridge.sendToWs( hook_data[ 'message' ] )
        else:
            self.transport.write( "detach -i 0\0" );
            self.transport.loseConnection()

class DbgpServerProtocolFactory(Factory):

    def buildProtocol(self, addr):
        return DbgpServerProtocol( self.dpoh_bridge, self.dpoh_plugin_manager )


class DpohWsProtocol(WebSocketServerProtocol):

    def onConnect(self, request):
        self._bridge = self.factory.dpoh_bridge
        self._pluginManager = self.factory.dpoh_plugin_manager
        data = {
            'request'    : request,
            'connection' : self,
        }
        self._pluginManager.callHook( 'onWsConnect', data )

    def onOpen(self):
        data = {
            'bridge'     : self._bridge,
            'connection' : self,
        }
        self._pluginManager.callHook( 'onWsOpen', data )
        if not self._bridge.hasWsConnection():
            self._bridge.setWsConnection( self )
        else:
            self.transport.loseConnection()

    def onMessage(self, payload, isBinary):
        if isBinary:
            print("Binary message received: {0} bytes".format(len(payload)))
        else:
            print("Text message received: {0}".format(payload.decode('utf8')))
            data = {
                'message'    : payload,
                'connection' : self,
                'bridge'     : self._bridge,
                'do_send'    : True,
            }
            self._pluginManager.callHook( 'onWsMessage', data )
            if data[ 'do_send' ] and data[ 'message' ] and self._bridge.hasDbgConnection():
                self._bridge.sendToDbg( payload + '\0' )

    def onClose(self, wasClean, code, reason):
        print("WebSocket connection closed: {0}".format(reason))
        data = {
            'connection' : self,
            'was_clean'  : wasClean,
            'code'       : code,
            'reason'     : reason,
        }
        self._pluginManager.callHook( 'onWsClose', data )
        self._bridge.clearWsConnection( self )

class CorePlugin:
        def __init__( self, plugin_manager ):
            print( "Init core plugin" )
            self.plugin_manager = plugin_manager

        def defineConnections( self, data ):
            bridge = Bridge()

            dbg_factory = DbgpServerProtocolFactory()
            dbg_factory.dpoh_bridge = bridge
            dbg_factory.dpoh_plugin_manager = self.plugin_manager
            data['connections'].append( { 'port' : 9000, 'factory' : dbg_factory } )

            ws_factory = WebSocketServerFactory( u"ws://127.0.0.1:3001/bridge" )
            ws_factory.protocol = DpohWsProtocol
            ws_factory.dpoh_bridge = bridge
            ws_factory.dpoh_plugin_manager = plugin_manager
            data['connections'].append( { 'port' : 3001, 'factory' : ws_factory } )

        def onWsMessage( self, data ):
            if data['message'].startswith( 'X_glob ' ):
                print( "caught glob request" )
                args_raw = data['message'][7:]
                data['message'] = ''
                parser = argparse.ArgumentParser()
                parser.add_argument( '-i', dest='id' )
                parser.add_argument( '-p', dest='pattern', default='/', type=str )
                args, unknown = parser.parse_known_args( args_raw.split() )
                print(args)
                results = glob.glob( args.pattern + '*' )
                print( results )
                response = results[0] if len( results ) == 1 else self.findPartialGlob( results )
                print( response )
                try:
                    data['bridge'].sendToWs( '<modulemessage from_module="_core" transaction_id="{0}" pattern="{1}">{2}</glob>'.format( args.id, args.pattern, response ) )
                except Exception as e:
                    print( e )
                print( "sending glob response: {0}".format( response ) )

        def findPartialGlob( self, results ):
            if len( results ) == 0:
                return 'FALSE'
            last   = results.pop()
            length = len( last )
            for item in results:
                differences = [i for i in xrange( min( len( item ), length ) ) if item[i] != last[ i ] ]
                if len( differences ):
                    length = min( differences.pop(0), length-1 )
            return last[:length]

plugin_manager.register( '_core', CorePlugin( plugin_manager ) )
