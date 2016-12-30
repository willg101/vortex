function send_api_request_original( script, type, params, success_cb, error_cb )
{
	return $[ type ]( script, params, success_cb ).fail( error_cb );
}