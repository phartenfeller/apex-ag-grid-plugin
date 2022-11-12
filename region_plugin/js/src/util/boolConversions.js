export function arrayBoolsToNum(arr, boolCols) {
  const changedArr = arr;

  for (let i = 0; i < arr.length; i++) {
    for (let j = 0; j < boolCols.length; j++) {
      changedArr[i][boolCols[j]] = arr[i][boolCols[j]] ? 1 : 0;
    }
  }

  return changedArr;
}

export function arrayNumToBool(arr, boolCols) {
  const changedArr = arr;

  for (let i = 0; i < arr.length; i++) {
    for (let j = 0; j < boolCols.length; j++) {
      changedArr[i][boolCols[j]] = arr[i][boolCols[j]] === 1;
    }
  }

  return changedArr;
}
