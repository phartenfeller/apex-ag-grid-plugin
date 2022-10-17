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
  }

  async setupGrid() {
    const res = await ajax({
      apex,
      ajaxId: this.ajaxId,
      itemsToSubmit: this.itemsToSubmit,
      regionId: this.regionId,
      methods: [AJAX_COL_METADATA, AJAX_DATA],
    });

    this.gridOptions = getGridOptions(res.colMetaData);
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
