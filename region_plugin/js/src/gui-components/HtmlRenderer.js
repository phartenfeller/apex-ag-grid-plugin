/* global apex */

class HtmlRenderer {
  init(params) {
    try {
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
    } catch (e) {
      apex.debug.error(`Could not init HtmlRenderer`, e);
    }
  }

  applyHtml(id) {
    try {
      const row = this.params.api.getRowNode(id);
      const content = apex.util.applyTemplate(this.template, {
        placeholders: row.data,
      });
      this.div.innerHTML = content;
    } catch (e) {
      apex.debug.warn(
        `Could not apply html template for column "${this.params.colDef.colId}" and rowId "${this.params.node.id}": ${e} \n\n Template: ${this.template}`
      );
    }
  }

  getGui() {
    return this.div;
  }

  refresh(params) {
    try {
      const { id } = params.node;
      if (!id) {
        return false;
      }
      this.applyHtml(id);
      return true;
    } catch (e) {
      apex.debug.error(`Could not refresh HtmlRenderer`, e);
      return false;
    }
  }
}

export default HtmlRenderer;
