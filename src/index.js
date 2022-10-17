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
      methods: [AJAX_COL_METADATA, AJAX_DATA],
    });

    this.gridOptions = getGridOptions({
      colMetaData: res.colMetaData,
      pkCol: this.pkCol,
    });
    this.grid = new AG_GRID(this.gridNode, this.gridOptions);

    this.gridOptions.api.setRowData(res.data);
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
