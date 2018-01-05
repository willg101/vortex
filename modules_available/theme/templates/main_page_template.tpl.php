<DOCTYPE html>
<html>
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
		<div class="main-layout blurable <?php $show( 'main_classes' ) ?>">
			<?php foreach ( [ 'north', 'south', 'east', 'west', 'center' ] as $pos ): ?>
				<?php if ( $has( "main_$pos" ) ): ?>
				<div class="ui-layout-<?php echo $pos ?>">
					<?php $show( "main_$pos" ) ?>
				</div>
				<?php endif ?>
			<?php endforeach ?>
		</div>
		<?php $show( 'after_main' ) ?>
		<?php $show( 'splash' ) ?>
		<?php echo build_script_requirements() ?>
	</body>
</html>
