class NoRowsOverlay {
  init(params) {
    this.addRow = params.addRow;

    this.eGui = document.createElement('div');
    this.eGui.innerHTML = `
    <div role="region" aria-label="No Rows found" class="t-Alert t-Alert--horizontal t-Alert--defaultIcons t-Alert--info lto72012985374611101_0" id="${params.regionId}_no_rows" style="pointer-events: auto;">
  <div class="t-Alert-wrap">
    <div class="t-Alert-icon">
      <span class="t-Icon " aria-hidden="true"></span>
    </div>
    <div class="t-Alert-content">
      <div class="t-Alert-header">
        <h2 class="t-Alert-title" id="${params.regionId}_no_rows_heading" data-apex-heading="">No Rows found</h2>
      </div>
      <div class="ag-grid-alert-body t-Alert-body margin-top-md"></div>
    </div>
    <div class="t-Alert-buttons"></div>
  </div>
</div>`;

    this.button = document.createElement('button');
    this.button.innerHTML = `<span aria-hidden="true" class="t-Icon t-Icon--left fa fa-plus"></span>Add Row`;
    this.button.type = 'button';
    this.button.classList.add(
      't-Button',
      't-Button--icon',
      't-Button--iconLeft'
    );
    this.button.addEventListener('click', this.clickHandler.bind(this));

    this.eGui
      .querySelector('.ag-grid-alert-body.t-Alert-body')
      .appendChild(this.button);
  }

  clickHandler() {
    this.addRow();
  }

  getGui() {
    return this.eGui;
  }
}

export default NoRowsOverlay;
