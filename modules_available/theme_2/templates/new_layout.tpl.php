<!DOCTYPE html>
<html class="theme-2">
	<head>
		<title>DPOH</title>
		<meta charset="UTF-8">
		<link rel="shortcut icon" href="<?php echo base_path() ?>favicon.ico" type="image/x-icon">
		<link rel="icon" href="<?php echo base_path() ?>favicon.ico" type="image/x-icon">

		<?php echo build_css_requirements() ?>

		<?php $errs = []; echo build_less_requirements( $errs ) ?>

	</head>
	<body>
		<?php $show( 'toolbar' ) ?>
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
		<?php $show( 'after_main' ) ?>
		<?php $show( 'splash' ) ?>
		<?php echo build_script_requirements() ?>
	</body>
</html>