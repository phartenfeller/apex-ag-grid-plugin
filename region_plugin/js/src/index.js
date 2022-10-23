import { ajax, AJAX_COL_METADATA, AJAX_DATA } from './apex/ajax';
import './apex/initRegion';
import AG_GRID from './initGrid';

const { apex } = window;
const $ = apex.jQuery;

const IDX_COL = '__idx';

const gridOptions = {
  // default col def properties get applied to all columns
  defaultColDef: { sortable: true, filter: true, flex: 1, minWidth: 100 },

  rowSelection: 'multiple', // allow rows to be selected
  suppressRowClickSelection: true,

  animateRows: true, // have rows animate to new positions when sorted

  rowModelType: 'infinite',
};

class AgGrid extends HTMLElement {
  constructor() {
    super();

    this.ajaxId = this.getAttribute('ajaxId');
    this.itemsToSubmit = this.getAttribute('itemsToSubmit');
    this.regionId = this.getAttribute('regionId');
    this.pkCol = this.getAttribute('pkCol');

    this.contextMenuId = `${this.regionId}-context-menu`;

    this.amountOfRows = 30;

    this.changes = new Map();
    this.deletedIds = new Set();
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

    const pkVal = newData[IDX_COL];
    instance.changes.set(pkVal, newData);
  }

  #getGridOptions({ colMetaData }) {
    const columnDefs = [
      {
        field: IDX_COL,
        editable: false,
        checkboxSelection: true,
        headerName: '',
        valueFormatter: () => '', // don't show any value in the column
      },
    ];

    colMetaData.forEach((col) =>
      columnDefs.push({
        field: col.colname,
        //  editable: col.colname !== this.pkCol,
      })
    );

    gridOptions.columnDefs = columnDefs;

    gridOptions.getRowId = (params) => params.data[IDX_COL];

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
            const { data } = dataRes;
            for (let i = 0; i < data.length; i++) {
              data[i][IDX_COL] = data[i][this.pkCol];
            }

            const nextRow = oraFirstRow + data.length;
            console.log(`Next row: ${nextRow}`);

            params.successCallback(data, nextRow);
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

  getSaveData() {
    const data = Array.from(this.changes.values());
    const pkIds = data.map((row) => row[IDX_COL]);
    const dataMap = {};
    data.forEach((row) => {
      dataMap[row[IDX_COL]] = row;
    });
    console.log('Saving data', dataMap);

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

    return { data: dataMap, pkCol: this.pkCol, pkIds };
  }

  #markRowDeleted(rowId) {
    this.deletedIds.add(rowId);
    $(`#${this.regionId} div[row-id="${rowId}"]`).addClass(
      'marked-for-deletion'
    );
  }

  #setupContextMenu() {
    let currRowdId = null;
    const $contextMenu = $(`#${this.contextMenuId}`);

    const menuList = [
      {
        type: 'action',
        label: 'Delete row',
        icon: 'fa fa-trash',
        action: () => {
          this.#markRowDeleted(currRowdId);
        },
      },
      {
        type: 'action',
        label: 'Show Confirm',
        action() {
          apex.message.confirm('Are you sure?');
        },
      },
    ];

    $contextMenu.menu({
      iconType: 'fa',
      items: menuList,
    });

    $(`#${this.regionId}`).on('contextmenu', '.ag-row', (e) => {
      e.preventDefault();
      currRowdId = e.currentTarget.getAttribute('row-id');
      console.log('Row id', currRowdId);
      $contextMenu.menu('toggle', e.pageX, e.pageY);
    });
  }

  connectedCallback() {
    const wrapperNode = document.createElement('div');

    this.gridNode = document.createElement('div');
    this.gridNode.classList.add('ag-theme-alpine');
    this.gridNode.style.height = '500px';

    const contextMenuNode = document.createElement('div');
    contextMenuNode.id = this.contextMenuId;

    wrapperNode.appendChild(this.gridNode);
    wrapperNode.appendChild(contextMenuNode);

    this.appendChild(wrapperNode);

    this.#setupGrid();

    this.#setupContextMenu();
  }
}

window.customElements.define('p-ag-grid', AgGrid);
