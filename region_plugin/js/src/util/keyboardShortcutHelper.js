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
  return isMac ? { modifier: 'metaKey' } : { modifier: 'ctrlKey' };
}

export function getCopyShortcutText() {
  return isMac ? '⌘+C' : 'Ctrl+C';
}

export function getCopyShortcutKeyCodes() {
  const obj = getOsModifierObject();
  obj.key = 'c';
  return obj;
}

export function getPasteShortcutText() {
  return isMac ? '⌘+V' : 'Ctrl+V';
}

export function getPasteShortcutKeyCodes() {
  const obj = getOsModifierObject();
  obj.key = 'v';
  return obj;
}
