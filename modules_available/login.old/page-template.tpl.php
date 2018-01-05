<!DOCTYPE html>
<html>
	<title>DPOH (login required)</title>
		<meta charset="UTF-8">
		<link rel="shortcut icon" href="favicon.ico" type="image/x-icon">
		<link rel="icon" href="favicon.ico" type="image/x-icon">
		
		<?php echo build_css_requirements() ?>
		
		<?php $errs = []; echo build_less_requirements( $errs ) ?>
	</head>
	<body id="login_page">
		<?php if ( $errs ): ?>
		<pre>Less Errors:
<?php var_export( $errs ) ?></pre>
		<?php endif ?>
		<div class="css-table">
			<div class="css-row">
				<div class="css-cell">
					<div id="form_container" class="login-animate-element">
						<span class="login-text">Log in to DPOH</span>
					<?php if ( any_users_exist() ): ?>
						<div class="login-form login-animate-element">
							<input name="username" placeholder="Username" type="text"/>
							<input name="password" placeholder="Password" type="password"/>
						</div>
					<?php else: ?>
						<div class="login-form login-animate-element">
							Hmm...it looks like no user accounts exist currently.
						</div>
					<?php endif ?>
					</div>
				</div>
			</div>
		</div>
		<?php echo build_script_requirements() ?>
	</body>
</html>
