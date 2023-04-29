import { ajax, AJAX_DATA } from './apex/ajax';
import { IS_OFFLINE_MODE } from './constants';
import { arrayNumToBool } from './util/boolConversions';

let nextRow = 1;
let fetchedAllDbRows = false;

let currentlyFetching = false;

async function fetchData({
  apex,
  ajaxId,
  itemsToSubmit,
  regionId,
  amountOfRows,
  IDX_COL,
  pkCol,
  boolCols,
  storageKey,
}) {
  if (fetchedAllDbRows) {
    apex.debug.trace(`All rows fetched from oracle`);
    return [];
  }

  if (currentlyFetching) {
    return [];
  }

  currentlyFetching = true;

  try {
    const firstRow = nextRow;

    if (!IS_OFFLINE_MODE) {
      apex.debug.info(
        `Query from oracle from ${firstRow} #${amountOfRows} rows`
      );

      const dataRes = await ajax({
        apex,
        ajaxId,
        itemsToSubmit,
        regionId,
        methods: [AJAX_DATA],
        firstRow,
        amountOfRows,
      });

      if (dataRes.data) {
        let { data } = dataRes;
        for (let i = 0; i < data.length; i++) {
          data[i][IDX_COL] = data[i][pkCol].toString();
        }

        nextRow = firstRow + data.length;
        apex.debug.info(`next row is ${nextRow}`);

        if (amountOfRows > data.length) {
          apex.debug.info(
            `Less received than requested from oracle => end reached`
          );
          fetchedAllDbRows = true;
        }

        if (boolCols.length > 0) {
          apex.debug.info(`Converting bool cols (${boolCols.join(', ')})`);

          data = arrayNumToBool(data, boolCols);
        }

        return data;
      }
      apex.debug.error(
        `Could not fetch data from region #${regionId}. Res => ${JSON.stringify(
          dataRes
        )}`
      );

      return [];
    }
    apex.debug.info(
      `Query from offline storage (${storageKey}): from ${firstRow} #${amountOfRows} rows`
    );

    let data = await window.hartenfeller_dev.plugins.sync_offline_data.storages[
      storageKey
    ].getRows({ offset: firstRow - 1, maxRows: amountOfRows });

    for (let i = 0; i < data.length; i++) {
      data[i][IDX_COL] = data[i][pkCol].toString();
    }

    nextRow = firstRow + data.length;
    apex.debug.info(`next row is ${nextRow}`);

    if (amountOfRows > data.length) {
      apex.debug.info(
        `Less received than requested from oracle => end reached`
      );
      fetchedAllDbRows = true;
    }

    if (boolCols.length > 0) {
      apex.debug.info(`Converting bool cols (${boolCols.join(', ')})`);

      data = arrayNumToBool(data, boolCols);
    }

    return data;
  } catch (err) {
    apex.debug.error(
      `Error fetching data from region #${regionId}. Err => ${JSON.stringify(
        err
      )}, ${err}`
    );

    return [];
  } finally {
    currentlyFetching = false;
  }
}

export default fetchData;
