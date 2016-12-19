<?php /* dpoh: ignore */


ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once( 'functions.php' );

?>
<html>
	<head>
		<title>html debugger</title>
		<meta charset="UTF-8">
		<script src="https://use.fontawesome.com/b2e4717b55.js"></script>
		<script src="//ajax.googleapis.com/ajax/libs/jquery/1.10.2/jquery.min.js"></script>
		<script src="js/ace-editor/ace.js" type="text/javascript" charset="utf-8"></script>
		<script src="https://cdnjs.cloudflare.com/ajax/libs/jstree/3.2.1/jstree.min.js"></script>
		<script src="js/dpoh.js"></script>
		<script src="js/modal.js"></script>
		<script src="js/interface.js"></script>
		<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/jstree/3.2.1/themes/default/style.min.css" />
		<link rel="stylesheet" href="<?php echo compile_less() ?>" />
		<link href="https://fonts.googleapis.com/css?family=Open+Sans" rel="stylesheet">
	</head>
	<body>
		<div class="toolbar">
			<div class="window-glass"></div>
			<div class="cover"></div>
			<div class="left">
				<button class="btn" data-command="step_over"><span class="fa fa-fw fa-step-forward"></span></button>
				<button class="btn" data-command="step_into"><span class="fa fa-fw fa-long-arrow-down"></span></button>
				<button class="btn" data-command="step_out"><span class="fa fa-fw fa-long-arrow-up"></span></button>
				<button class="btn" data-command="run"><span class="fa fa-fw fa-play"></span></button>
				<button class="btn" data-command="stop"><span class="fa fa-fw fa-stop"></span></button>
				<button class="btn" data-command="detach"><span class="fa fa-fw fa-unlink"></span></button>
				<button class="btn" data-command="quit"><span class="fa fa-fw fa-close"></span></button>
			</div>
			<!--<div id="recents"></div>-->
		</div>
		<div class="windows">
			<div class="window">
				<div class="window-glass"></div>
				<div class="window-title">
					<span class="fa fa-code icon"></span>
					<span class="text">Code</span>
				</div>
				<div class="window-content-outer">
					<div class="window-content">
						<div class="cover"></div>
						<pre id="editor" >// ██████╗ ██████╗  ██████╗ ██╗  ██╗
// ██╔══██╗██╔══██╗██╔═══██╗██║  ██║
// ██║  ██║██████╔╝██║   ██║███████║
// ██║  ██║██╔═══╝ ██║   ██║██╔══██║
// ██████╔╝██║     ╚██████╔╝██║  ██║
// ╚═════╝ ╚═╝      ╚═════╝ ╚═╝  ╚═╝
//                                 
// Start an Xdebug session in order to begin</pre>
					</div>
				</div>
			</div>
			<div class="window">
				<div class="window-glass"></div>
				<div class="window-title">	
					<span class="fa fa-info-circle icon"></span>
					<span class="text">Context</span>
				</div>
				<div class="window-content-outer">
					<div class="window-content">
						<div class="cover"></div>
						<div id="context">
							<!--<ul><li>Test 1</li><li>Test 2</li></ul>-->
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="modal-overlay" style="display: none;">
			<div class="modal">
				<div class="modal-title-bar">
					<div class="modal-title">Open file</div>
					<div class="modal-exit"><span class="fa fa-close"></span></div>
				</div>
				<div class="modal-content">
				</div>
			</div>
		</div>
	</body>
</html>
