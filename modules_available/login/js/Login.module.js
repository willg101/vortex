$(document).on('keypress', '.login-form input', tryLogin)
$(document).on('click', 'button.login', tryLogin)
function tryLogin (e) {
  if (e.type == 'keypress' && e.which != 13) {
    return
  }

  $.post(makeUrl('login'), {
    username: $('[name=username]').val(),
    password: $('[name=password]').val(),
    action: 'login'
  },
  function (data) {
    if (data.login_result) {
      $('#login_form_container').addClass('small')
      location.reload()
    } else {
      shakeForm()
    }
  })
}

subscribe('attempt-connection', function (e) {
  if (!userIsLoggedIn()) {
    e.options.abort = true
  }
})

$(document).on('click', '#create_account', function (e) {
  $.post(makeUrl('api/create-account'), {
    username: $('[name=username]').val(),
    email: $('[name=email]').val(),
    password1: $('[name=password1]').val(),
    password2: $('[name=password2]').val(),
    it: $('[name=it]').val(),
    iid: $('[name=iid]').val()
  },
  function (data) {
    location.reload()
  }).fail(function (message) {
    shakeForm()
  })
})

$(document).on('click', '#reset_password', function (e) {
  $.post(makeUrl('api/reset-password'), {
    otlt: $('[name=otlt]').val(),
    tid: $('[name=tid]').val(),
    password1: $('[name=password1]').val(),
    password2: $('[name=password2]').val()
  },
  function (data) {
    location.reload()
  }).fail(function (message) {
    shakeForm()
  })
})

$(document).on('click', '.reset-pw-submit', function (e) {
  var usernameOrEmail = $('[name=username_reset_pw]').val()

  var form = $('#login_form_container')
  $.post(makeUrl('api/users/' + usernameOrEmail + '/reset-password'), function (data) {
    $('[name=username_reset_pw]').val('')
    new vTheme.Popover('A link to reset your password has been sent to your email address.', [], {
      my: 'center',
      at: 'center',
      of: form },
    form)
  }).fail(shakeForm)
})

$(document).on('click', '.all-user-accounts .remove-account', function (e) {
  var btn = $(e.target).closest('button')
  var row = $(e.target).closest('[data-user-id]')
  var userId = row.attr('data-user-id')
  var content = render('login.confirmation', { userId: userId, comfirmType: 'remove' })
  new vTheme.Popover(content, [ 'remove-account-popover' ], {
    at: 'left bottom',
    my: 'left top',
    of: btn
  }, btn)
})

$(document).on('click', '[data-confirm=remove]', function onRemoveConfirmed (e) {
  var userId = $(e.target).closest('[data-user-id]').attr('data-user-id')
  var form = $('.modal')
  $.post(makeUrl('api/users/' + userId + '/remove'), function (data) {
    new vTheme.Popover('This account has been removed.', [], {
      my: 'center',
      at: 'center',
      of: form
    }, form)
  }).fail(shakeForm)
})

subscribe('gather-settings-pages', function (e) {
  e.pages.push({
    val: 'users',
    icon: 'user',
    title: 'User Accounts'
  })
})

subscribe('gather-settings-page-widgets', function (e) {
  if (e.page == 'users') {
    requestUserAccounts(function (success, accounts) {
      if (success) {
        $('.user-accounts-listing').html(render('login.user_accounts_listing', {
          accounts: accounts
        }))
      } else {
        $('.user-accounts-listing').text('User accounts failed to load.')
      }
    })

    e.widgets.push(render('login.settings', {
      spinner: vTheme.getSpinner()
    }))
  }
})

$(document).on('click', '.btn.reset-pw, .cancel-reset', function () {
  $('.reset-pw-form, .login-form').toggleClass('inactive')
})

$(document).on('click', '.invite-user', inviteUser)
$(document).on('keypress', '#invite_user', inviteUser)
function inviteUser (e) {
  if (e.type == 'keypress' && e.which != 13) {
    return
  }

  $.ajax({
    method: 'post',
    url: makeUrl('api/users/invite/' + $('#invite_user').val()),
    complete: function (xhr) {
      var input = $('#invite_user')
      if (xhr.status < 400) {
        input.val('')
      }

      var content = (xhr.status >= 400
        ? '<i class="fa fa-warning margin-right"></i>'
        : '') + xhr.responseText
      new vTheme.Popover(content, [], {
        'of': input
      }, input)
    }
  })
}

function requestUserAccounts (cb) {
  $.get(makeUrl('api/users/list'), (...args) => cb(true, ...args))
    .fail((...args) => cb(false, {}, ...args))
}

function userIsLoggedIn () {
  return typeof Dpoh === 'object'
    ? Dpoh.authenticated
    : false
}

function shakeForm () {
  $('#login_form_container').removeClass('shake')
  setTimeout(() => $('#login_form_container').addClass('shake'), 30)
}
