<!DOCTYPE html>
<html class="vue">
	<head>
		<title>Vortex</title>
		<meta charset="UTF-8">
		<link rel="shortcut icon" href="<?php echo base_path() ?>favicon.ico" type="image/x-icon">
		<link rel="icon" href="<?php echo base_path() ?>favicon.ico" type="image/x-icon">

		<?php echo build_css_requirements() ?>

		<?php echo build_less_requirements() ?>

	</head>
	<body>
		<?php $show('toolbar') ?>
		<div class="hidden">
			<div class="all-layouts">
				<?php echo $layouts ?>
			</div>
			<div class="all-windows">
				<?php echo $windows ?>
			</div>
		</div>
		<div id="layout_in_use" class="blurable">
		</div>
		<?php $show('after_main') ?>
		<?php $show('splash') ?>
		<?php echo build_script_requirements() ?>
	</body>
</html>
