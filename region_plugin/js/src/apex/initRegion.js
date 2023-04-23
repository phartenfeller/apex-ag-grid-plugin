const { apex } = window;

/*
function _handleError(err, regionId, spinner) {
  try {
    if (spinner) spinner.remove();
    el.textContent = 'An unexpected error has occurred';
  } catch (e) {
    apex.debug.warn(`Could not handle error in Display CLOB Redux: ${e}`);
  }
  apex.debug.error(`Error in Display CLOB Redux: ${JSON.stringify(err)}`);
}
*/

const colFunctions = {};

function _addComputedColCode({ regionId, colname, fc }) {
  apex.debug.info(`Add computed col code for region ${regionId}, ${colname}`);

  if (!colFunctions[regionId]) {
    colFunctions[regionId] = {};
  }

  colFunctions[regionId][colname] = fc;
}

function _initPlugin({
  regionId,
  ajaxId,
  itemsToSubmit,
  pkCol,
  focusOnLoad,
  displayRownum,
  pageSize,
}) {
  apex.debug.info(
    `Init AG Grid plugin with params => ${JSON.stringify({
      regionId,
      ajaxId,
      itemsToSubmit,
      pkCol,
      focusOnLoad,
      displayRownum,
      pageSize,
    })}`
  );

  let usedPageSize = pageSize;

  if (!pageSize) {
    apex.debug.warn(`No page size provided, falling back to 30...`);
    usedPageSize = 30;
  } else if (pageSize < 15) {
    apex.debug.warn(
      `Provided page size (${pageSize}) < minimum of 15, falling back to 15...`
    );
    usedPageSize = 15;
  }

  /** @type any */
  const gridElement = document.createElement('p-ag-grid');
  gridElement.id = `${regionId}-component`;
  gridElement.regionId = regionId;
  gridElement.ajaxId = ajaxId;
  gridElement.itemsToSubmit = itemsToSubmit;
  gridElement.pkCol = pkCol;
  gridElement.focusOnLoad = focusOnLoad === 'Y';
  gridElement.displayRownum = displayRownum === 'Y';
  gridElement.pageSize = usedPageSize;

  gridElement.colFunctions = colFunctions[regionId];

  document
    .querySelector(`#${regionId}_component_wrapper`)
    .appendChild(gridElement);

  apex.region.create(regionId, {
    getSaveData: () => gridElement.getSaveData(),
    focus: () => gridElement.focus(),
    saveSuccess: () => gridElement.saveSuccess(),
    refresh: () => gridElement.refresh(),
    addRow: () => gridElement.addRow(),
  });

  // empty temporary col functions storage after init
  colFunctions[regionId] = {};
}

if (!window.hartenfeller_dev) {
  window.hartenfeller_dev = {};
}
if (!window.hartenfeller_dev.plugins) {
  window.hartenfeller_dev.plugins = {};
}

window.hartenfeller_dev.plugins.ag_grid = {
  initPlugin: _initPlugin,
  addComputedColCode: _addComputedColCode,
};
