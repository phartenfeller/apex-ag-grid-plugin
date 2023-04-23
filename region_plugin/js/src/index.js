import { ajax, AJAX_COL_METADATA } from './apex/ajax';
import './apex/initRegion';
import fetchData from './dataFetcher';
import components from './gui-components';
import NoRowsOverlay from './gui-components/NoRowsOverlay';
import AG_GRID from './initGrid';
import { arrayBoolsToNum } from './util/boolConversions';
import {
  clearCopyIndicator,
  copyValue,
  getClipboardText,
  getLastCopiedColId,
  markPaste,
} from './util/copyHelper';
import getNewRowId from './util/getNewRowId';
import {
  getCopyShortcutText,
  getPasteShortcutText,
  getSelectionPasteShortcutText,
  isCopyKeyCombo,
  isPasteKeyCombo,
  isSelectionPasteKeyCombo,
} from './util/keyboardShortcutHelper';

/** @type any */
const { apex } = window;
const $ = apex.jQuery;

const IDX_COL = '__idx';
const ROW_ACITON = '__row_action';

/** @type {import('@ag-grid-community/core').GridOptions} */
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

  rowModelType: 'clientSide',

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
    this.pageSize = parseInt(this.getAttribute('pageSize'));

    this.colFunctions = this.getAttribute('colFunctions') ?? {};

    this.contextMenuId = `${this.regionId}-context-menu`;

    this.changes = new Map();
    this.originalState = new Map();

    this.markedChanges = false;
    this.regionElement = undefined;
    this.eBody = undefined;
    this.eViewport = undefined;

    this.boolCols = [];
    this.refreshCols = [];
    this.computedCols = [];

    this.firstEditCol = undefined;
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
    /** @type {import('@ag-grid-community/core').ColDef[]} */
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
      } else if (!this.firstEditCol) {
        this.firstEditCol = col.colname;
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

      /** @type {import('@ag-grid-community/core').ColDef} */
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
          colDef.valueGetter = (params) => {
            // I don't know why, in some examples I get rows with no id and data
            // Skip those rows
            if (!params.node.id) return '';

            // wrap in try catch to prevent errors from crashing the grid
            try {
              return this.colFunctions[col.colname](params); // 'temp..'; // __INT_FC(params);
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

    // no editable columns, set first col as firstEditCol (for focus)
    if (!this.firstEditCol) {
      this.firstEditCol = columnDefs[0].colId;
    }

    gridOptions.columnDefs = columnDefs;

    gridOptions.getRowId = (params) => params.data[IDX_COL];

    gridOptions.infiniteInitialRowCount = this.pageSize;
    gridOptions.cacheBlockSize = this.pageSize;
    gridOptions.cacheOverflowSize = 1;
    gridOptions.onBodyScroll = this.#handleScroll.bind(this);

    const boundHandleChange = this.#handleChange.bind(this);
    gridOptions.onCellValueChanged = boundHandleChange;

    gridOptions.onCellKeyPress = this.#handleKeyPress.bind(this);

    gridOptions.noRowsOverlayComponent = NoRowsOverlay;
    gridOptions.noRowsOverlayComponentParams = {
      addRow: () => {
        this.addRow();
        setTimeout(() => {
          this.focus();
        }, 100);
      },
      regionId: this.regionId,
    };

    return gridOptions;
  }

  #insertRows(newRows) {
    // const rowcount = gridOptions.api?.getDisplayedRowCount();
    apex.debug.info(`Adding new rows`, newRows);
    this.gridOptions.api.applyTransaction({
      add: newRows,
      // addIndex: rowcount,
    });
  }

  async #fetchMoreRows(insertRows = true) {
    const newRows = await fetchData({
      apex,
      ajaxId: this.ajaxId,
      itemsToSubmit: this.itemsToSubmit,
      regionId: this.regionId,
      amountOfRows: this.pageSize,
      IDX_COL,
      pkCol: this.pkCol,
      boolCols: this.boolCols,
    });
    if (newRows?.length > 0 && insertRows) {
      this.#insertRows(newRows);
    }
    return newRows;
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
    this.regionElement = document.querySelector(`#${this.regionId}`);

    const initialRows = await this.#fetchMoreRows(false);
    this.gridOptions.api.setRowData(initialRows);

    if (this.focusOnLoad) {
      setTimeout(() => {
        this.focus();
      }, 100);
    }

    // this.gridOptions.api.setRowData(res.data);
  }

  #handleScroll(e) {
    if (e.direction !== 'vertical') {
      return;
    }

    if (!this.eBody) {
      this.eBody = this.regionElement.querySelector(`div[ref="eBody"]`);
    }

    const regionHeight = this.eBody.clientHeight;

    if (!this.eViewport) {
      this.eViewport = this.regionElement.querySelector(`div[ref="eViewport"]`);
    }
    const viewportHeight = this.eViewport.clientHeight;
    const scrollTop = e.top;

    // 200 px to the bottom
    if (viewportHeight - regionHeight - scrollTop <= 400) {
      this.#fetchMoreRows();
    }
  }

  focus() {
    const idx = 0;
    this.gridOptions.api.ensureColumnVisible(this.firstEditCol);
    this.gridOptions.api.ensureIndexVisible(idx);
    this.gridOptions.api.setFocusedCell(idx, this.firstEditCol);
  }

  /**
   * Focuses first cell of the row at the given index
   * @param {number} rowIndex
   */
  focusRow(rowIndex) {
    const firstEditCol = this.gridOptions.columnApi.getAllDisplayedColumns()[0];
    this.gridOptions.api.ensureColumnVisible(firstEditCol);
    this.gridOptions.api.ensureIndexVisible(rowIndex);
    this.gridOptions.api.setFocusedCell(rowIndex, this.firstEditCol);
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

  addRow(currRowdId) {
    const newRow = this.#createRow();

    newRow[ROW_ACITON] = 'C';
    this.changes.set(newRow[IDX_COL], newRow);

    let node;
    if (!currRowdId) {
      node = this.gridOptions.api.getRowNode(currRowdId);
    }

    this.gridOptions.api.applyTransaction({
      add: [newRow],
      addIndex: node ? node.rowIndex + 1 : undefined,
    });

    if (node) {
      setTimeout(() => {
        this.focusRow(node.rowIndex + 1);
      }, 50);
    }
  }

  #duplicateRow(rowId) {
    apex.debug.info(`Duplicating row ${rowId}`);

    const newRow = { ...this.gridOptions.api.getRowNode(rowId).data }; // create a copy of the row
    newRow[IDX_COL] = getNewRowId();
    newRow[this.pkCol] = undefined; // reset pk val

    newRow[ROW_ACITON] = 'C';
    this.changes.set(newRow[IDX_COL], newRow);

    const node = this.gridOptions.api.getRowNode(rowId);

    this.gridOptions.api.applyTransaction({
      add: [newRow],
      addIndex: node.rowIndex + 1,
    });

    setTimeout(() => {
      this.focusRow(node.rowIndex + 1);
    }, 50);
  }

  #revertChanges(rowId) {
    apex.debug.info(`Reverting changes for row ${rowId}`);

    if (this.changes.has(rowId)) {
      const row = this.changes.get(rowId);
      if (row[ROW_ACITON] === 'C') {
        this.changes.delete(rowId);

        this.gridOptions.api.applyTransaction({
          remove: [row],
        });
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

  #copyCell(rowId, colId, clickedColElement) {
    const rowNode = this.gridOptions.api.getRowNode(rowId);
    if (!rowNode) {
      apex.debug.error(`Could not find row with id ${rowId} in the grid.`);
      return;
    }

    const { data } = rowNode;
    const cellValue = data[colId];

    apex.debug.info(
      `Copying cell value ${cellValue} from row ${rowId}, col ${colId}`
    );
    copyValue({
      value: cellValue,
      rowId,
      colId,
      clickedColElement,
      regionId: this.regionId,
    });
  }

  async #pasteCell(currRowdId, currColId, clickedColElement) {
    const rowNode = this.gridOptions.api.getRowNode(currRowdId);
    if (!rowNode) {
      apex.debug.error(`Could not find row with id ${currRowdId} in the grid.`);
      return;
    }

    const { data } = rowNode;
    const cellValue = data[currColId];

    const clipboard = await getClipboardText();
    if (clipboard === null || clipboard === undefined || clipboard === '') {
      apex.debug.warn('Clipboard is empty, nothing to paste.');
      return;
    }
    data[currColId] = clipboard;

    rowNode.setData(data);
    clearCopyIndicator(this.regionId);
    markPaste(clickedColElement);

    /*
    this.gridOptions.api.refreshCells({
      force: true,
      rowNodes: [rowNode],
      columns: [currRowdId],
    });
    */

    apex.debug.info(
      `Pasting cell value ${cellValue} from row ${currRowdId}, col ${currColId}`
    );
  }

  async #pasteSelectedRows() {
    const clipboard = await getClipboardText();
    if (clipboard === null || clipboard === undefined || clipboard === '') {
      apex.debug.warn('Clipboard is empty, nothing to paste.');
      return;
    }

    const colId = getLastCopiedColId();
    if (!colId) {
      apex.debug.warn(
        'No column was copied before, can`t determine where to paste.'
      );
      return;
    }

    this.gridOptions.api.getSelectedNodes().forEach((rowNode) => {
      const { data } = rowNode;
      data[colId] = clipboard;
      rowNode.setData(data);

      const element = this.regionElement.querySelector(
        `div[row-id="${rowNode.id}"] div[col-id="${colId}"]`
      );
      markPaste(element);
    });

    clearCopyIndicator(this.regionId);
  }

  #setupContextMenu() {
    let currRowdId = null;
    let currColId = null;
    let currColElement = null;
    const $contextMenu = $(`#${this.contextMenuId}`);

    const menuList = [
      {
        type: 'action',
        label: 'Insert new row',
        icon: 'fa fa-plus',
        action: () => {
          this.addRow(currRowdId);
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
        type: 'separator',
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
      {
        type: 'action',
        label: 'Copy cell',
        icon: 'fa fa-copy',
        action: () => {
          this.#copyCell(currRowdId, currColId, currColElement);
        },
        accelerator: getCopyShortcutText(),
      },
      {
        type: 'action',
        label: 'Paste',
        icon: 'fa fa-paste',
        action: () => {
          this.#pasteCell(currRowdId, currColId, currColElement);
        },
        accelerator: getPasteShortcutText(),
      },
      {
        type: 'action',
        label: 'Paste to selected rows',
        icon: 'fa fa-paste fam-check fam-is-disabled',
        action: () => {
          this.#pasteSelectedRows();
        },
        accelerator: getSelectionPasteShortcutText(),
      },
    ];

    $contextMenu.menu({
      iconType: 'fa',
      items: menuList,
    });

    $(`#${this.regionId}`).on('contextmenu', '.ag-cell', (e) => {
      e.preventDefault();
      currColElement = e.currentTarget;
      currRowdId = e.currentTarget
        .closest('.ag-row')
        .getAttribute('row-id')
        .toString(); // e.currentTarget.getAttribute('row-id').toString();
      currColId = e.currentTarget.getAttribute('col-id');
      apex.debug.info('Row id', currRowdId, typeof currRowdId);
      apex.debug.info('Col id', currColId, typeof currColId);
      $contextMenu.menu('toggle', e.pageX, e.pageY);
    });
  }

  connectedCallback() {
    const wrapperNode = document.createElement('div');

    this.gridNode = document.createElement('div');
    this.gridNode.classList.add('ag-theme-apex');
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
    this.changes.clear();
    this.originalState.clear();
  }

  saveSuccess() {
    this.changes.clear();
    this.refresh();
  }

  #handleKeyPress(e) {
    apex.debug.info('KeyPressed', e.event.key, e);

    if (e.event.key === 'Escape') {
      clearCopyIndicator(this.regionId);
    } else if (isCopyKeyCombo(e.event)) {
      this.#copyCell(e.node.id, e.column.colId, e.event.target);
    } else if (isSelectionPasteKeyCombo(e.event)) {
      this.#pasteSelectedRows();
    } else if (isPasteKeyCombo(e.event)) {
      this.#pasteCell(e.node.id, e.column.colId, e.event.target);
    }
  }
}

window.customElements.define('p-ag-grid', AgGrid);
