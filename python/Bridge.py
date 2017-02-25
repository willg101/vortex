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
            self._wsConnection.sendMessage( data )

    def sendToDbg( self, data ):
        if self.hasWsConnection():
            self._dbgConnection.transport.write( data )
    
