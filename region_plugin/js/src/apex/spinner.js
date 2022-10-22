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
