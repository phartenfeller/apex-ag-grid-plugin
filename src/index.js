import { ajax, AJAX_COL_METADATA, AJAX_DATA } from './apex/ajax';
import './apex/initRegion';
import AG_GRID from './initGrid';

const { apex } = window;

const gridOptions = {
  // default col def properties get applied to all columns
  defaultColDef: { sortable: true, filter: true },

  rowSelection: 'multiple', // allow rows to be selected
  animateRows: true, // have rows animate to new positions when sorted

  // example event handler
  onCellClicked: (params) => {
    console.log('cell was clicked', params);
  },

  rowModelType: 'infinite',
};

class AgGrid extends HTMLElement {
  constructor() {
    super();

    this.ajaxId = this.getAttribute('ajaxId');
    this.itemsToSubmit = this.getAttribute('itemsToSubmit');
    this.regionId = this.getAttribute('regionId');
    this.pkCol = this.getAttribute('pkCol');

    this.amountOfRows = 30;

    this.changes = new Map();
  }

  #handleChange(event, instance) {
    const oldData = event.data;
    const { field } = event.colDef;
    const { newValue } = event;
    const newData = { ...oldData };
    newData[field] = event.newValue;

    console.log(
      `onCellEditRequest, updating ${field} to ${newValue} - event => `,
      event
    );

    const pkVal = newData[this.pkCol];
    instance.changes.set(pkVal, newData);
  }

  #getGridOptions({ colMetaData }) {
    const columnDefs = colMetaData.map((col) => ({
      field: col.colname,
      editable: col.colname !== this.pkCol,
    }));

    gridOptions.columnDefs = columnDefs;

    gridOptions.getRowId = (params) => params.data.pkCol;

    gridOptions.infiniteInitialRowCount = this.amountOfRows;
    gridOptions.cacheBlockSize = this.amountOfRows;
    gridOptions.cacheOverflowSize = 1;

    gridOptions.onCellValueChanged = (e) => this.#handleChange(e, this);

    return gridOptions;
  }

  async #setupGrid() {
    if (!this.pkCol) {
      apex.debug.error(
        `AG-Grid Plugin: No primary key column provided for region #${this.regionId}`
      );
    }

    const res = await ajax({
      apex,
      ajaxId: this.ajaxId,
      itemsToSubmit: this.itemsToSubmit,
      regionId: this.regionId,
      methods: [AJAX_COL_METADATA],
    });

    this.gridOptions = this.#getGridOptions({
      colMetaData: res.colMetaData,
    });
    this.grid = new AG_GRID(this.gridNode, this.gridOptions);

    const dataSource = {
      rowCount: undefined, // behave as infinite scroll

      getRows: async (params) => {
        try {
          console.log(`asking for ${params.startRow} to ${params.endRow}`);

          const oraFirstRow = params.startRow + 1; // Oracle starts with 1
          const oraAmountOfRows = params.endRow - params.startRow;

          const dataRes = await ajax({
            apex,
            ajaxId: this.ajaxId,
            itemsToSubmit: this.itemsToSubmit,
            regionId: this.regionId,
            methods: [AJAX_DATA],
            firstRow: oraFirstRow,
            amountOfRows: oraAmountOfRows,
          });

          if (dataRes.data) {
            const nextRow = oraFirstRow + dataRes.data.length;
            console.log(`Next row: ${nextRow}`);

            params.successCallback(dataRes.data, nextRow);
          } else {
            apex.debug.error(
              `Could not fetch data from region #${
                this.regionId
              }. Res => ${JSON.stringify(dataRes)}`
            );
            params.failCallback();
          }
        } catch (err) {
          apex.debug.error(
            `Error fetching data from region #${
              this.regionId
            }. Err => ${JSON.stringify(err)}`
          );
          params.failCallback();
        }
      },
    };

    this.gridOptions.api.setDatasource(dataSource);

    // this.gridOptions.api.setRowData(res.data);
  }

  async save() {
    const data = Array.from(this.changes.values());
    console.log('Saving data', data);

    /*
    const res = await ajax({
      apex,
      ajaxId: this.ajaxId,
      itemsToSubmit: this.itemsToSubmit,
      regionId: this.regionId,
      methods: ['save'],
      data,
    });

    console.log('Save response', res);
    */
  }

  connectedCallback() {
    this.gridNode = document.createElement('div');
    this.gridNode.classList.add('ag-theme-alpine');
    this.gridNode.style.height = '500px';

    this.appendChild(this.gridNode);

    this.#setupGrid();
  }
}

window.customElements.define('p-ag-grid', AgGrid);
