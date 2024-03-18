// import 'web-complete/dist/web-complete';
import 'web-complete/dist/web-complete/web-complete.esm.js';

export default class PopupLovEditor {
  value;

  input;

  init(params) {
    this.colId = params.colId;
    this.value = params.data[this.colId];
    this.regionId = params.regionId;
    this.lov = params.lov;
    const elId = `${this.regionId}-${this.colId}-web-complete`;
    this.inputId = `${this.regionId}-${this.colId}-input`;

    window.apex.debug.trace(`[PopupLovEditor] init`, params);

    this.webCompleteEl = document.createElement('web-complete');
    // this.input.classList.add('doubling-input');
    this.webCompleteEl.id = elId;
    this.webCompleteEl.inputId = this.inputId;
    this.webCompleteEl.cssClasses = {
      wrapper: 'dropdown',
      input: 'form-control',
      suggestions: 'dropdown-menu show',
      suggestion: 'dropdown-item',
      active: 'active',
    };
    this.webCompleteEl.tabIndex = 0; // to allow the div to capture events

    this.webCompleteEl.placeholder = 'Type to search...';

    this.webCompleteEl.suggestionGenerator = (text) =>
      new Promise((resolve, reject) => {
        const filteredValues = this.lov.filter((v) =>
          v.text.toLowerCase().includes(text.toLowerCase())
        );

        resolve(filteredValues);
      });

    this.webCompleteEl.value = this.value;
    this.webCompleteEl.text = params.formatValue(this.value);

    this.webCompleteEl.addEventListener('selected', (e) => {
      window.apex.debug.trace(`[PopupLovEditor] selected`, e.detail);
      this.value = e.detail.value;
      params.stopEditing();
    });
    this.webCompleteEl.addEventListener('unselected', (e) => {
      window.apex.debug.trace(`[PopupLovEditor] unselected`, e.detail);
      this.value = null;
    });

    this.webCompleteEl.addEventListener('keydown', (event) => {
      const { key } = event;

      if (key === 'Enter') {
        // this stops the grid from receiving the event and executing keyboard navigation
        event.stopPropagation();
      }
    });

    window.apex.debug.trace(
      `[PopupLovEditor] webCompleteEl`,
      this.webCompleteEl
    );
  }

  /* Component Editor Lifecycle methods */
  // gets called once when grid ready to insert the element
  getGui() {
    return this.webCompleteEl;
  }

  // the final value to send to the grid, on completion of editing
  getValue() {
    // this simple editor doubles any value entered into the input
    return this.value;
  }

  // Gets called once before editing starts, to give editor a chance to
  // cancel the editing before it even starts.
  isCancelBeforeStart() {
    return false;
  }

  // Gets called once when editing is finished (eg if Enter is pressed).
  // If you return true, then the result of the edit will be ignored.
  // isCancelAfterEnd() {
  // our editor will reject any value greater than 1000
  //   return this.value > 1000;
  // }

  // after this component has been created and inserted into the grid
  afterGuiAttached() {
    setTimeout(() => {
      document.getElementById(this.inputId).focus();
    }, 100);
    // this.webCompleteEl.focus();
  }
}
