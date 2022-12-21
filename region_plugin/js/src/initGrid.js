import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model';
import { Grid, ModuleRegistry } from '@ag-grid-community/core';
import { InfiniteRowModelModule } from '@ag-grid-community/infinite-row-model';

import '@ag-grid-community/core/dist/styles/ag-grid.css';
import './css/ag-theme-apex.css';
import './css/custom-styles.css';

ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  InfiniteRowModelModule,
]);

export default Grid;
