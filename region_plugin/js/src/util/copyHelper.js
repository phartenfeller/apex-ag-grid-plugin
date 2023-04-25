import { COPY_INDICATOR_CLASS, PASTE_INDICATOR_CLASS } from '../constants';

let lastRowId;
let lastColId;

export function getLastCopiedColId() {
  return lastColId;
}

export function clearCopyIndicator(regionId) {
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

export function getClipboardText() {
  return navigator.clipboard.readText();
}

export function markPaste(ele) {
  ele.classList.add(PASTE_INDICATOR_CLASS);
  setTimeout(() => {
    ele.classList.remove(PASTE_INDICATOR_CLASS);
  }, 250);
}
