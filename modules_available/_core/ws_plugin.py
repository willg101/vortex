class LoginPlugin:
	def preboot( self, data ):
		print "preboot"

	def boot( self, data ):
		print "boot"

	def onWsOpen( self, data ):
		print "onwsopen"

item = LoginPlugin()

registerPlugin( item )
