/* Source: https://blog.ag-grid.com/binding-boolean-values-to-checkboxes-in-ag-grid/ */

class CheckboxRenderer {
  init(params) {
    this.params = params;

    this.outerDiv = document.createElement('div');
    this.outerDiv.classList.add('apex-item-checkbox');

    const innerDiv = document.createElement('div');
    innerDiv.classList.add('apex-item-option');

    this.outerDiv.appendChild(innerDiv);

    this.checkBox = document.createElement('input');
    this.checkBox.type = 'checkbox';
    this.checkBox.checked = params.value;

    this.checkedHandler = this.checkedHandler.bind(this);
    this.checkBox.addEventListener('click', this.checkedHandler);

    innerDiv.appendChild(this.checkBox);
  }

  checkedHandler(e) {
    const { checked } = e.target;
    const { colId } = this.params.column;
    this.params.node.setDataValue(colId, checked);
  }

  getGui() {
    return this.outerDiv;
  }

  destroy() {
    this.checkBox.removeEventListener('click', this.checkedHandler);
  }
}

export default CheckboxRenderer;
