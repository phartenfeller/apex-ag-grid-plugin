import { ajax, AJAX_COL_METADATA, AJAX_DATA } from './apex/ajax';
import './apex/initRegion';
import AG_GRID from './initGrid';

/** @type any */
const { apex } = window;
const $ = apex.jQuery;

const IDX_COL = '__idx';
const ROW_ACITON = '__row_action';

/** @type {import('@ag-grid-community/all-modules').GridOptions} */
const gridOptions = {
  // default col def properties get applied to all columns
  defaultColDef: {
    sortable: false,
    filter: false,
    flex: 1,
    resizable: true,
  },

  rowSelection: 'multiple', // allow rows to be selected
  suppressRowClickSelection: true,

  animateRows: true, // have rows animate to new positions when sorted

  rowModelType: 'infinite',

  columnTypes: {
    nonEdit: { editable: false },
    headerLeft: { headerClass: ['ag-left-aligned-header'] },
    headerRight: { headerClass: ['ag-right-aligned-header'] },
  },
};

class AgGrid extends HTMLElement {
  constructor() {
    super();

    this.ajaxId = this.getAttribute('ajaxId');
    this.itemsToSubmit = this.getAttribute('itemsToSubmit');
    this.regionId = this.getAttribute('regionId');
    this.pkCol = this.getAttribute('pkCol');
    this.focusOnLoad = this.getAttribute('focusOnLoad') === 'true';

    this.contextMenuId = `${this.regionId}-context-menu`;

    this.amountOfRows = 30;

    this.changes = new Map();

    this.markedChanges = false;

    // unfortunately necessary for inserts...
    // see https://www.ag-grid.com/javascript-data-grid/infinite-scrolling/#example-using-cache-api-methods
    this.dataCopy = [];
    this.newRows = [];
    this.fetchedAllDbRows = false;
  }

  hasChanges() {
    return this.changes.size > 0;
  }

  markChanges() {
    if (!this.markedChanges) {
      apex.page.warnOnUnsavedChanges(
        'There are unsaved changes',
        this.hasChanges.bind(this)
      );
      this.markedChanges = true;
    }
  }

  // eslint-disable-next-line class-methods-use-this
  #handleChange(event) {
    const oldData = event.data;
    const { field } = event.colDef;
    const { newValue } = event;
    const newData = { ...oldData };
    newData[field] = event.newValue;

    apex.debug.info(
      `onCellEditRequest, updating ${field} to ${newValue} - event => `,
      event
    );

    const pkVal = newData[IDX_COL];

    // don't override insert or delete
    if (this.changes.has(pkVal)) {
      newData[ROW_ACITON] = this.changes.get(pkVal)[ROW_ACITON];
    } else {
      newData[ROW_ACITON] = 'U';
    }

    this.changes.set(pkVal, newData);

