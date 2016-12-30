<?php require_once( 'functions.php' ); ?>
<?php $modules = load_all_modules(); ?>
<!DOCTYPE html>
<html>
	<head>
	<title>DPOH Interface Engine</title>
		<script src="//ajax.googleapis.com/ajax/libs/jquery/1.10.2/jquery.min.js"></script>
		<script src="js/core.js"></script>
		<?php echo build_script_requirements( $modules ); ?>
		
		<?php echo build_css_requirements( $modules ); ?>
		
		<?php echo build_less_requirements( $modules ); ?>

	</head>
	<body>
		Hello, World!
	</body>
</html>