const gridOptions = {
  // default col def properties get applied to all columns
  defaultColDef: { sortable: true, filter: true },

  rowSelection: 'multiple', // allow rows to be selected
  animateRows: true, // have rows animate to new positions when sorted

  // example event handler
  onCellClicked: (params) => {
    console.log('cell was clicked', params);
  },
};

export default function getGridOptions({ colMetaData, pkCol }) {
  const columnDefs = colMetaData.map((col) => ({
    field: col.colname,
    editable: col.colname !== pkCol,
  }));

  gridOptions.columnDefs = columnDefs;

  gridOptions.getRowId = (params) => params.data.pkCol;

  return gridOptions;
}