    this.markChanges();
  }

  #getGridOptions({ colMetaData }) {
    /** @type {import('@ag-grid-community/all-modules').ColDef[]} */
    const columnDefs = [
      {
        field: IDX_COL,
        editable: false,
        checkboxSelection: true,
        headerName: '',
        valueFormatter: () => '', // don't show any value in the column
        maxWidth: 50,
      },
    ];

    colMetaData.forEach((col) => {
      const cellClasses = [];
      const types = [];

      if (!col.editable) {
        types.push('nonEdit');
        cellClasses.push('xag-read-only-cell');
      }

      if (col.heading_alignment === 'RIGHT') {
        types.push('headerRight');
      } else {
        types.push('headerLeft');
      }

      if (col.value_alignment === 'LEFT') {
        cellClasses.push('ag-left-aligned-cell');
      } else if (col.value_alignment === 'RIGHT') {
        cellClasses.push('ag-right-aligned-cell');
      } else {
        cellClasses.push('xag-center-aligned-cell');
      }

      /** @type {import('@ag-grid-community/all-modules').ColDef} */
      const colDef = {
        colId: col.colname,
        field: col.colname,
        headerName: col.heading ?? col.colname,
        editable: col.editable,
        hide: !col.is_visible,
        type: types,
        cellClass: cellClasses,
      };

      if (col.number_format) {
        colDef.valueFormatter = (params) =>
          params?.value
            ? apex.locale.formatNumber(params.value, col.number_format)
            : '';
      }

      columnDefs.push(colDef);
    });

    gridOptions.columnDefs = columnDefs;

    gridOptions.getRowId = (params) => params.data[IDX_COL];

    gridOptions.infiniteInitialRowCount = this.amountOfRows;
    gridOptions.cacheBlockSize = this.amountOfRows;
    gridOptions.cacheOverflowSize = 1;

    const boundHandleChange = this.#handleChange.bind(this);
    gridOptions.onCellValueChanged = boundHandleChange;

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
          apex.debug.info(
            `asking for ${params.startRow} - ${params.endRow}. Insertet rows: ${this.newRows.length}`
          );

          const toDeliverRows = [];
          const wantedRows = params.endRow - params.startRow;

          // first deliver new rows
          if (params.startRow < this.newRows.length) {
            const subEnd =
              params.startRow + Math.min(wantedRows, this.newRows.length);
            apex.debug.info(
              `Substituting rows from newRows: ${params.startRow} - ${subEnd}`
            );
            toDeliverRows.push(...this.newRows.slice(params.startRow, subEnd));
          }

          console.log('toDeliverRows after inserted', toDeliverRows);

          const firstWantedDataRow =
            params.startRow === 0 ? 0 : params.startRow - this.newRows.length;
          const amountWantedDataRows = wantedRows - toDeliverRows.length;

          // next deliver cached rows
          if (
            amountWantedDataRows > 0 &&
            firstWantedDataRow < this.dataCopy.length
          ) {
            const subEnd =
              firstWantedDataRow +
              Math.min(amountWantedDataRows, this.dataCopy.length);
            apex.debug.info(
              `Substituting rows from dataCopy: ${firstWantedDataRow} - ${subEnd}`
            );
            toDeliverRows.push(
              ...this.dataCopy.slice(firstWantedDataRow, subEnd)
            );
          }

          console.log('toDeliverRows after cache', toDeliverRows);

          const oraFirstRow =
            params.startRow === 0
              ? 1 // Oracle starts with 1
              : params.startRow + 1 - this.newRows.length;
          const oraAmountOfRows = wantedRows - toDeliverRows.length;

          if (!this.fetchedAllDbRows && oraAmountOfRows > 0) {
            apex.debug.info(
              `Query from oracle from ${oraFirstRow} #${oraAmountOfRows} rows`
            );

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
              apex.debug.info(`next row is ${nextRow}`);

              if (this.focusOnLoad && params.startRow === 0) {
                setTimeout(() => {
                  this.focus();
                }, 100);
              }

              this.dataCopy.push(...data);
              toDeliverRows.push(...data);

              if (oraAmountOfRows > data.length) {
                apex.debug.log(
                  `Less receaved than requested from oracle => end reached`
                );
                this.fetchedAllDbRows = true;
              }
            } else {
              apex.debug.error(
                `Could not fetch data from region #${
                  this.regionId
                }. Res => ${JSON.stringify(dataRes)}`
              );
              params.failCallback();
            }
          }

          const lastRow = this.fetchedAllDbRows
            ? this.dataCopy.length + this.newRows.length
            : -1;

          console.log('toDeliverRows after oracle', toDeliverRows);
          apex.debug.info(`last row is ${lastRow}`);
          params.successCallback(toDeliverRows, lastRow);
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

  focus() {
    const firstEditCol = this.gridOptions.columnApi.getAllDisplayedColumns()[0];
    this.gridOptions.api.ensureColumnVisible(firstEditCol);
    this.gridOptions.api.setFocusedCell(0, firstEditCol);
  }

  focusRow(rowNo) {
    const firstEditCol = this.gridOptions.columnApi.getAllDisplayedColumns()[0];
    this.gridOptions.api.ensureColumnVisible(firstEditCol);
    this.gridOptions.api.ensureIndexVisible(rowNo);
    this.gridOptions.api.setFocusedCell(rowNo, firstEditCol);
  }

  getSaveData() {
    const data = Array.from(this.changes.values());
    const pkIds = data.map((row) => row[IDX_COL]);
    const dataMap = {};
    data.forEach((row) => {
      dataMap[row[IDX_COL]] = row;
    });
    apex.debug.info('Saving data', dataMap);

    return { data: dataMap, pkCol: this.pkCol, pkIds };
  }

  #markRowDeleted(rowId) {
    apex.debug.info(`Marking row ${rowId} as deleted`);

    if (this.changes.has(rowId)) {
      const row = this.changes.get(rowId);
      row[ROW_ACITON] = 'D';
    } else {
      const rowNode = this.gridOptions.api.getRowNode(rowId);
      if (!rowNode) {
        apex.debug.error(`Could not find row with id ${rowId} in the grid.`);
        return;
      }

      const { data } = rowNode;
      data[ROW_ACITON] = 'D';
      this.changes.set(rowId, data);
    }

    $(`#${this.regionId} div[row-id="${rowId}"]`).addClass(
      'marked-for-deletion'
    );

    this.markChanges();
  }

  #createRow() {
    const row = {};

    this.gridOptions.columnApi.getAllDisplayedColumns().forEach((col) => {
      row[col.colId] = null;
    });

    row[IDX_COL] = new Date().getTime();

    return row;
  }

  #insertRow() {
    /*
    const rowNode = this.gridOptions.api.getRowNode(rowId);

    if (!rowNode) {
      apex.debug.error(`Could not find row with id ${rowId} in the grid.`);
      return;
    } */
    // const { rowIndex } = rowNode;
    // const insertIndex = where === 'above' ? rowIndex : rowIndex + 1;

    const newRow = this.#createRow();
    this.newRows.push(newRow);
    // this.dataCopy.splice(insertIndex, 0, newRow);

    newRow[ROW_ACITON] = 'C';
    this.changes.set(newRow[IDX_COL], newRow);

    const maxRowFound = this.gridOptions.api.isLastRowIndexKnown();
    if (maxRowFound) {
      const rowCount = this.gridOptions.api.getInfiniteRowCount() || 0;
      gridOptions.api.setRowCount(rowCount + 1);
    }

    // get grid to refresh the data
    gridOptions.api.refreshInfiniteCache();

    setTimeout(() => {
      this.focusRow(this.newRows.length - 1);
    }, 300);
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
        label: 'Insert row above',
        action: () => {
          this.#insertRow();
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
      apex.debug.info('Row id', currRowdId);
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
