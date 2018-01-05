<!DOCTYPE html>
<html>
	<head>
	<title>DPOH - Error</title>
		<meta charset="UTF-8">
		<link rel="shortcut icon" href="favicon.ico" type="image/x-icon">
		<link rel="icon" href="favicon.ico" type="image/x-icon">
		<link rel="stylesheet" href="<?php echo $base_path ?>css/crash.css">
	</head>
	<body>
		<h1>Well, this isn't good...</h1>
		<h2><?php echo $title ?></h2>
		<p><?php echo $message ?></p>
		<pre class="trace"><b class="trace-title">Stack trace</b><?php echo $trace ?></pre>
	</body>
</html>
