/* global apex */

let spinner;

export function showSpinner({ apex, regionId }) {
  spinner = apex.util.showSpinner(apex.jQuery(`#${regionId}`));
}

export function hideSpinner() {
  if (spinner) {
    spinner.remove();
    spinner = null;
  }
}

function _saveGrid({ regionId, ajaxId }) {
  const { data, pkCol, pkIds } = apex.region(regionId).getSaveData();

  showSpinner({ apex, regionId });

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
      success() {
        hideSpinner();
        apex.message.showPageSuccess('Changes saved!');
      },
      error(err) {
        hideSpinner();
        apex.debug.error(
          `Error in AG Grid Plugin (#${regionId}): ${JSON.stringify(err)}`
        );
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
