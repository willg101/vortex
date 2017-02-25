import os
import subprocess
import Cookie

class LoginPlugin:
        def __init__( self ):
            print( "Init login plugin" )

        def onWsConnect( self, data ):
            try:
                cookie_str = data['request'].headers['cookie']
                if type(cookie_str) == unicode:
                    cookie_str = cookie_str.encode('utf-8')
                cookies = Cookie.SimpleCookie()
                cookies.load(cookie_str)
                sessid  = cookies['dpoh_session_id'].value
                if not os.path.isfile( __dir__ + '/modules_enabled/login/sessions/' + sessid ):
                    print( "invalid session id")
                    data['connection'].transport.loseConnection()
                else:
                    print("Login succeeded")
            except Exception as e:
                print("cookie error: {0}".format(e))
                data['connection'].transport.loseConnection()

plugin_manager.register( 'login', LoginPlugin() )
