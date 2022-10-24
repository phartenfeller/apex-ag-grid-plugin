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
  defaultColDef: { sortable: true, filter: true, flex: 1, minWidth: 100 },

  rowSelection: 'multiple', // allow rows to be selected
  suppressRowClickSelection: true,

  animateRows: true, // have rows animate to new positions when sorted

  rowModelType: 'infinite',

  columnTypes: {
    nonEdit: { editable: false, cellClass: ['xag-read-only-cell'] },
    headerLeft: { headerClass: ['ag-left-aligned-header'] },
    headerRight: { headerClass: ['ag-right-aligned-header'] },
    contentLeft: { cellClass: ['ag-left-aligned-cell'] },
    contentRight: { cellClass: ['ag-right-aligned-cell'] },
    contentCenter: { cellClass: ['xag-center-aligned-cell'] },
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
  }

  hasChanges() {
    return this.changes.size > 0;
  }

  markChanges() {
    if (!this.markedChanges) {
      apex.page.warnOnUnsavedChanges(
        'There are unsaved changes',
        this.hasChanges()
      );
      this.markedChanges = true;
    }
  }

  // eslint-disable-next-line class-methods-use-this
  #handleChange(event, instance) {
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
    if (instance.changes.has(pkVal)) {
      newData[ROW_ACITON] = instance.changes.get(pkVal)[ROW_ACITON];
    } else {
      newData[ROW_ACITON] = 'U';
    }

    instance.changes.set(pkVal, newData);

    instance.markChanges();
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
      },
    ];

    colMetaData.forEach((col) => {
      const types = [];

      if (!col.editable) types.push('nonEdit');

      if (col.heading_alignment === 'RIGHT') {
        types.push('headerRight');
      } else {
        types.push('headerLeft');
      }

      if (col.value_alignment === 'CENTER') {
        types.push('contentCenter');
      } else if (col.value_alignment === 'RIGHT') {
        types.push('contentRight');
      } else {
        types.push('contentLeft');
      }

      /** @type {import('@ag-grid-community/all-modules').ColDef} */
      const colDef = {
        colId: col.colname,
        field: col.colname,
        headerName: col.heading ?? col.colname,
        editable: col.editable,
        hide: !col.is_visible,
        type: types,
      };

      if (col.number_format) {
        colDef.valueFormatter = (params) =>
          apex.locale.formatNumber(params.value, col.number_format);
      }

      columnDefs.push(colDef);
    });

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
          apex.debug.info(`asking for ${params.startRow} to ${params.endRow}`);

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

            if (this.focusOnLoad && params.startRow === 0) {
              setTimeout(() => {
                this.focus();
              }, 100);
            }

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

  focus() {
    const firstEditCol = this.gridOptions.columnApi.getAllDisplayedColumns()[0];
    this.gridOptions.api.ensureColumnVisible(firstEditCol);
    this.gridOptions.api.setFocusedCell(0, firstEditCol);
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
