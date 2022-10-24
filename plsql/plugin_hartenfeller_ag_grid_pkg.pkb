create or replace package body plugin_hartenfeller_ag_grid_pkg as 

  type t_col_info is record (
    name              APEX_APPLICATION_PAGE_REG_COLS.name%type
  , data_type         APEX_APPLICATION_PAGE_REG_COLS.data_type%type
  , is_visible        number(1,0)
  , heading           APEX_APPLICATION_PAGE_REG_COLS.heading%type
  , editable          number(1,0)
  , grid_data_type    APEX_APPLICATION_PAGE_REG_COLS.attribute_02%type
  , number_format     APEX_APPLICATION_PAGE_REG_COLS.attribute_03%type
  , heading_alignment APEX_APPLICATION_PAGE_REG_COLS.attribute_04%type
  , value_alignment   APEX_APPLICATION_PAGE_REG_COLS.value_alignment%type
  );

  type tt_col_info is table of t_col_info;

  function render_region   (
    p_region              in apex_plugin.t_region
  , p_plugin              in apex_plugin.t_plugin
  , p_is_printer_friendly in boolean
  ) 
    return apex_plugin.t_region_render_result
  as
    l_result        apex_plugin.t_region_render_result;
    l_region_id_esc p_region.static_id%type := apex_escape.html_attribute( p_region.static_id );
  begin

    --debug
    if apex_application.g_debug 
    then
        apex_plugin_util.debug_region
          ( p_plugin => p_plugin
          , p_region => p_region
          );
    end if;

    sys.htp.p('<div id="'|| l_region_id_esc ||'_component_wrapper"></div');
    
    apex_javascript.add_onload_code(p_code => 'window.hartenfeller_dev.plugins.ag_grid.initPlugin({'|| 
                                  apex_javascript.add_attribute( p_name => 'regionId', p_value => l_region_id_esc ) ||
                                  apex_javascript.add_attribute( p_name => 'ajaxId', p_value => apex_plugin.get_ajax_identifier ) ||
                                  apex_javascript.add_attribute( p_name => 'itemsToSubmit', p_value => apex_plugin_util.page_item_names_to_jquery( p_page_item_names => p_region.ajax_items_to_submit ) ) ||
                                  apex_javascript.add_attribute( p_name => 'pkCol', p_value => p_region.attribute_01 ) ||
                                  apex_javascript.add_attribute( p_name => 'focusOnLoad', p_value => p_region.attribute_02 ) ||
                                  '})');
    
    
    return l_result;
  end render_region;

  function ajax_region (
    p_region in apex_plugin.t_region
  , p_plugin in apex_plugin.t_plugin
  )
    return apex_plugin.t_region_ajax_result
  as
    l_return apex_plugin.t_region_ajax_result;
    l_region_id     p_region.static_id%type := p_region.static_id;

    l_col_info tt_col_info;

    l_has_default_id boolean;
    
    l_methods varchar2(255 char);
    l_methods_split apex_t_varchar2;

    l_first_row pls_integer;
    l_max_rows  pls_integer;
    
    l_context       apex_exec.t_context;
  begin
    apex_plugin_util.debug_region
    (
      p_plugin => p_plugin
    , p_region => p_region
    );

    l_methods := APEX_APPLICATION.g_x01 ;
    apex_debug.info( apex_string.format('Calling AJAX with methods => %0', l_methods ) );

    l_methods_split := apex_string.split(l_methods, ':');

    l_has_default_id := regexp_substr(l_region_id, 'R[0-9]+$') = l_region_id;

    if l_has_default_id then
      select c.name
          , c.data_type
          , case when c.is_visible = 'Yes' then 1 else 0 end as is_visible
          , c.heading
          , case when c.attribute_01 = 'Y' then 1 else 0 end as editable
          , c.attribute_02 as grid_data_type
          , c.attribute_03 as number_format
          , c.attribute_04 as heading_alignment
          , c.value_alignment
        bulk collect into l_col_info
        from APEX_APPLICATION_PAGE_REGIONS r 
        join APEX_APPLICATION_PAGE_REG_COLS c
          on r.region_id = c.region_id
      where r.application_id = v('APP_ID')
        and r.page_id = v('APP_PAGE_ID')
        and r.region_id = to_number(replace(l_region_id, 'R', ''))
      order by c.display_sequence
      ;
    else 
      select c.name
          , c.data_type
          , case when c.is_visible = 'Yes' then 1 else 0 end as is_visible
          , c.heading
          , case when c.attribute_01 = 'Y' then 1 else 0 end as editable
          , c.attribute_02 as grid_data_type
          , c.attribute_03 as number_format
          , c.attribute_04 as heading_alignment
          , c.value_alignment
        bulk collect into l_col_info
        from APEX_APPLICATION_PAGE_REGIONS r 
        join APEX_APPLICATION_PAGE_REG_COLS c
          on r.region_id = c.region_id
      where r.application_id = v('APP_ID')
        and r.page_id = v('APP_PAGE_ID')
        and r.static_id = l_region_id
      order by c.display_sequence
      ;
    end if;


    apex_json.open_object; -- {

    if 'colMetadata' member of l_methods_split then
      apex_json.open_array('colMetaData'); -- "colMetaData": [
      

      for i in 1 .. l_col_info.count
      loop
        apex_json.open_object; -- {
        apex_json.write('colname', l_col_info(i).NAME); -- "colname": "..."
        apex_json.write('dataType', l_col_info(i).DATA_TYPE); -- "dataType": "..."
        apex_json.write('heading', l_col_info(i).heading); -- "heading": "..."
        apex_json.write('is_visible',l_col_info(i).is_visible = 1); -- "is_visible": "..."
        apex_json.write('editable',l_col_info(i).editable = 1); -- "editable": "..."
        apex_json.write('grid_data_type',l_col_info(i).grid_data_type); -- "grid_data_type": "..."
        apex_json.write('number_format',l_col_info(i).number_format); -- "number_format": "..."
        apex_json.write('heading_alignment',l_col_info(i).heading_alignment); -- "heading_alignment": "..."
        apex_json.write('value_alignment',l_col_info(i).value_alignment); -- "value_alignment": "..."
        apex_json.close_object; -- }
      end loop;

      apex_json.close_array;
    end if;

    if 'data' member of l_methods_split then
      l_first_row := coalesce(APEX_APPLICATION.g_x02, 1);
      l_max_rows := coalesce(APEX_APPLICATION.g_x03, 50);

      l_context :=
        apex_exec.open_query_context
        (
          p_first_row => l_first_row
        , p_max_rows  => l_max_rows
        );

      apex_json.open_array('data'); -- "data": [

      while apex_exec.next_row( p_context => l_context ) 
      loop
        apex_json.open_object; -- {

        for i in 1 .. l_col_info.count
        loop
          if l_col_info(i).data_type = 'NUMBER' then
            apex_json.write(l_col_info(i).name, apex_exec.get_number( p_context => l_context, p_column_idx => i ) );
          else
            apex_json.write(l_col_info(i).name, apex_exec.get_varchar2( p_context => l_context, p_column_idx => i ) );
          end if;
        end loop;

        apex_json.close_object; -- }
      end loop;

      apex_json.close_array;
    end if;

    apex_json.close_all;
    
    return l_return;
  exception
      when others then
        apex_debug.error( apex_string.format('Error in AG Grid Plugin (%0): %1', l_region_id, sqlerrm) );

        apex_exec.close(l_context);
        apex_json.close_all;
        raise; 
  end ajax_region;


end plugin_hartenfeller_ag_grid_pkg;
/
