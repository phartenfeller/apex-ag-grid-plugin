import { COPY_INDICATOR_CLASS } from '../constants';

let lastRowId;
let lastColId;

function clearCopyIndicator(regionId) {
  document
    .querySelectorAll(`#${regionId} .ag-row .${COPY_INDICATOR_CLASS}`)
    .forEach((el) => {
      el.classList.remove(COPY_INDICATOR_CLASS);
    });
}

export function copyValue({
  value,
  rowId,
  colId,
  clickedColElement,
  regionId,
}) {
  lastRowId = rowId;
  lastColId = colId;

  navigator.clipboard.writeText(value);

  clearCopyIndicator(regionId);
  clickedColElement.classList.add(COPY_INDICATOR_CLASS);
}

export function getLastCopiedInfo() {
  return {
    lastRowId,
    lastColId,
  };
}
