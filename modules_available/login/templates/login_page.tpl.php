<!DOCTYPE html>
<html>
	<title>Vortex Debugger | Login Required</title>
		<meta charset="UTF-8">
		<link rel="shortcut icon" href="favicon.ico" type="image/x-icon">
		<link rel="icon" href="favicon.ico" type="image/x-icon">
		<?php echo build_css_requirements() ?>
		<?php echo build_less_requirements() ?>
	</head>
	<body id="login_page">
		<div class="css-table">
			<div class="css-row">
				<div class="css-cell">
					<div id="login_form_container" class="login-animate-element">
						<div class="logo"><?php $show('vortex_logo') ?></div>
						<?php if ($mode == 'login'): ?>
						<div class="login-form">
							<input name="username" class="no-bg" placeholder="Username" type="text"/>
							<input name="password" class="no-bg" placeholder="Password" type="password"/>
							<div class="btn-group black extra-margin-top">
								<button class="btn text-btn login">Login</button>
								<button class="btn text-btn reset-pw">Reset Password</button>
							</div>
						</div>
						<div class="reset-pw-form inactive">
							<input name="username_reset_pw" class="no-bg" placeholder="Username or email" type="text"/>
							<div class="btn-group black extra-margin-top">
								<button class="btn text-btn cancel-reset">Cancel</button>
								<button class="btn text-btn reset-pw-submit">Submit</button>
							</div>
						</div>
						<?php elseif ($mode == 'create'): ?>
						<div class="create-account-form">
							<input name="username"  class="no-bg" placeholder="Username" type="text"/>
							<input name="email"     class="no-bg" placeholder="Email" type="text"/>
							<input name="password1" class="no-bg" placeholder="Password" type="password"/>
							<input name="password2" class="no-bg" placeholder="Password (confirm)" type="password"/>
							<?php if (isset($it, $iid)): ?>
								<input name="it"  type="hidden" value="<?php echo $it ?>"/>
								<input name="iid" type="hidden" value="<?php echo $iid ?>"/>
							<?php endif ?>
							<div class="btn-group black extra-margin-top">
								<button class="btn text-btn" id="create_account">Create account</button>
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
