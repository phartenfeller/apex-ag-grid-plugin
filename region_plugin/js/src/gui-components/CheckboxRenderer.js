/* global apex */
/* Source: https://blog.ag-grid.com/binding-boolean-values-to-checkboxes-in-ag-grid/ */

class CheckboxRenderer {
  init(params) {
    try {
      this.disabled = params.disabled;

      this.params = params;

      this.checkBox = document.createElement('input');
      this.checkBox.type = 'checkbox';
      this.checkBox.classList.add('xag-checkbox');
      this.checkBox.checked = params.value;
      if (this.disabled) {
        this.checkBox.disabled = true;
      }

      this.checkedHandler = this.checkedHandler.bind(this);
      this.keyPressHandler = this.keyPressHandler.bind(this);

      if (!this.disabled) {
        this.checkBox.addEventListener('click', this.checkedHandler);
        params.eParentOfValue.addEventListener(
          'keypress',
          this.keyPressHandler
        );
      }
    } catch (e) {
      apex.debug.error(`Could not init CheckboxRenderer`, e);
    }
  }

  keyPressHandler(e) {
    if (e.key === 'Enter') {
      this.checkBox.click();
    }
  }

  checkedHandler(e) {
    try {
      const { checked } = e.target;
      const { colId } = this.params.column;
      this.params.node.setDataValue(colId, checked);
    } catch (err) {
      apex.debug.error(
        `Could not handle checked event in CheckboxRenderer`,
        err
      );
    }
  }

  getGui() {
    return this.checkBox;
  }

  destroy() {
    try {
      if (!this.disabled) {
        this.checkBox.removeEventListener('click', this.checkedHandler);
        this.params.eParentOfValue.addEventListener(
          'keypress',
          this.keyPressHandler
        );
      }
    } catch (e) {
      apex.debug.error(`Could not destroy CheckboxRenderer`, e);
    }
  }
}

export default CheckboxRenderer;
