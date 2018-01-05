<?php

class LayoutConflictException extends Exception {};

// TODO:
//	- Clicking on file input shows most recent files automatically
//	- Create dialog box that allows users to select files in a wysiwyg fashion

function theme_2_boot()
{
	request_handlers()->register( '', 'theme_2_render_with_layout_engine', [ 'access' => 'authenticated_only' ] );
}

function theme_2_render_with_layout_engine()
{
	$layouts = fire_hook( 'provide_layouts' );
	fire_hook( 'alter_layouts', $layouts );
	$layouts_rendered = '';
	foreach ( $layouts as $module_layouts )
	{
		foreach ( $module_layouts as $layout )
		{
			$layouts_rendered .= theme_2_build_layout( $layout );
		}
	}

	$windows = fire_hook( 'provide_windows' );
	fire_hook( 'alter_windows', $windows );
	$windows_rendered = '';
	foreach ( $windows as $module_windows )
	{
		foreach ( $module_windows as $window )
		{
			$windows_rendered .= render( 'theme_2_window', $window );
		}
	}

	echo render( 'new_layout', [
		'layouts' => $layouts_rendered,
		'windows' => $windows_rendered,
	] );
}

function theme_2_render_preprocess( &$data )
{
	if ( $data[ 'template' ] == 'vortex_logo' )
	{
		$data[ 'vars' ][ 'img_path' ] = base_path() . '/modules_enabled/theme_2/img';
	}
}

function theme_2_build_layout( $layout )
{
	static $id = 0;
	$title_attr = '';
	if ( isset( $layout[ 'title' ], $layout[ 'data' ] ) )
	{
		$title_attr = 'data-title="' . $layout[ 'title' ] . '" ';
		$layout     = $layout[ 'data' ];
	}
	$is_leaf = !(isset( $layout[ 'children' ] ) && is_array( $layout[ 'children' ] ));
	$html = '<div class="layout-split ' . ( $is_leaf ? 'leaf' : '' ) . '" data-split-id="' . $layout[ 'id' ] . '_' . $id
		. '" ' . $title_attr . 'data-split="'
		. ( $layout[ 'dir' ] == 'v' ? 'vertical' : 'horizontal' ) . '">';
	if ( isset( $layout[ 'children' ] ) && is_array( $layout[ 'children' ] ) )
	{
		foreach ( $layout[ 'children' ] as $child )
		{
			$html .= theme_2_build_layout( $child );
		}
	}

	$id++;
	return $html . '</div>';
}

function theme_2_provide_layouts()
{
	return [
		'jsfiddle-like' => [
			'title' => 'JSFiddle Style',
			'data'  => [
				'dir'      => 'h',
				'id'       => 'outer0',
				'children' => [
					[
						'id'  => 'inner-l',
						'dir' => 'v',
					],
					[
						'id'  => 'inner-r',
						'dir' => 'v',
					],
				]
			],
		],
		'original' => [
			'title' => 'Original',
			'data'  => [
				'dir'      => 'v',
				'id'       => 'outer1',
				'children' => [
					[
						'id'  => 'middle-top',
						'dir' => 'h',
						'children' => [
							[
								'id'  => 'inner-left',
								'dir' => 'h',
							],
							[
								'id'  => 'inner-right',
								'dir' => 'v',
							],
						],
					],
					[
						'id'  => 'inner-bottom',
						'dir' => 'h',
					],
				]
			],
		],
	];
}
