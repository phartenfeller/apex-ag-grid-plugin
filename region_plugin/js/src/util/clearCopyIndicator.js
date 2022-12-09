import { COPY_INDICATOR_CLASS } from '../constants';

function clearCopyIndicator(regionId) {
  document
    .querySelectorAll(`#${regionId} .ag-row .${COPY_INDICATOR_CLASS}`)
    .forEach((el) => {
      el.classList.remove(COPY_INDICATOR_CLASS);
    });
}

export default clearCopyIndicator;
