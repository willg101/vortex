<!DOCTYPE html>
<html>
	<head>
		<title>Vortex Debugger | Error</title>
		<style>
			body
			{
				margin: 0;
				padding: 150px;
				text-align: left;
				background: #662211;
				color: #CCC;
				font-family: sans-serif;
			}
			.err-msg
			{
				font-family: monospace;
				color: #FFF;
				font-weight: bold;
			}
			a
			{
				color: #58B;
				font-weight: bold;
			}
			a:hover
			{
				color: #FFF;
			}
		</style>
	</head>
	<body>
		<h1>A problem occurred while initializing the login system.</h1>
		<p>Error message: <span class="err-msg"><?php echo $msg ?></span></p>
		<p>As a safety precaution, Vortex will not start up until this is fixed.</p>
		<p>To see a stack trace, <a href="?use-default-error-msg=1">hide this message</a>.</a>
	</body>
</html>
