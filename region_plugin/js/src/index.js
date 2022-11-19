import { ajax, AJAX_COL_METADATA, AJAX_DATA } from './apex/ajax';
import './apex/initRegion';
import components from './gui-components';
import AG_GRID from './initGrid';
import { arrayBoolsToNum, arrayNumToBool } from './util/boolConversions';
import getNewRowId from './util/getNewRowId';

/** @type any */
const { apex } = window;
const $ = apex.jQuery;

const IDX_COL = '__idx';
const ROW_ACITON = '__row_action';
const DATA_LOAD_EVENT = 'dataLoadComplete';

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

  components,
};

class AgGrid extends HTMLElement {
  constructor() {
    super();

    this.ajaxId = this.getAttribute('ajaxId');
    this.itemsToSubmit = this.getAttribute('itemsToSubmit');
    this.regionId = this.getAttribute('regionId');
    this.pkCol = this.getAttribute('pkCol');
    this.focusOnLoad = this.getAttribute('focusOnLoad') === 'true';
    this.displayRownum = this.getAttribute('displayRownum') === 'true';

    this.contextMenuId = `${this.regionId}-context-menu`;

    this.amountOfRows = 30;

    this.changes = new Map();
    this.originalState = new Map();

    this.markedChanges = false;

    // unfortunately necessary for inserts...
    // see https://www.ag-grid.com/javascript-data-grid/infinite-scrolling/#example-using-cache-api-methods
    this.dataCopy = [];
    this.newRows = [];
    this.fetchedAllDbRows = false;

    this.boolCols = [];
    this.refreshCols = [];
    this.computedCols = [];
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
    const newData = event.data;
    const { field } = event.colDef;
    const { oldValue, newValue } = event;
    const oldData = { ...newData };
    oldData[field] = oldValue;

    apex.debug.info(
      `onCellEditRequest, updating ${field} to ${newValue} - event => `,
      event
    );

    const pkVal = newData[IDX_COL];

    // Set ROW_ACITON
    // !don't override insert or delete!
    if (this.changes.has(pkVal)) {
      newData[ROW_ACITON] = this.changes.get(pkVal)[ROW_ACITON];
    } else {
      newData[ROW_ACITON] = 'U';
    }

    // add change to changes map
    this.changes.set(pkVal, newData);
    this.markChanges();

    // set original state for revert
    if (!this.originalState.has(pkVal)) {
      apex.debug.info('Setting original state for', pkVal, oldData);
      this.originalState.set(pkVal, oldData);
    }

    // if there are reactive columns, refresh them
    this.refreshCols.forEach((col) => {
      this.gridOptions.api.refreshCells({
        force: true,
        rowNodes: [event.node],
        columns: [col],
      });
    });
  }

  #getGridOptions({ colMetaData }) {
    /** @type {import('@ag-grid-community/all-modules').ColDef[]} */
    const columnDefs = [];

    // wether to show the row number col
    if (this.displayRownum) {
      columnDefs.push({
        field: '__ROWNUM',
        editable: false,
        type: ['nonEdit'],
        cellClass: ['xag-center-aligned-cell', 'xag-rownum-col'],
        valueGetter: (params) => params.node.rowIndex + 1,
        headerName: '',
        maxWidth: 50,
      });
    }

    // internal index col, display as checkbox
    columnDefs.push({
      field: IDX_COL,
      editable: false,
      checkboxSelection: true,
      headerName: '',
      valueFormatter: () => '', // don't show any value in the column
      maxWidth: 50,
    });

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

      if (col.maxColWidth) {
        colDef.maxWidth = col.maxColWidth;
      }

      if (col.grid_data_type === 'Checkbox') {
        colDef.cellRenderer = 'checkboxRenderer';
        colDef.editable = false; // only show renderer as we can click the checkbox
        colDef.cellRendererParams = {
          disabled: !col.editable, // disable checkbox if not editable
        };
        this.boolCols.push(col.colname);
      } else if (col.grid_data_type === 'HTML_Value') {
        colDef.cellRenderer = 'htmlRenderer';
        colDef.cellRendererParams = {
          template: col.htmlTemplate,
        };

        // add to list of cols that need to be refreshed on change
        this.refreshCols.push(col.colname);
      } else if (col.grid_data_type === 'Dynamically_Computed_Value') {
        try {
          let __INT_FC;
          // eslint-disable-next-line no-eval
          eval(`__INT_FC = ${col.jsComputedValCode};`);
          colDef.valueGetter = (params) => {
            // I don't know why, in some examples I get rows with no id and data
            // Skip those rows
            if (!params.node.id) return '';

            // wrap in try catch to prevent errors from crashing the grid
            try {
              return __INT_FC(params);
            } catch (e) {
              apex.debug.error(
                `Cannot evaluate ${
                  col.colname
                } value for following row: ${JSON.stringify(params.data)}`,
                e
              );
              return 'Error computing value';
            }
          };
        } catch (e) {
          apex.debug.error(
            `Invalid computation function for ${col.colname}`,
            e
          );
        }

        types.push('nonEdit');
        cellClasses.push('xag-read-only-cell');

        this.computedCols.push(col.colname);
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
            `asking for ${params.startRow} - ${params.endRow}. New rows: ${this.newRows.length}`
          );

