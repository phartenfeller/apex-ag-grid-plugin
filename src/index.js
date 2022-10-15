import getGrid from './initGrid';

const gridOptions = {
  // each entry here represents one column
  columnDefs: [
    { field: 'make', editable: true },
    { field: 'model', editable: true },
    { field: 'price', editable: true },
  ],

  // default col def properties get applied to all columns
  defaultColDef: { sortable: true, filter: true },

  rowSelection: 'multiple', // allow rows to be selected
  animateRows: true, // have rows animate to new positions when sorted

  // example event handler
  onCellClicked: (params) => {
    console.log('cell was clicked', params);
  },
};

class AgGrid extends HTMLElement {
  constructor() {
    super();
    // this.attachShadow({ mode: 'open' });

    this.gridNode = document.createElement('div');
    this.gridNode.classList.add('ag-theme-alpine');
    this.gridNode.style.height = '500px';

    this.appendChild(this.gridNode);

    this.AG_GRID = getGrid();
  }

  connectedCallback() {
    this.grid = new this.AG_GRID(this.gridNode, gridOptions);

    gridOptions.api.setRowData([
      { make: 'Porsche', model: 'Boxter', price: 72000 },
      { make: 'Ford', model: 'Mondeo', price: 32000 },
      { make: 'Ford', model: 'Mondeo', price: 32000 },
      { make: 'Toyota', model: 'Celica', price: 35000 },
      { make: 'Toyota', model: 'Celica', price: 35000 },
      { make: 'Porsche', model: 'Boxter', price: 72000 },
      { make: 'Toyota', model: 'Celica', price: 35000 },
      { make: 'Toyota', model: 'Celica', price: 35000 },
      { make: 'Porsche', model: 'Boxter', price: 72000 },
    ]);
  }
}

window.customElements.define('p-ag-grid', AgGrid);
