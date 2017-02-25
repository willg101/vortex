from twisted.internet.protocol import Factory, Protocol

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
        if self._bridge.hasWsConnection():
            message = str( len( message ) ) + '\0' + message + '\0'
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
