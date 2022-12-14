# APEX AG Grid Plugin

Implementation of the Community Edition [AG Grid](https://www.ag-grid.com/) component wich enables a more spreadsheet like data editing experience. Internally it uses the [Infinite Row Model](https://www.ag-grid.com/javascript-data-grid/infinite-scrolling/) and can be used as an alternative to the Interactive Grid.

This Plug-In focusses on the editing experience. Thats why I don't intend to implement features for a read only experience like the interactive grid has.

I have not yet decided yet on how search / filter / sort should work. I am currently leaning into doing this client-side only (so only for the already loaded rows) as thousands of rows are horrible to edit anyways. A huge dataset can be filtered before in the query. Select lists or other items could be used to let the user filter a subset of the data (changes need to be saved first of course). If you have comments / ideas feel free to share them.

![Plugin Demo](./assets/plugin_demo.gif)

[Interactive Demo](https://apex.oracle.com/pls/apex/r/hartenfeller_dev/ag-grid-plugin-demo)

## Beta Status

This Plug-In is currently in a beta status. Expect bugs and changes. Please submit feedback, bugs, request etc. as GitHub issues or discussions.

## Installation and Usage

[YouTube Tutorial](https://www.youtube.com/watch?v=9IVx2rp9N2k)

### Installation

1. Go to [latest GitHub release](https://github.com/phartenfeller/apex-ag-grid-plugin/releases) and download the zip
2. Install DB Package
3. Install both region and dynamic action Plug-Ins

### Usage

1. Create a region and select a data source
2. Create your own Save Button and add the dynamic action as on click action
3. Set affected region to the Region Plug-In and put your DML-Code

Example DML-Code:

```sql
begin
    case :APEX$ROW_STATUS
    when 'C' then
       insert into EMP_GRID
         (NAME, JOB, SALARY, COMMISSION)
        values
          (:NAME, :JOB, :SALARY, :COMMISSION);
    when 'U' then
        update EMP_GRID
           set NAME  = :NAME,
               job = :job,
               SALARY = :SALARY,
               COMMISSION = :COMMISSION
         where ID  = :ID;
    when 'D' then
       delete from emp_grid where id = :id;
    end case;
end;
```
