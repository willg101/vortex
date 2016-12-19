# Will Groenendyk, 2016
#
# Serves as a type of bridge between a debugger engine and HTTP, allowing the debugger to be
# controlled through HTTP POST requests. Note that this file serves mostly as a 'mailbox' of sorts;
# it collects messages from clients and the debugger, and, when given the opportunity, passes the
# messages on. The actual communication with HTTP clients is handled by a separate PHP script,
# which acts as a client to this script.

import socket
import threading
import base64
import select
import os
import argparse
import sys
import Queue
import errno
from time import sleep
import xml.etree.ElementTree as ET
from websocket import create_connection

class ThreadedServer( object) :
    def __init__( self, host, xdebug_port, controller_port ):
        self.xdebug_inbox = Queue.Queue();
        self.xdebug_outbox = Queue.Queue();

        self.xdebug_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.xdebug_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.xdebug_socket.setblocking( 0 )
        self.xdebug_socket.bind((host, xdebug_port))

        self.controller_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.controller_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.controller_socket.setblocking( 0 )
        self.controller_socket.bind((host, controller_port))

    def listen( self ):
        self.xdebug_socket.listen( 0 )
        self.controller_socket.listen( 5 )
        input = [self.xdebug_socket,self.controller_socket]
        while True:
            inputready,outputready,exceptready = select.select(input,[],[])

            for s in inputready:
                if s == self.controller_socket:
                    client, address = self.controller_socket.accept()
                    #client.settimeout( 0 );
                    threading.Thread(target = self.listenToPhpClient,args = (client,address)).start()
                elif s == self.xdebug_socket:
                    client, address = self.xdebug_socket.accept()
                    client.settimeout( 0 );
                    threading.Thread(target = self.listenToXdebugClient,args = (client,address)).start()

    def listenToXdebugClient( self, client, address ):
        #print "clearing..."
        #self.xdebug_inbox = Queue.Queue();
        #self.xdebug_outbox = Queue.Queue();

        while True:
            while not self.xdebug_outbox.empty():
                client.send( self.xdebug_outbox.get() + "\0" )

            try:
                data = client.recv( 4096 )
                if data:
                    try:
                        root = ET.fromstring(data.split( "\0" )[1])
                        if root.attrib['fileuri']:
                            with open( root.attrib['fileuri'].replace( 'file://', '') , 'r' ) as f:
                                first_line = f.readline();
                                if first_line.startswith( '<?php /* dpoh: ignore */' ):
                                    client.send( "detach -i 0\0" )
                                    client.close()
                                    return
                    except:
                        pass
                    print "\nincoming: " + data
                    self.xdebug_inbox.put( data )
                    ws = create_connection("ws://localhost:3001/bridge");
                    ws.send( data );
                    ws.close
                else:
                    raise Exception( 'Client disconnected' )
            except socket.timeout, e:
                continue;
            except socket.error, e:
                err = e.args[0]
                if err == errno.EAGAIN or err == errno.EWOULDBLOCK:
                    sleep(.1)
                else:
                    client.close()
                    return False

    def listenToPhpClient( self, client, address ):
        size = 4096
        while True:
            try:
                data = client.recv(size)
                if data == "quit":
                    print "Quitting..."
                    os._exit( 0 )
                elif data == "get":
                    if self.xdebug_inbox.empty():
                        client.send( "NO_DATA" )
                    else:
                        while not self.xdebug_inbox.empty():
                            to_send = self.xdebug_inbox.get()
                            print "\noutgoing: " + to_send
                            client.send( to_send )
                            print "sent!\n"
                elif data.startswith( "send " ):
                    self.xdebug_outbox.put( data[5:] )
                    client.send( "SEND_ACK" );
                else:
                    raise Exception( 'PHP Client disconnected' )
            except Exception as e:
                err = e.args[0]
                if err == errno.EAGAIN or err == errno.EWOULDBLOCK:
                    sleep(1)
                    print "3"
                else:
                    client.close()
                    return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument( '-n', '--host', default='localhost',
        help='The hostname to bind server sockets to' )
    parser.add_argument( '-x', '--xdebug-port', default=9000,
        help='The port to listen to for xdebug connections' )
    parser.add_argument( '-c', '--controller-port', default=1234,
        help='The port to listen to for controller connections' )
    args = parser.parse_args()
    ThreadedServer( args.host, args.xdebug_port, args.controller_port ).listen()
