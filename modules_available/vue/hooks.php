<?php

class LayoutConflictException extends Exception
{
};

/**
 * @brief
 *	Implements hook_boot
 */
function vue_boot()
{
    request_handlers()->register('', 'vue_render_with_layout_engine', [ 'access' => 'authenticated_only' ]);
}

/**
 * @brief
 *	Renders the Debugger page
 */
function vue_render_with_layout_engine()
{
    $layouts = fire_hook('provide_layouts');
    fire_hook('alter_layouts', $layouts);
    $layouts_rendered = '';
    foreach ($layouts as $module_layouts) {
        foreach ($module_layouts as $layout) {
            $layouts_rendered .= vue_build_layout($layout);
        }
    }

    $windows = fire_hook('provide_windows');
    fire_hook('alter_windows', $windows);
    $windows_rendered = '';
    foreach ($windows as $module_windows) {
        foreach ($module_windows as $window) {
            $windows_rendered .= render('vue_window', $window);
        }
    }

    echo render('new_layout', [
        'layouts' => $layouts_rendered,
        'windows' => $windows_rendered,
    ]);
}

/**
 * @brief
 *	Implements hook_preprocess
 */
function vue_render_preprocess(&$data)
{
    if ($data[ 'template' ] == 'vortex_logo') {
        // Provide the directory that contains the graphics for the logo
        $data[ 'vars' ][ 'img_path' ] = base_path() . 'modules_enabled/vue/img';
    }
}

/**
 * @brief
 *	Generates the HTML for a Debugger layout
 *
 * @param array $layout
 *
 * @return string
 */
function vue_build_layout($layout)
{
    static $id = 0;
    $title_attr = '';
    if (isset($layout[ 'title' ], $layout[ 'data' ])) {
        $title_attr = 'data-title="' . $layout[ 'title' ] . '" ';
        $layout     = $layout[ 'data' ];
    }
    $is_leaf = !(isset($layout[ 'children' ]) && is_array($layout[ 'children' ]));
    $html = '<div class="layout-split ' . ($is_leaf ? 'leaf' : '') . '" data-split-id="' . $layout[ 'id' ] . '_' . $id
        . '" ' . $title_attr . 'data-split="'
        . ($layout[ 'dir' ] == 'v' ? 'vertical' : 'horizontal') . '">';
    if (isset($layout[ 'children' ]) && is_array($layout[ 'children' ])) {
        foreach ($layout[ 'children' ] as $child) {
            $html .= vue_build_layout($child);
        }
    }

    $id++;
    return $html . '</div>';
}

/**
 * @brief
 *	Implements hook_provide_layouts
 */
function vue_provide_layouts()
{
    return [
        'stacks' => [
            'title' => 'Stacks',
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
        'Sidebar' => [
            'title' => 'Sidebar',
            'data'  => [
                'dir'      => 'h',
                'id'       => 'outer0',
                'children' => [
                    [
                        'id'  => 'middle-l',
                        'dir' => 'v',
                        'children' => [
                            [
                                'id' => 'inner-top',
                                'dir' => 'h',
                            ],
                            [
                                'id' => 'inner-bottom',
                                'dir' => 'h',
                            ],
                        ],
                    ],
                    [
                        'id'  => 'middle-r',
                        'dir' => 'v',
                    ],
                ]
            ],
        ],
        'horizon' => [
            'title' => 'Horizon',
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
