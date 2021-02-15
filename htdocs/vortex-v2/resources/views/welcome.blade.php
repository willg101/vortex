<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="csrf-token" content="{{ csrf_token() }}" />
        <meta name="viewport" content="width=device-width, initial-scale=1">

        <title>Vortex | Connecting...</title>

        <!-- Fonts -->
        <script src="//code.iconify.design/1/1.0.7/iconify.min.js"></script>
        <link href="{{ mix('css/app.css') }}" rel="stylesheet">
        <link href="https://unpkg.com/splitpanes/dist/splitpanes.css" rel="stylesheet">

        <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@200;600&display=swap" rel="stylesheet">
    </head>
    <body>
        <div id="app"><app></app></div>
        <script src="/js/when.js" crossorigin="anonymous"></script>
        <script src="/js/autobahn.js"></script>
        <script src="https://code.jquery.com/jquery-3.5.1.min.js" integrity="sha256-9/aliU8dGd2tb6OSsuzixeV4y/faTqgFtohetphbbj0=" crossorigin="anonymous"></script>
        <script src="//cdnjs.cloudflare.com/ajax/libs/toastr.js/latest/js/toastr.min.js"></script>
        <script src="{{ mix('js/app.js') }}"></script>
    </body>
</html>
