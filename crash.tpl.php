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
		<?php foreach ( $exceptions as $i => $exception ): ?>
			<section>
				<h2><?php echo $exception[ 'title' ] ?></h2>
				<p><?php echo $exception[ 'message' ] ?></p>
				<pre class="trace"><b class="trace-title">Stack trace</b><?php echo $exception[ 'trace' ] ?></pre>
			</section>
		<?php endforeach ?>
	</body>
</html>
