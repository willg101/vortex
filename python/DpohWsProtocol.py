from autobahn.twisted.websocket import WebSocketServerProtocol

class DpohWsProtocol(WebSocketServerProtocol):

    def onConnect(self, request):
        self._bridge = self.factory.dpoh_bridge
        self._pluginManager = self.factory.dpoh_plugin_manager
        print("Client connecting: {0}".format(request.peer))
        print(" - Headers: {0}".format(request.headers['cookie']))
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

