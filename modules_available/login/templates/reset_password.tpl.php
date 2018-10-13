<!DOCTYPE html>
<html>
	<title>Vortex Debugger | Reset Password</title>
		<meta charset="UTF-8">
		<link rel="shortcut icon" href="favicon.ico" type="image/x-icon">
		<link rel="icon" href="favicon.ico" type="image/x-icon">

		<?php echo build_css_requirements() ?>

		<?php $errs = []; echo build_less_requirements($errs) ?>
	</head>
	<body id="login_page">
		<?php if ($errs): ?>
		<pre>Less Errors:
<?php var_export($errs) ?></pre>
		<?php endif ?>
		<div class="css-table">
			<div class="css-row">
				<div class="css-cell">
					<div id="form_container" class="login-animate-element">
						<span class="login-text">Reset Password</span>
						<div class="create-account-form login-animate-element">
							<input type="hidden" name="otlt" value="<?php echo $otlt ?>"/>
							<input type="hidden" name="tid" value="<?php echo $tid ?>"/>
							<input name="password1" placeholder="New password" type="password"/>
							<input name="password2" placeholder="New password (confirm)" type="password"/>
							<button class="btn" id="reset_password">Save</button>
						</div>
					</div>
				</div>
			</div>
		</div>
		<?php echo build_script_requirements() ?>
	</body>
</html>
