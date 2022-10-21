/* global apex */

function _saveGrid({ regionId, ajaxId }) {
  const { data, pkCol, pkIds } = apex.region(regionId).getSaveData();

  apex.server.plugin(
    ajaxId,
    {
      regions: [
        {
          data,
        },
      ],
      pageItems: undefined,
      x01: pkCol,
      x02: pkIds.join(':'),
    },
    {
      success(res) {
        //  hideSpinner();
        console.log('Success: ', res);
        //  resolve(data);
      },
      error(err) {
        //    hideSpinner();
        apex.debug.error(
          `Error in AG Grid Plugin (#${regionId}): ${JSON.stringify(err)}`
        );
        // reject(err);
      },
      dataType: 'json',
    }
  );
}

if (!window.hartenfeller_dev) {
  window.hartenfeller_dev = {};
}
if (!window.hartenfeller_dev.plugins) {
  window.hartenfeller_dev.plugins = {};
}

window.hartenfeller_dev.plugins.ag_grid_da = {
  saveGrid: _saveGrid,
};
