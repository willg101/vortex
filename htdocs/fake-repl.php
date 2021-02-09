#!/usr/bin/env php
<?php

$s = fsockopen('localhost', 55455);
stream_set_blocking($s, false);
stream_set_blocking(STDIN, false);

for (;;) {
    $socket_output = fread($s, 1024);
    $user_input    = trim(fread(STDIN, 1024));
    if ($user_input) {
        if ($user_input == 'q') {
            exit;
        } else {
            $msg = mb_strlen($user_input) . "\0$user_input\0";
            fwrite($s, $msg);
        }
    }
    if ($socket_output) {
        echo "\n >> $socket_output\n";
    }
    usleep(10000);
}
