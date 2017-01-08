
from autobahn.twisted.websocket import WebSocketServerProtocol, \
    WebSocketServerFactory
from twisted.internet.protocol import Factory, Protocol
import time
from threading import Thread
import xml.etree.ElementTree as ET

to_websocket = None
to_debugger  = None

class DbgpServerProtocol(Protocol):

    def __init__(self, factory):
        self.factory = factory
        self.connected_to_client = False

    def connectionMade(self):
        global to_debugger
        print("Debug Client connecting:")
        if callable(to_websocket):
            if callable(to_debugger):
                print( 'We already have an active debugger client; detaching' )
                self.transport.loseConnection()
                return
            print("We have a websocket client and a debug client")
            to_debugger = self.transport.write
            self.connected_to_client = True;
        else:
            print("No websocket client, detching...")
            #self.transport.write( "detach -i 0\0" );
            self.transport.loseConnection()

    def connectionLost(self, reason):
        if self.connected_to_client:
            global to_debugger
            to_debugger = None
            print("Removing callback bridge...")
            if callable(to_websocket):
                print("Informing websocket client of disconnection");
				self.sendMessageToWebsocket( '<wsserver status="session_end"></wsserver>' )

	def sendMessageToWebsocket(self, mesage):
		if callable( to_websocket ):
			message = str( len( message ) ) + '\0' + mesage + '\0'
			to_websocket( message )

    def dataReceived(self, data):
        global to_debugger
        if callable(to_websocket):
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
            except:
                print "Unknown parse error"
                pass
            print data;
            to_websocket(data)
        else:
            self.transport.write( "detach -i 0\0" );
            self.transport.loseConnection()
    
class DbgpServerProtocolFactory(Factory):

    def buildProtocol(self, addr):
        return DbgpServerProtocol(self)
            
class MyServerProtocol(WebSocketServerProtocol):

    def onConnect(self, request):
        print("Client connecting: {0}".format(request.peer))

    def onOpen(self):
        global to_websocket
        if not callable(to_websocket):
            to_websocket = self.sendMessage
        else:
            self.transport.loseConnection()

    def onMessage(self, payload, isBinary):
        global to_websocket
        if isBinary:
            print("Binary message received: {0} bytes".format(len(payload)))
        else:
            print("Text message received: {0}".format(payload.decode('utf8')))
            if callable(to_debugger):
                to_debugger( payload + '\0' )

    def onClose(self, wasClean, code, reason):
        print("WebSocket connection closed: {0}".format(reason))
        global to_websocket
        to_websocket = None


if __name__ == '__main__':

    import sys

    from twisted.python import log
    from twisted.internet import reactor

    log.startLogging(sys.stdout)

    factory = WebSocketServerFactory(u"ws://127.0.0.1:3001/bridge")
    factory.protocol = MyServerProtocol
    # factory.setProtocolOptions(maxConnections=2)

    # note to self: if using putChild, the child must be bytes...

    reactor.listenTCP(9000, DbgpServerProtocolFactory())
    reactor.listenTCP(3001, factory)
    reactor.run()
    
