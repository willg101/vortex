<!DOCTYPE html>
<html>
	<title>Vortex Debugger | Login Required</title>
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
					<div id="login_form_container" class="login-animate-element">
						<div class="logo"><?php $show( 'vortex_logo' ) ?></div>
						<?php if ( $mode == 'login' ): ?>
						<div class="login-form">
							<input name="username" placeholder="Username" type="text"/>
							<input name="password" placeholder="Password" type="password"/>
							<div class="btn-group black extra-margin-top">
								<button class="btn login">Login</button>
								<button class="btn reset-pw">Reset Password</button>
							</div>
						</div>
						<div class="reset-pw-form inactive">
							<input name="username_reset_pw" placeholder="Username or email" type="text"/>
							<div class="btn-group black extra-margin-top">
								<button class="btn cancel-reset">Cancel</button>
								<button class="btn reset-pw-submit">Submit</button>
							</div>
						</div>
						<?php elseif ( $mode == 'create' ): ?>
						<div class="create-account-form">
							<input name="username" placeholder="Username" type="text"/>
							<input name="email" placeholder="Email" type="text"/>
							<input name="password1" placeholder="Password" type="password"/>
							<input name="password2" placeholder="Password (confirm)" type="password"/>
							<?php if ( isset( $it, $iid ) ): ?>
								<input name="it"  type="hidden" value="<?php echo $it ?>"/>
								<input name="iid" type="hidden" value="<?php echo $iid ?>"/>
							<?php endif ?>
							<div class="btn-group black extra-margin-top">
								<button class="btn" id="create_account">Create account</button>
							</div>
						</div>
						<?php endif ?>
					</div>
				</div>
			</div>
		</div>
		<?php echo build_script_requirements() ?>
	</body>
</html>
