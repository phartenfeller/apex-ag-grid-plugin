/* global apex */

class HtmlRenderer {
  init(params) {
    console.log('init', params);
    this.template = params.template;

    this.params = params;

    this.div = document.createElement('div');

    if (!this.template) {
      return;
    }
    const { id } = params.node;
    if (!id) {
      return;
    }
    console.log('id', id);
    const row = params.api.getRowNode(id);
    console.log('row', row);

    const content = apex.util.applyTemplate(this.template, {
      placeholders: row.data,
    });
    console.log('content', content);
    this.div.innerHTML = content;
  }

  getGui() {
    return this.div;
  }
}

export default HtmlRenderer;
