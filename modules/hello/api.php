<?php

header("Content-Type: application/json;charset=utf-8");
echo json_encode( $_GET ?: $_POST );