<?php

/**
 * @brief
 *	Sanitize a string for insertion into html as plain text
 *
 * @note
 *	Inspired by Drupal's check_plain()
 *	https://api.drupal.org/api/drupal/includes%21bootstrap.inc/function/check_plain/7.x
 *
 * @param string $str
 * @return string
 */
function sanitize_text_for_html($str)
{
    return htmlspecialchars($str, ENT_QUOTES, 'UTF-8');
}

/**
 * @brief
 *	Convert an array to an HTML list of attributes
 *
 * @note
 *	Inspired by Drupal's drupal_attributes()
 *	https://api.drupal.org/api/drupal/includes%21common.inc/function/drupal_attributes/7.x
 *
 * @param array $attributes
 * @return string
 */
function html_attrs(array $attributes = [])
{
    $attrs_rendered = '';
    foreach ($attributes as $attribute => $data) {
        if (is_array($data)) {
            $data = implode(' ', $data);
        }
        $attrs_rendered .= $attribute . '="' . sanitize_text_for_html($data) . '" ';
    }
    return $attrs_rendered;
}
