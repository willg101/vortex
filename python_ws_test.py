###############################################################################
#
# The MIT License (MIT)
#
# Copyright (c) Crossbar.io Technologies GmbH
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in
# all copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
# THE SOFTWARE.
#
###############################################################################

from autobahn.twisted.websocket import WebSocketServerProtocol, \
    WebSocketServerFactory
from twisted.internet.protocol import Factory, Protocol
import time
from threading import Thread

to_websocket = None
to_debugger  = None

def psend():
    while True:
        time.sleep( 2 );
        if callable(sender):
            sender( "Timed call...", False );


class DbgpServerProtocol(Protocol):

    def __init__(self, factory):
        self.factory = factory

    def connectionMade(self):
        global to_debugger
        print("Debug Client connecting:")
        if callable(to_websocket) and not callable(to_debugger):
            print("We have a websocket client and a debug client")
            to_debugger = self.transport.write
        else:
            print("No websocket client, detch")
            self.transport.write( "detach -i 0\0" );
            self.transport.loseConnection()

    def connectionLost(self, reason):
        global to_debugger
        to_debugger = None
        print("Debug Client disconnecting:")

    def dataReceived(self, data):
        global to_debugger
        if callable(to_websocket):
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
#    Thread(target = psend).start()
    reactor.run()
    