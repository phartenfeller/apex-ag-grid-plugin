// function getIsMac() {
//   if (typeof navigator === 'undefined') {
//     return false;
//   }

//   if (typeof navigator.platform === 'undefined') {
//     if (typeof navigator.userAgent === 'undefined') {
//       return false;
//     }

//     return navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
//   }

//   return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
// }

// currently ag grid does not forward any event with mac command...
const isMac = false; // getIsMac();

function getOsModifierObject() {
  return isMac ? 'metaKey' : 'ctrlKey';
}

export function getCopyShortcutText() {
  return isMac ? '⌘+C' : 'Ctrl+C';
}

export function isCopyKeyCombo(e) {
  const mod = getOsModifierObject();
  return e.key === 'c' && e[mod] === true;
}

export function getPasteShortcutText() {
  return isMac ? '⌘+V' : 'Ctrl+V';
}

export function isPasteKeyCombo(e) {
  const mod = getOsModifierObject();
  return e.key === 'v' && e[mod] === true;
}