          let toDeliverRows = [];
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

          apex.debug.info('toDeliverRows after inserted', toDeliverRows);

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

          apex.debug.info('toDeliverRows after cache', toDeliverRows);

          const oraFirstRow =
            params.startRow === 0
              ? 1 // Oracle starts with 1
              : params.startRow + 1 - this.newRows.length;
          const oraAmountOfRows = wantedRows - toDeliverRows.length;

          apex.debug.info(
            `Fetch oracle? fetchedAllDbRows => ${this.fetchedAllDbRows}, oraAmountOfRows => ${oraAmountOfRows}`
          );
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
                data[i][IDX_COL] = data[i][this.pkCol].toString();
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
          } else {
            apex.debug.info('No need to fetch from oracle');
          }

          const lastRow = this.fetchedAllDbRows
            ? this.dataCopy.length + this.newRows.length
            : -1;

          apex.debug.info('toDeliverRows after oracle', toDeliverRows);
          apex.debug.info(`last row is ${lastRow}`);

          if (this.boolCols.length > 0) {
            apex.debug.info(
              `Converting bool cols (${this.boolCols.join(', ')})`
            );

            toDeliverRows = arrayNumToBool(toDeliverRows, this.boolCols);
          }

          params.successCallback(toDeliverRows, lastRow);

          const event = new Event(DATA_LOAD_EVENT);
          this.gridNode.dispatchEvent(event);
        } catch (err) {
          apex.debug.error(
            `Error fetching data from region #${
              this.regionId
            }. Err => ${JSON.stringify(err)}, ${err}`
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
    let data = Array.from(this.changes.values());

    if (this.boolCols.length > 0) {
      data = arrayBoolsToNum(data, this.boolCols);
    }

    const pkIds = data.map((row) => row[IDX_COL]);
    const dataMap = {};

    if (this.computedCols.length === 0) {
      data.forEach((row) => {
        dataMap[row[IDX_COL]] = row;
      });
    } else {
      // computed cols are not in the data, so we need to fetch them from the grid manually
      data.forEach((row) => {
        const rowdata = { ...row }; // copy
        const rowNode = this.gridOptions.api.getRowNode(row[IDX_COL]);

        this.computedCols.forEach((col) => {
          rowdata[col] = this.gridOptions.api.getValue(col, rowNode);
        });

        dataMap[row[IDX_COL]] = rowdata;
      });
    }

    apex.debug.info('Saving data', dataMap);

    return { data: dataMap, pkCol: this.pkCol, pkIds };
  }

  /**
   * Because the infinite scrolling model relies on the server as data source
   * it is not as trivial to change the amount of rows in the client
   *
   * This function gets calles when a change to the amount of rows is triggered.
   * It will clear the cash load all the rows again (from client side chache) and redraw the grid
   * to get the correct rows.
   */
  #refreshDataAndRedraw() {
    // when data is loaded we want to redraw the grid
    // this is necessary as row IDs are not in sync without the redraw
    this.gridNode.addEventListener(
      DATA_LOAD_EVENT,
      () => {
        setTimeout(() => {
          this.gridOptions.api.redrawRows();
        }, 0);
      },
      { once: true }
    );

    // get grid to refresh the data
    gridOptions.api.refreshInfiniteCache();
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
      this.originalState.set(rowId, data);
      data[ROW_ACITON] = 'D';
      this.changes.set(rowId, data);
    }

    $(`#${this.regionId} div[row-id="${rowId}"]`).addClass(
      'marked-for-deletion'
    );

    this.markChanges();
  }

  #isMarkedForDeletion(rowId) {
    if (this.changes.has(rowId)) {
      const row = this.changes.get(rowId);
      return row[ROW_ACITON] === 'D';
    }
    return false;
  }

  #createRow() {
    const row = {};

    this.gridOptions.columnApi.getAllDisplayedColumns().forEach((col) => {
      // @ts-ignore
      row[col.colId] = undefined;
    });

    row[IDX_COL] = getNewRowId();

    return row;
  }

  #insertRow() {
    const newRow = this.#createRow();
    this.newRows.push(newRow);

    newRow[ROW_ACITON] = 'C';
    this.changes.set(newRow[IDX_COL], newRow);

    const maxRowFound = this.gridOptions.api.isLastRowIndexKnown();
    if (maxRowFound) {
      const rowCount = this.gridOptions.api.getInfiniteRowCount() || 0;
      gridOptions.api.setRowCount(rowCount + 1);
    }

    this.#refreshDataAndRedraw();

    setTimeout(() => {
      this.focusRow(this.newRows.length - 1);
    }, 300);
  }

  #duplicateRow(rowId) {
    apex.debug.info(`Duplicating row ${rowId}`);

    const newRow = { ...this.gridOptions.api.getRowNode(rowId).data }; // create a copy of the row
    newRow[IDX_COL] = getNewRowId();
    newRow[this.pkCol] = undefined; // reset pk val
    this.newRows.push(newRow);

    newRow[ROW_ACITON] = 'C';
    this.changes.set(newRow[IDX_COL], newRow);

    const maxRowFound = this.gridOptions.api.isLastRowIndexKnown();
    if (maxRowFound) {
      const rowCount = this.gridOptions.api.getInfiniteRowCount() || 0;
      gridOptions.api.setRowCount(rowCount + 1);
    }

    this.#refreshDataAndRedraw();

    setTimeout(() => {
      this.focusRow(this.newRows.length - 1);
    }, 300);
  }

  #revertChanges(rowId) {
    apex.debug.info(`Reverting changes for row ${rowId}`);

    if (this.changes.has(rowId)) {
      const row = this.changes.get(rowId);
      if (row[ROW_ACITON] === 'C') {
        this.newRows = this.newRows.filter((r) => r[IDX_COL] !== rowId);
        this.changes.delete(rowId);

        // subtract 1 from row count
        const maxRowFound = this.gridOptions.api.isLastRowIndexKnown();
        if (maxRowFound) {
          const rowCount = this.gridOptions.api.getInfiniteRowCount() || 0;
          gridOptions.api.setRowCount(rowCount - 1);
        }

        this.#refreshDataAndRedraw();
      } else {
        this.changes.delete(rowId);

        const oldData = this.originalState.get(rowId);
        apex.debug.info('Resetting to old data', oldData);

        gridOptions.api.getRowNode(rowId).setData(oldData);

        if (row[ROW_ACITON] === 'D') {
          $(`#${this.regionId} div[row-id="${rowId}"]`).removeClass(
            'marked-for-deletion'
          );
        }
      }
    }
  }

  #setupContextMenu() {
    let currRowdId = null;
    const $contextMenu = $(`#${this.contextMenuId}`);

    const menuList = [
      {
        type: 'action',
        label: 'Insert new row',
        icon: 'fa fa-plus',
        action: () => {
          this.#insertRow();
        },
      },
      {
        type: 'action',
        label: 'Duplicate row',
        icon: 'fa fa-clone',
        action: () => {
          this.#duplicateRow(currRowdId);
        },
      },
      {
        type: 'action',
        label: 'Delete row',
        icon: 'fa fa-trash',
        action: () => {
          this.#markRowDeleted(currRowdId);
        },
        disabled: () => this.#isMarkedForDeletion(currRowdId),
      },
      {
        type: 'action',
        label: 'Revert changes',
        icon: 'fa fa-undo',
        action: () => {
          this.#revertChanges(currRowdId);
        },
        disabled: () => !this.changes.has(currRowdId),
      },
    ];

    $contextMenu.menu({
      iconType: 'fa',
      items: menuList,
    });

    $(`#${this.regionId}`).on('contextmenu', '.ag-row', (e) => {
      e.preventDefault();
      currRowdId = e.currentTarget.getAttribute('row-id').toString();
      apex.debug.info('Row id', currRowdId, typeof currRowdId);
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

  refresh() {
    this.newRows = [];
    this.dataCopy = [];
    this.fetchedAllDbRows = false;

    this.changes.clear();
    this.originalState.clear();

    this.#refreshDataAndRedraw();
  }

  saveSuccess() {
    this.changes.clear();
    this.refresh();
  }
}

window.customElements.define('p-ag-grid', AgGrid);
