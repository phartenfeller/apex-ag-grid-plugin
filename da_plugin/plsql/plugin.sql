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

  l_col_info tt_col_info;
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
      bulk collect into l_col_info
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
      bulk collect into l_col_info
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
          apex_exec.ADD_PARAMETER (
                p_parameters => l_parameters
              , p_name => c_row_status_bind
              , p_value => 'U'
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

        for j in 1 .. l_col_info.count loop
          apex_debug.message('Column (%s): %s (%s)', j, l_col_info(j).name, l_col_info(j).data_type);
          l_json_path := apex_string.format('regions[1].data.%0.%1', l_pk_vals(i), l_col_info(j).name);

          if  l_col_info(j).data_type = c_type_number then
            apex_debug.message('value: %s (%s)', apex_json.get_number( p_values => l_values, p_path => l_json_path ), l_json_path);
            apex_exec.ADD_PARAMETER (
                p_parameters => l_parameters
                , p_name => l_col_info(j).name
                , p_value => apex_json.get_number( p_values => l_values, p_path => l_json_path )
            );
          else
            apex_debug.message('value: %s (%s)', apex_json.get_varchar2( p_values => l_values, p_path => l_json_path ), l_json_path);
            apex_exec.ADD_PARAMETER (
                p_parameters => l_parameters
                , p_name => l_col_info(j).name
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
end ajax;
