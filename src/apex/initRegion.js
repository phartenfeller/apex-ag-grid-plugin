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

function _initPlugin({ regionId, ajaxId, itemsToSubmit, pkCol }) {
  apex.debug.info(
    `Init AG Grid plugin with params => ${JSON.stringify({
      regionId,
      ajaxId,
      itemsToSubmit,
      pkCol,
    })}`
  );

  const gridElement = document.createElement('p-ag-grid');
  gridElement.regionId = regionId;
  gridElement.ajaxId = ajaxId;
  gridElement.itemsToSubmit = itemsToSubmit;
  gridElement.pkCol = pkCol;

  document
    .querySelector(`#${regionId}_component_wrapper`)
    .appendChild(gridElement);

  apex.region.create(regionId, {
    refresh: () => {
      // const spinner = apex.util.showSpinner(apex.jQuery(`#${regionId}`));
      // try {
      //   _resetText(regionId);
      //   apex.server.plugin(
      //     ajaxId,
      //     {
      //       pageItems: itemsToSubmit,
      //     },
      //     {
      //       success(data) {
      //         spinner.remove();
      //         _handleData(data, regionId);
      //       },
      //       error(err) {
      //         _handleError(err, regionId, spinner);
      //       },
      //       dataType: 'json',
      //     }
      //   );
      // } catch (err) {
      //   _handleError(err, regionId, spinner);
      // }
    },
  });
}

if (!window.hartenfeller_dev) {
  window.hartenfeller_dev = {};
}
if (!window.hartenfeller_dev.plugins) {
  window.hartenfeller_dev.plugins = {};
}

window.hartenfeller_dev.plugins.ag_grid = {
  initPlugin: _initPlugin,
};
