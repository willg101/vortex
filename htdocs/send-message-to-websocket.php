<?php

if ($argc != 3) {
    echo "\nUsage: $argv[0] <title> <category>\n\n";
    die(1);
}

$context = new ZMQContext();
$socket = $context->getSocket(ZMQ::SOCKET_PUSH, 'my pusher');
$socket->connect("tcp://localhost:5555");
$socket->send(json_encode(["title" => $argv[1], "cat"=>$argv[2]]));
