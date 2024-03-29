import { hideSpinner, showSpinner } from './spinner';

export const AJAX_COL_METADATA = 'colMetadata';
export const AJAX_DATA = 'data';

export function ajax({
  apex,
  ajaxId,
  itemsToSubmit,
  regionId,
  methods = [],
  firstRow = null,
  amountOfRows = 30,
}) {
  return new Promise((resolve, reject) => {
    if (methods?.length === 0) {
      const msg = 'No methods provided to fetch data from';
      apex.debug.error(msg);
      reject(msg);
    }

    showSpinner({ apex, regionId });

    apex.server.plugin(
      ajaxId,
      {
        pageItems: itemsToSubmit,
        x01: methods.join(':'),
        x02: firstRow,
        x03: amountOfRows,
      },
      {
        success(data) {
          hideSpinner();
          resolve(data);
        },
        error(err) {
          hideSpinner();
          apex.debug.error(
            `Error in AG Grid Plugin (#${regionId}): ${JSON.stringify(err)}`
          );
          reject(err);
        },
        dataType: 'json',
      }
    );
  });
}
