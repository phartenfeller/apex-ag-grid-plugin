import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model';
import { Grid, ModuleRegistry } from '@ag-grid-community/core';

import '@ag-grid-community/core/dist/styles/ag-grid.css';
import '@ag-grid-community/core/dist/styles/ag-theme-alpine.css';

ModuleRegistry.registerModules([ClientSideRowModelModule]);

export default function getGrid() {
  return Grid;
}
