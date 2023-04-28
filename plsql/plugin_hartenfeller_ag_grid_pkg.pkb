create or replace package body plugin_hartenfeller_ag_grid_pkg as 

  type t_col_info is record (
    name                  APEX_APPLICATION_PAGE_REG_COLS.name%type
  , data_type             APEX_APPLICATION_PAGE_REG_COLS.data_type%type
  , is_visible            number(1,0)
  , heading               APEX_APPLICATION_PAGE_REG_COLS.heading%type
  , editable              number(1,0)
  , grid_data_type        APEX_APPLICATION_PAGE_REG_COLS.attribute_02%type
  , number_format         APEX_APPLICATION_PAGE_REG_COLS.attribute_03%type
  , heading_alignment     APEX_APPLICATION_PAGE_REG_COLS.attribute_04%type
  , value_alignment       APEX_APPLICATION_PAGE_REG_COLS.value_alignment%type
  , html_template         APEX_APPLICATION_PAGE_REG_COLS.attribute_05%type
  , max_col_width         APEX_APPLICATION_PAGE_REG_COLS.attribute_06%type
  , js_computed_val_code  APEX_APPLICATION_PAGE_REG_COLS.attribute_07%type
  );

  type tt_col_info is table of t_col_info;


  function get_col_info (
    p_region_id in varchar2
  )
    return tt_col_info
  as
    l_has_default_id     boolean;
    l_col_info_query_tab tt_col_info;
  begin
    l_has_default_id := regexp_substr(p_region_id, 'R[0-9]+$') = p_region_id;
    
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
          , c.attribute_05 as html_template
          , c.attribute_06 as max_col_width
          , c.attribute_07 as js_computed_val_code
        bulk collect into l_col_info_query_tab
        from APEX_APPLICATION_PAGE_REGIONS r 
        join APEX_APPLICATION_PAGE_REG_COLS c
          on r.region_id = c.region_id
      where r.application_id = v('APP_ID')
        and r.page_id = v('APP_PAGE_ID')
        and r.region_id = to_number(replace(p_region_id, 'R', ''))
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
          , c.attribute_05 as html_template
          , c.attribute_06 as max_col_width
          , c.attribute_07 as js_computed_val_code
        bulk collect into l_col_info_query_tab
        from APEX_APPLICATION_PAGE_REGIONS r 
        join APEX_APPLICATION_PAGE_REG_COLS c
          on r.region_id = c.region_id
      where r.application_id = v('APP_ID')
        and r.page_id = v('APP_PAGE_ID')
        and r.static_id = p_region_id
      order by c.display_sequence
      ;
    end if;

    return l_col_info_query_tab;
  end get_col_info;


  procedure log_render_parameters (
    pi_region in apex_plugin.t_region
  )
  is
  begin
      if apex_application.g_debug
      then
          apex_debug.message('---------------');
          apex_debug.message('Render Parameters');
          apex_debug.message('---------------');
          apex_debug.message('p_region.static_id: %s', pi_region.static_id);
          apex_debug.message('ajax_items_to_submit: %s', pi_region.ajax_items_to_submit);
          apex_debug.message('attribute_01: %s', pi_region.attribute_01);
          apex_debug.message('attribute_02: %s', pi_region.attribute_02);
          apex_debug.message('attribute_03: %s', pi_region.attribute_03);
          apex_debug.message('attribute_04: %s', pi_region.attribute_04);

          apex_debug.message('g_x01', APEX_APPLICATION.g_x01);

          apex_debug.message('---------------');
          apex_debug.message('EOF Parameters');
          apex_debug.message('---------------');
      end if;
  end log_render_parameters;

  function render_region   (
    p_region              in apex_plugin.t_region
  , p_plugin              in apex_plugin.t_plugin
  , p_is_printer_friendly in boolean
  ) 
    return apex_plugin.t_region_render_result
  as
    l_onload_js     varchar2(32767 char) := '';

    l_result        apex_plugin.t_region_render_result;
    l_region_id_esc p_region.static_id%type := apex_escape.html_attribute( p_region.static_id );

    l_col_info_query_tab tt_col_info;
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

    l_col_info_query_tab := get_col_info(l_region_id_esc);

    for i in 1 .. l_col_info_query_tab.count
    loop

      if l_col_info_query_tab(i).js_computed_val_code is not null then
        l_onload_js := l_onload_js ||
          'window.hartenfeller_dev.plugins.ag_grid.addComputedColCode({'|| 
          apex_javascript.add_attribute( p_name => 'regionId', p_value => l_region_id_esc ) ||
          apex_javascript.add_attribute( p_name => 'colname', p_value => l_col_info_query_tab(i).NAME ) ||
          'fc: ' || l_col_info_query_tab(i).js_computed_val_code ||
          '});';

      end if;

    end loop;

    l_onload_js := l_onload_js ||
      'window.hartenfeller_dev.plugins.ag_grid.initPlugin({'|| 
      apex_javascript.add_attribute( p_name => 'regionId', p_value => l_region_id_esc ) ||
      apex_javascript.add_attribute( p_name => 'ajaxId', p_value => apex_plugin.get_ajax_identifier ) ||
      apex_javascript.add_attribute( p_name => 'itemsToSubmit', p_value => apex_plugin_util.page_item_names_to_jquery( p_page_item_names => p_region.ajax_items_to_submit ) ) ||
      apex_javascript.add_attribute( p_name => 'pkCol', p_value => p_region.attribute_01 ) ||
      apex_javascript.add_attribute( p_name => 'focusOnLoad', p_value => p_region.attribute_02 ) ||
      apex_javascript.add_attribute( p_name => 'displayRownum', p_value => p_region.attribute_03 ) ||
      apex_javascript.add_attribute( p_name => 'pageSize', p_value => p_region.attribute_04 ) ||
      '"additionalSettings":'|| p_region.attribute_05 || ',' ||
      '})';
    
    apex_javascript.add_onload_code(p_code => l_onload_js);
    
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

    l_col_info_query_tab tt_col_info;
    
    l_methods varchar2(255 char);
    l_methods_split apex_t_varchar2;

    l_first_row pls_integer;
    l_max_rows  pls_integer;
    
    l_context           apex_exec.t_context;
    l_col_info          apex_exec.t_column;
    l_col_info_exec_tab apex_exec.t_columns;
  begin
    apex_plugin_util.debug_region
    (
      p_plugin => p_plugin
    , p_region => p_region
    );

    log_render_parameters(p_region);

    l_methods := APEX_APPLICATION.g_x01 ;
    apex_debug.info( apex_string.format('Calling AJAX with methods => %0', l_methods ) );

    l_methods_split := apex_string.split(l_methods, ':');

    apex_json.open_object; -- {

    if 'colMetadata' member of l_methods_split then

      l_col_info_query_tab := get_col_info(l_region_id);
  
      apex_json.open_array('colMetaData'); -- "colMetaData": [
      

      for i in 1 .. l_col_info_query_tab.count
      loop
        apex_json.open_object; -- {
        apex_json.write('colname', l_col_info_query_tab(i).NAME); -- "colname": "..."
        apex_json.write('dataType', l_col_info_query_tab(i).DATA_TYPE); -- "dataType": "..."
        apex_json.write('heading', l_col_info_query_tab(i).heading); -- "heading": "..."
        apex_json.write('is_visible',l_col_info_query_tab(i).is_visible = 1); -- "is_visible": "..."
        apex_json.write('editable',l_col_info_query_tab(i).editable = 1); -- "editable": "..."
        apex_json.write('grid_data_type',l_col_info_query_tab(i).grid_data_type); -- "grid_data_type": "..."
        apex_json.write('number_format',l_col_info_query_tab(i).number_format); -- "number_format": "..."
        apex_json.write('heading_alignment',l_col_info_query_tab(i).heading_alignment); -- "heading_alignment": "..."
        apex_json.write('value_alignment',l_col_info_query_tab(i).value_alignment); -- "value_alignment": "..."
        apex_json.write('htmlTemplate',l_col_info_query_tab(i).html_template); -- "value_alignment": "..."
        apex_json.write('maxColWidth',l_col_info_query_tab(i).max_col_width); -- "maxColWidth": "..."
    
        if l_col_info_query_tab(i).js_computed_val_code is not null then
          apex_javascript.add_inline_code ( 
            p_code =>
              'window.hartenfeller_dev.plugins.ag_grid.addComputedColCode({'|| 
              apex_javascript.add_attribute( p_name => 'regionId', p_value => l_region_id ) ||
              apex_javascript.add_attribute( p_name => 'colname', p_value => l_col_info_query_tab(i).NAME ) ||
              apex_javascript.add_attribute( p_name => 'fc', p_value => l_col_info_query_tab(i).js_computed_val_code ) ||
              '});'
          , p_key => 'ag_grid_computed_col_code_' || l_region_id || '_' || l_col_info_query_tab(i).NAME
          );
        end if;

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

      for i in 1 .. apex_exec.get_column_count(l_context)
      loop
        l_col_info := apex_exec.get_column(l_context, i);
        l_col_info_exec_tab(i) := l_col_info;
      end loop;

      while apex_exec.next_row( p_context => l_context ) 
      loop
        apex_json.open_object; -- {

        for i in 1 .. l_col_info_exec_tab.count
        loop
          if l_col_info_exec_tab(i).data_type = apex_exec.c_data_type_number then
            apex_json.write(l_col_info_exec_tab(i).name, apex_exec.get_number( p_context => l_context, p_column_idx => i ) );
          else
            apex_json.write(l_col_info_exec_tab(i).name, apex_exec.get_varchar2( p_context => l_context, p_column_idx => i ) );
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


  function render_da( 
    p_dynamic_action apex_plugin.t_dynamic_action
  , p_plugin         apex_plugin.t_plugin
  )
    return apex_plugin.t_dynamic_action_render_result
  as
    l_return apex_plugin.t_dynamic_action_render_result;

    l_region_id varchar2(4000);
  begin
      if apex_application.g_debug then
          apex_plugin_util.debug_dynamic_action
            ( p_plugin         => p_plugin
            , p_dynamic_action => p_dynamic_action
            );
      end if;

      select coalesce(static_id,  'R'||to_char(region_id))
      into l_region_id
      from apex_application_page_regions
      where region_id = p_dynamic_action.affected_region_id;

    l_return.javascript_function := 'function() {window.hartenfeller_dev.plugins.ag_grid_da.saveGrid({'|| 
                                  apex_javascript.add_attribute( p_name => 'regionId', p_value => l_region_id) ||
                                  apex_javascript.add_attribute( p_name => 'ajaxId', p_value => apex_plugin.get_ajax_identifier ) ||
                                  '})  }';

      

      apex_debug.message('render');

      return l_return;
  end render_da;

  function get_used_binds (
      pi_code in varchar2
  ) return apex_t_varchar2
  as
    c_bind_pattern constant varchar2(200) := ':([abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890\$#\_\-]*)';
    l_binds        apex_t_varchar2;
    l_return       apex_t_varchar2 := apex_t_varchar2();
  begin
    l_binds := apex_string.grep( 
      p_str => pi_code
    , p_pattern =>  c_bind_pattern
    , p_modifier => 'i'
    , p_subexpression => '1'
    );

    for i in 1 .. l_binds.count
    loop
      if not upper(l_binds(i)) member of (l_return) then 
        apex_string.push( l_return, upper( l_binds(i) ) );
      end if;
    end loop;

    return l_return;
  end get_used_binds;

  function get_json_clob
      return clob
  as
      l_str_tab apex_t_varchar2 := apex_t_varchar2();
      l_clob    clob;
  begin
      for i in 1..apex_application.g_json.count loop
        l_str_tab.extend();
        l_str_tab(i) := apex_application.g_json(i);
      end loop;
      l_clob := apex_string.join_clob( p_table => l_str_tab, p_sep => null );
      return l_clob;
  end get_json_clob;

  function ajax_da( 
      p_dynamic_action apex_plugin.t_dynamic_action
    , p_plugin         apex_plugin.t_plugin
    ) return apex_plugin.t_dynamic_action_ajax_result
  as
      l_affected_region_id varchar2(4000)  := p_dynamic_action.affected_region_id;

      l_dml_code        p_dynamic_action.attribute_01%type := p_dynamic_action.attribute_01;
      --l_items_to_return apex_t_varchar2                    := apex_string.split(p_dynamic_action.attribute_04, ',');
      --l_success_message   p_dynamic_action.attribute_05%type := p_dynamic_action.attribute_05;
      --l_error_message     p_dynamic_action.attribute_06%type := p_dynamic_action.attribute_06;

      l_used_binds apex_t_varchar2 := get_used_binds(pi_code => l_dml_code);


      l_context           apex_exec.t_context;
      l_parameters        apex_exec.t_parameters;

      --needed for the selection filter

      l_return apex_plugin.t_dynamic_action_ajax_result;

      l_json_clob clob;
      l_values    apex_json.t_values;

      l_pk_vals apex_t_varchar2 := apex_string.split(APEX_APPLICATION.g_x02, ':');

      l_json_path varchar2(4000);

    type t_col_info is record (
      name       APEX_APPLICATION_PAGE_REG_COLS.name%type
    , data_type  APEX_APPLICATION_PAGE_REG_COLS.data_type%type
    );

    type tt_col_info is table of t_col_info;

    l_col_info_query_tab tt_col_info;
    l_has_default_id boolean;

    c_type_number constant varchar2(100) := 'NUMBER';
    c_row_status_bind constant varchar2(100) := 'APEX$ROW_STATUS';
    c_rowid_bind constant varchar2(100) := 'ROWID';

      --------------------------------------------------------------------------------
      -- dumps ajax parameters to debug output
      --------------------------------------------------------------------------------
      procedure log_ajax_parameters
      is
      begin
          if apex_application.g_debug
          then
              apex_debug.message('---------------');
              apex_debug.message('AJAX Parameters');
              apex_debug.message('---------------');
              apex_debug.message('p_widget_name: %s',apex_application.g_widget_name);
              apex_debug.message('p_widget_action: %s',apex_application.g_widget_action);
              apex_debug.message('p_widget_action_mod: %s',apex_application.g_widget_action_mod);
              apex_debug.message('p_request: %s',apex_application.g_request);
              apex_debug.message('x01: %s',apex_application.g_x01);
              apex_debug.message('x02: %s',apex_application.g_x02);
              --apex_debug.message('x03: %s',apex_application.g_x03);
              --apex_debug.message('x04: %s',apex_application.g_x04);
              --apex_debug.message('x05: %s',apex_application.g_x05);
              --apex_debug.message('x06: %s',apex_application.g_x06);
              --apex_debug.message('x07: %s',apex_application.g_x07);
              --apex_debug.message('x08: %s',apex_application.g_x08);
              --apex_debug.message('x09: %s',apex_application.g_x09);
              --apex_debug.message('x10: %s',apex_application.g_x10);
              --apex_debug.message('f01: %s',apex_util.table_to_string(apex_application.g_f01));
              apex_debug.message('---------------');
              apex_debug.message('EOF Parameters');
              apex_debug.message('---------------');
          end if;
      end log_ajax_parameters;

  begin

      --debugging
      if apex_application.g_debug then
          apex_plugin_util.debug_dynamic_action
            ( p_plugin         => p_plugin
            , p_dynamic_action => p_dynamic_action
            );
          log_ajax_parameters;

          apex_debug.message('Used binds: %s', apex_string.join(l_used_binds, ', ') );
      end if;

      l_json_clob := get_json_clob();
      apex_json.parse
      (
        p_values => l_values
      , p_source => l_json_clob
      );

    l_has_default_id :=  true; --regexp_substr(l_affected_region_id, 'R[0-9]+$') = l_affected_region_id;
    apex_debug.message('Affected region ID: %s', l_affected_region_id );

    if l_has_default_id then
      select c.name
          , c.data_type
        bulk collect into l_col_info_query_tab
        from APEX_APPLICATION_PAGE_REGIONS r 
        join APEX_APPLICATION_PAGE_REG_COLS c
          on r.region_id = c.region_id
      where r.application_id = v('APP_ID')
        and r.page_id = v('APP_PAGE_ID')
        and r.region_id = l_affected_region_id --to_number(replace(l_affected_region_id, 'R', ''))
        and c.name member of (l_used_binds)
      order by c.display_sequence
      ;
    else 
      select c.name
          , c.data_type
        bulk collect into l_col_info_query_tab
        from APEX_APPLICATION_PAGE_REGIONS r 
        join APEX_APPLICATION_PAGE_REG_COLS c
          on r.region_id = c.region_id
      where r.application_id = v('APP_ID')
        and r.page_id = v('APP_PAGE_ID')
        and r.static_id = l_affected_region_id
        and c.name member of (l_used_binds)
      order by c.display_sequence
      ;
    end if;


      begin
        -- loop over every changed row
        for i in 1 .. l_pk_vals.count loop
          apex_debug.message('process row (%s), PK: %s', i, l_pk_vals(i));

          -- clean parameter array every time
          l_parameters := apex_exec.t_parameters();

          -- add row status bind if used
          if c_row_status_bind member of (l_used_binds) then
            l_json_path := apex_string.format('regions[1].data.%0.__row_action', l_pk_vals(i));
            apex_debug.message('Row Action: %s', apex_json.get_varchar2( p_values => l_values, p_path => l_json_path ));

            apex_exec.ADD_PARAMETER (
                  p_parameters => l_parameters
                , p_name => c_row_status_bind
                , p_value => apex_json.get_varchar2( p_values => l_values, p_path => l_json_path )
            );
          end if;

          if c_rowid_bind member of (l_used_binds) then
            l_json_path := apex_string.format('regions[1].data.%0.%1', l_pk_vals(i), c_rowid_bind);

            apex_debug.message('ROWID: %s', apex_json.get_varchar2( p_values => l_values, p_path => l_json_path ));
            apex_exec.ADD_PARAMETER (
                  p_parameters => l_parameters
                , p_name => c_rowid_bind
                , p_value => apex_json.get_varchar2( p_values => l_values, p_path => l_json_path )
            );
          end if;

          for j in 1 .. l_col_info_query_tab.count loop
            apex_debug.message('Column (%s): %s (%s)', j, l_col_info_query_tab(j).name, l_col_info_query_tab(j).data_type);
            l_json_path := apex_string.format('regions[1].data.%0.%1', l_pk_vals(i), l_col_info_query_tab(j).name);

            if  l_col_info_query_tab(j).data_type = c_type_number then
              apex_debug.message('value: %s (%s)', apex_json.get_number( p_values => l_values, p_path => l_json_path ), l_json_path);
              apex_exec.ADD_PARAMETER (
                  p_parameters => l_parameters
                  , p_name => l_col_info_query_tab(j).name
                  , p_value => apex_json.get_number( p_values => l_values, p_path => l_json_path )
              );
            else
              apex_debug.message('value: %s (%s)', apex_json.get_varchar2( p_values => l_values, p_path => l_json_path ), l_json_path);
              apex_exec.ADD_PARAMETER (
                  p_parameters => l_parameters
                  , p_name => l_col_info_query_tab(j).name
                  , p_value =>  apex_json.get_varchar2( p_values => l_values, p_path => l_json_path )
              );
            end if;
          end loop;

          -- run plsql
          apex_exec.execute_plsql(p_plsql_code => l_dml_code, p_sql_parameters => l_parameters, p_auto_bind_items => false);
        end loop;
      exception
        when others then
          apex_debug.error('Error in loop: %s', sqlerrm);
          raise;
      end;

      apex_json.open_object;
      apex_json.write('success', true);
      apex_json.close_object;

      return l_return;
  exception
      when others
      then
          -- always ensure the context is closed, also in case of an error
          apex_exec.close(l_context);
          raise;
  end ajax_da;



end plugin_hartenfeller_ag_grid_pkg;
/
