/******/ (() => { // webpackBootstrap
var __webpack_exports__ = {};
/*!**********************!*\
  !*** ./src/index.js ***!
  \**********************/
const template = document.createElement('template');
template.innerHTML = `
  <style>
  </style>
  <span class="change-me"></span>
`;

class MyComponent extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));
  }

  connectedCallback() {
    this.text = this.getAttribute('text');
    this.shadowRoot.querySelector('.change-me').innerHTML = this.text;
  }
}

window.customElements.define('my-component', MyComponent);

/******/ })()
;
//# sourceMappingURL=index.js.map