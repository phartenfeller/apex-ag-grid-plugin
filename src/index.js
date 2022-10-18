import { ajax, AJAX_COL_METADATA, AJAX_DATA } from './apex/ajax';
import './apex/initRegion';
import getGridOptions from './getGridOptions';
import AG_GRID from './initGrid';

const { apex } = window;

class AgGrid extends HTMLElement {
  constructor() {
    super();

    this.ajaxId = this.getAttribute('ajaxId');
    this.itemsToSubmit = this.getAttribute('itemsToSubmit');
    this.regionId = this.getAttribute('regionId');
    this.pkCol = this.getAttribute('pkCol');

    this.amountOfRows = 30;
  }

  async setupGrid() {
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

    this.gridOptions = getGridOptions({
      colMetaData: res.colMetaData,
      pkCol: this.pkCol,
      amountOfRows: this.amountOfRows,
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

  connectedCallback() {
    this.gridNode = document.createElement('div');
    this.gridNode.classList.add('ag-theme-alpine');
    this.gridNode.style.height = '500px';

    this.appendChild(this.gridNode);

    this.setupGrid();
  }
}

window.customElements.define('p-ag-grid', AgGrid);
