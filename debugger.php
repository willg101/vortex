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
		<script src="js/files.js"></script>
		<script src="js/dpoh.js"></script>
		<script src="js/modal.js"></script>
		<script src="js/CodePanel.js"></script>
		<script src="js/StatusPanel.js"></script>
		<script src="js/interface.js"></script>
		<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/jstree/3.2.1/themes/default/style.min.css" />
		<link rel="stylesheet" href="<?php echo compile_less() ?>" />
		<link href="https://fonts.googleapis.com/css?family=Open+Sans" rel="stylesheet">
	</head>
	<body>
		<div class="blurable">
		<div class="css-table layout-table">
			<div class="css-row toolbar">
				<div class="css-cell">
				</div>
				<div class="css-cell">
					<div class="left">
						<button class="btn" data-command="step_over"><span class="fa fa-fw fa-step-forward"></span></button>
						<button class="btn" data-command="step_into"><span class="fa fa-fw fa-long-arrow-down"></span></button>
						<button class="btn" data-command="step_out"><span class="fa fa-fw fa-long-arrow-up"></span></button>
						<button class="btn" data-command="run"><span class="fa fa-fw fa-play"></span></button>
						<button class="btn" data-command="stop"><span class="fa fa-fw fa-stop"></span></button>
						<button class="btn" data-command="detach"><span class="fa fa-fw fa-unlink"></span></button>
					</div>
					<div class="right">
						<span id="status_indicator" class="fa fa-warning disconnected"></span>
					</div>
				</div>
				<div class="css-cell">
					<div class="left">
						<button class="btn active" data-status-show="#stack_main"><span class="fa fa-fw fa-clone"></span></button>
						<button class="btn" data-status-show="#context_main"><span class="fa fa-fw fa-database"></span></button>
					</div>
					<div class="right status-indicators blur-hidden">
						<span class="h-padding"><span class="fa fa-fw fa-align-center v-padding"></span> <span id="stack_depth">--</span></span>
						<span class="h-padding"><span class="fa fa-fw fa-pie-chart v-padding"></span> <span id="mem_usage">--</span></span>
					</div>
				</div>
			</div>
			<div class="css-row">
				<div class="css-cell files-cell">
				</div>
				<div class="css-cell editor-cell">
					<div class="css-table">
						<div class="css-row label-row">
							<div class="css-cell">
								Code <span class="secondary" id="filename"></span>
							</div>
						</div>
						<div class="css-row">
							<div class="css-cell">
								<div class="relative-container">
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
					</div>
				</div>
				<div class="css-cell context-cell">
					<div id="context_main" class="hidden status-panel css-table">
						<div class="css-row label-row">
							<div class="css-cell">
								Context
							</div>
						</div>
						<div class="css-row">
							<div class="css-cell">
								<div class="scroller">
									<div id="context">
									</div>
								</div>
							</div>
						</div>
					</div>
					<div id="stack_main" class="css-table status-panel">
						<div class="css-row label-row">
							<div class="css-cell">
								Stack
							</div>
						</div>
						<div class="css-row">
							<div class="css-cell">
								<div class="scroller">
									<div id="stack">
									</div>
								</div>
							</div>
						</div>
					</div>					
				</div>
			</div>
		</div>
		</div>
		<div class="modal-overlay" style="display: none;">
			<div class="modal modal-hidden">
				<div class="modal-title-bar">
					<div class="modal-title"></div>
					<div class="modal-exit"><span class="fa fa-close"></span></div>
				</div>
				<div class="modal-content">
				</div>
			</div>
		</div>
	</body>
</html>
