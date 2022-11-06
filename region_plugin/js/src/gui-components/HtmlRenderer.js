/* global apex */

class HtmlRenderer {
  init(params) {
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
    this.applyHtml(id);
  }

  applyHtml(id) {
    const row = this.params.api.getRowNode(id);
    const content = apex.util.applyTemplate(this.template, {
      placeholders: row.data,
    });
    this.div.innerHTML = content;
  }

  getGui() {
    return this.div;
  }

  refresh(params) {
    const { id } = params.node;
    if (!id) {
      return false;
    }
    this.applyHtml(id);
    return true;
  }
}

export default HtmlRenderer;
