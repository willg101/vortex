<DOCTYPE html>
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
		<?php $show( 'before_main' ) ?>
		<?php if ( $errs ): ?>
		<pre>Less Errors:<?php echo "\n" . var_export( $errs, TRUE ) ?></pre>
		<?php endif ?>
		<?php $show( 'toolbar' ) ?>
		<div data-split-id="main" data-split="vertical" class="main-layout blurable <?php $show( 'main_classes' ) ?>">
			<?php $show( 'debugger_main' ) ?>
		</div>
		<?php $show( 'after_main' ) ?>
		<?php $show( 'splash' ) ?>
		<?php echo build_script_requirements() ?>
	</body>
</html>
