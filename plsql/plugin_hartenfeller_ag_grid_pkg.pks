create or replace package plugin_hartenfeller_ag_grid_pkg as 

  function render_region (
    p_region              in apex_plugin.t_region
  , p_plugin              in apex_plugin.t_plugin
  , p_is_printer_friendly in boolean
  ) 
    return apex_plugin.t_region_render_result
  ;

  function ajax_region (
    p_region in apex_plugin.t_region
  , p_plugin in apex_plugin.t_plugin
  ) 
    return apex_plugin.t_region_ajax_result
  ;

  function render_da ( 
    p_dynamic_action apex_plugin.t_dynamic_action
  , p_plugin         apex_plugin.t_plugin
  )
    return apex_plugin.t_dynamic_action_render_result
  ;

  function ajax_da ( 
    p_dynamic_action apex_plugin.t_dynamic_action
  , p_plugin         apex_plugin.t_plugin
  ) 
    return apex_plugin.t_dynamic_action_ajax_result
  ;

end plugin_hartenfeller_ag_grid_pkg;
/
