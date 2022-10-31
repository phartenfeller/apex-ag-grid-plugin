/* Source: https://blog.ag-grid.com/binding-boolean-values-to-checkboxes-in-ag-grid/ */

class CheckboxRenderer {
  init(params) {
    this.disabled = params.disabled;

    this.params = params;

    this.checkBox = document.createElement('input');
    this.checkBox.type = 'checkbox';
    this.checkBox.checked = params.value;
    if (this.disabled) {
      this.checkBox.disabled = true;
    }

    this.checkedHandler = this.checkedHandler.bind(this);

    if (!this.disabled) {
      this.checkBox.addEventListener('click', this.checkedHandler);
    }
  }

  checkedHandler(e) {
    const { checked } = e.target;
    const { colId } = this.params.column;
    this.params.node.setDataValue(colId, checked);
  }

  getGui() {
    return this.checkBox;
  }

  destroy() {
    if (!this.disabled) {
      this.checkBox.removeEventListener('click', this.checkedHandler);
    }
  }
}

export default CheckboxRenderer;
