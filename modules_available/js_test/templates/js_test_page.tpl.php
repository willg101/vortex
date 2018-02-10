<!DOCTYPE html>
<html>
	<head>
		<title>Vortex - Run Tests</title>
		<meta charset="UTF-8">
		<link rel="shortcut icon" href="<?php echo base_path() ?>favicon.ico" type="image/x-icon">
		<link rel="stylesheet" type="text/css" href="https://cdnjs.cloudflare.com/ajax/libs/jasmine/<?php echo $version ?>/jasmine.min.css">
	</head>
	<body>
		<script type="text/javascript" src="https://cdnjs.cloudflare.com/ajax/libs/jasmine/<?php echo $version ?>/jasmine.min.js"></script>
		<?php echo build_script_requirements() ?>
		<script type="text/javascript" src="https://cdnjs.cloudflare.com/ajax/libs/jasmine/<?php echo $version ?>/jasmine-html.min.js"></script>
		<script type="text/javascript" src="https://cdnjs.cloudflare.com/ajax/libs/jasmine/<?php echo $version ?>/boot.min.js"></script>
	</body>
</html>
