<!DOCTYPE html>
<html>
	<head>
	<title>DPOH</title>
		<meta charset="UTF-8">
		<link rel="shortcut icon" href="favicon.ico" type="image/x-icon">
		<link rel="icon" href="favicon.ico" type="image/x-icon">

		<?php echo build_css_requirements() ?>

		<?php $errs = []; echo build_less_requirements( $errs ) ?>

	</head>
	<body>
		<?php $show( 'before_main' ) ?>
		<?php if ( $errs ): ?>
		<pre>Less Errors:
<?php var_export( $errs ) ?></pre>
		<?php endif ?>
		<div class="main-layout <?php $show( 'main_classes' ) ?>">
			<?php foreach ( [ 'north', 'south', 'east' ] as $pos ): ?>
				<?php if ( $has( "main_$pos" ) ): ?>
				<div class="ui-layout-<?php echo $pos ?>">
					<?php $show( "main_$pos" ) ?>
				</div>
				<?php endif ?>
			<?php endforeach ?>
			<div class="ui-layout-center">
				<div class="toolbar">
					<div class="css-table">
						<div class="css-row">
							<div class="css-cell">
								<div class="left">
									<?php $show( 'toolbar_buttons' ) ?>
								</div>
								<div class="right" >
									<?php $show( 'connection_summary' ) ?>
								</div>
							</div>
						</div>
					</div>
				</div>
				<div class="css-table layout-table">
					<div class="css-row">
						<div class="css-cell editor-cell">
							<?php $show( 'code_cell' ) ?>
						</div>
						<div class="css-cell context-cell">
							<?php $show( 'status_cell' ) ?>
						</div>
					</div>
				</div>
			</div>
		</div>
		<?php $show( 'after_main' ) ?>
		<?php $show( 'splash' ) ?>
		<?php echo build_script_requirements() ?>
	</body>
</html>
