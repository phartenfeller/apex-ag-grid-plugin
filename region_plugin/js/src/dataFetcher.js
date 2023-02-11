import { ajax, AJAX_DATA } from './apex/ajax';
import { arrayNumToBool } from './util/boolConversions';

let nextRow = 1;
let fetchedAllDbRows = false;

async function fetchData({
  apex,
  ajaxId,
  itemsToSubmit,
  regionId,
  amountOfRows,
  IDX_COL,
  pkCol,
  boolCols,
}) {
  if (fetchedAllDbRows) {
    apex.debug.trace(`All rows fetched from oracle`);
  }

  try {
    const firstRow = nextRow;

    apex.debug.info(`Query from oracle from ${firstRow} #${amountOfRows} rows`);

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
        apex.debug.log(
          `Less received than requested from oracle => end reached`
        );
        fetchedAllDbRows = true;
      }

      if (boolCols.length > 0) {
        apex.debug.info(`Converting bool cols (${this.boolCols.join(', ')})`);

        data = arrayNumToBool(data, this.boolCols);
      }

      return data;
    }
    apex.debug.error(
      `Could not fetch data from region #${
        this.regionId
      }. Res => ${JSON.stringify(dataRes)}`
    );

    return [];
  } catch (err) {
    apex.debug.error(
      `Error fetching data from region #${
        this.regionId
      }. Err => ${JSON.stringify(err)}, ${err}`
    );

    return [];
  }
}

export default fetchData;
