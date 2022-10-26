/* global apex */

let spinner;

function showSpinner({ apex, regionId }) {
  spinner = apex.util.showSpinner(apex.jQuery(`#${regionId}`));
}

function hideSpinner() {
  if (spinner) {
    spinner.remove();
    spinner = null;
  }
}

function _saveGrid({ regionId, ajaxId }) {
  try {
    const { data, pkCol, pkIds } = apex.region(regionId).getSaveData();
    if (pkIds.length === 0) {
      return;
    }

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
          apex.region(regionId).saveSuccess();
          apex.message.showPageSuccess('Changes saved!');
        },
        error(err) {
          hideSpinner();
          apex.debug.error(
            `Error in AG Grid Plugin (#${regionId}): ${JSON.stringify(err)}`
          );

          let sqlMsg = '';

          const techInfo = err?.responseJSON?.techInfo;
          if (techInfo) {
            const sqlErr = techInfo.find((t) => t?.name === 'ora_sqlerrm');
            sqlMsg = sqlErr?.value;
          }

          const errorMessage = `${'Error saving data... |'} ${sqlMsg}`;

          apex.message.showErrors({
            type: 'error',
            location: 'page',
            message: errorMessage,
          });
        },
        dataType: 'json',
      }
    );
  } catch (err) {
    hideSpinner();
    apex.debug.error(
      `Error in AG Grid Plugin (#${regionId}): ${JSON.stringify(err)}`
    );

    apex.message.showErrors({
      type: 'error',
      location: 'page',
      message: 'Unexpected error saving data',
    });
  }
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
