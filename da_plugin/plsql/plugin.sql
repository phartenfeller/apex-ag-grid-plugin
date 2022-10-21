function render
    ( p_dynamic_action apex_plugin.t_dynamic_action
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
end;

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

function ajax( 
    p_dynamic_action apex_plugin.t_dynamic_action
  , p_plugin         apex_plugin.t_plugin
  ) return apex_plugin.t_dynamic_action_ajax_result
as
    l_affected_region_id varchar2(4000)  := p_dynamic_action.affected_region_id;

    l_dml_code        p_dynamic_action.attribute_01%type := p_dynamic_action.attribute_01;
    --l_items_to_return apex_t_varchar2                    := apex_string.split(p_dynamic_action.attribute_04, ',');
    --l_success_message   p_dynamic_action.attribute_05%type := p_dynamic_action.attribute_05;
    --l_error_message     p_dynamic_action.attribute_06%type := p_dynamic_action.attribute_06;

    l_filter_sql varchar2(4000);

    l_context           apex_exec.t_context;
    l_current_column    apex_exec.t_column;
    l_filters           apex_exec.t_filters;
    l_parameters        apex_exec.t_parameters;

    --needed for the selection filter

    l_return apex_plugin.t_dynamic_action_ajax_result;

    l_json_clob clob;
    l_values    apex_json.t_values;
    l_pk_idx    pls_integer;
    l_pk_val    varchar2(4000);

    l_test_val_num number;
    l_test_val_str varchar2(4000);

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
    end if;

    l_json_clob := get_json_clob();
    apex_json.parse
    (
      p_values => l_values
    , p_source => l_json_clob
    );


        l_context := apex_region.open_query_context
                       ( p_page_id      => V('APP_PAGE_ID')
                       , p_region_id    => l_affected_region_id
                       , p_max_rows     => 0
                       );

        for idx in 1 .. apex_exec.get_column_count(l_context)
        loop
            l_current_column := apex_exec.get_column
                                  ( p_context     => l_context
                                  , p_column_idx  => idx
                                  );

            if l_current_column.name = APEX_APPLICATION.g_x01 then
                l_pk_idx := idx;
            end if;

            exit when l_pk_idx is not null;
        end loop;

        apex_exec.close(l_context);
        commit; -- needed now in APEX 21.1


    l_filter_sql := 'to_char(#PK_COL#) member of ( apex_string.split(#PK_VALS#, '':'')  )';
    l_filter_sql := replace(l_filter_sql, '#PK_COL#', APEX_APPLICATION.g_x01);
    l_filter_sql := replace(l_filter_sql, '#PK_VALS#', APEX_APPLICATION.g_x02);

    apex_debug.info('l_filter_sql: %s', l_filter_sql);

    apex_exec.add_filter
    ( p_filters         => l_filters
    , p_sql_expression  => l_filter_sql
    );

    l_context := apex_region.open_query_context
               ( p_page_id             => v('APP_PAGE_ID')
               , p_region_id           => l_affected_region_id
               , p_additional_filters  => l_filters
               --, p_max_rows     => 0
               --, p_component_id => l_report_id    
               );

    begin
        while apex_exec.next_row(l_context)
        loop
            apex_exec.ADD_PARAMETER (
                  p_parameters => l_parameters
                , p_name => 'APEX$ROW_STATUS'
                , p_value => 'U'
            );

            l_pk_val := apex_exec.get_varchar2( p_context => l_context, p_column_idx => l_pk_idx );

            apex_debug.info('curr row  pk: %s', l_pk_val);

            for idx in 1 .. apex_exec.get_column_count(l_context)
            loop

                l_current_column := apex_exec.get_column
                                    ( p_context     => l_context
                                    , p_column_idx  => idx
                                    );

                apex_debug.message('column (%s): %s', idx, l_current_column.name);


                if  l_current_column.data_type = apex_exec.c_data_type_number then
                    apex_exec.ADD_PARAMETER (
                        p_parameters => l_parameters
                        , p_name => l_current_column.name
                        , p_value => apex_json.get_number( p_values => l_values, p_path => 'regions[1].data.%s.%s', p0 => l_pk_val, p1 => l_current_column.name )  --apex_exec.get_number( p_context => l_context, p_column_idx => idx )
                    );
                else
                    apex_exec.ADD_PARAMETER (
                        p_parameters => l_parameters
                        , p_name => l_current_column.name
                        , p_value =>  apex_json.get_varchar2( p_values => l_values, p_path => 'regions[1].data.%s.%s', p0 => l_pk_val, p1 => l_current_column.name ) --apex_exec.get_varchar2( p_context => l_context, p_column_idx => idx ) 
                    );
                end if;
             end loop;


            apex_exec.execute_plsql(p_plsql_code => l_dml_code, p_sql_parameters => l_parameters);
        end loop;
    exception
      when others then
        apex_debug.error('Error in loop: %s', sqlerrm);
        raise;
    end;

    for idx in 1 .. apex_exec.get_column_count(l_context)
    loop

            l_current_column := apex_exec.get_column
                                  ( p_context     => l_context
                                  , p_column_idx  => idx
                                  );

            apex_debug.message('column (%s): %s', idx, l_current_column.name);
    end loop;

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
end ajax;
