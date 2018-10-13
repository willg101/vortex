<!DOCTYPE html>
<html>
	<title>Vortex Debugger | Create an Account</title>
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
						<span class="login-text">Create a new account</span>
						<div class="create-account-form login-animate-element">
							<input name="username" placeholder="Username" type="text"/>
							<input name="display_name" placeholder="Your name" type="text"/>
							<input name="email" placeholder="Email" type="text"/>
							<input name="password1" placeholder="Password" type="password"/>
							<input name="password2" placeholder="Password (confirm)" type="password"/>

							<button class="btn" id="create_account">Create account</button>
						</div>
					</div>
				</div>
			</div>
		</div>
		<?php echo build_script_requirements() ?>
	</body>
</html>
