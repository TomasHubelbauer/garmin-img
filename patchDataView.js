DataView.prototype.getUint24 = function (byteOffset, littleEndian) {
  if (littleEndian !== true) {
    throw new Error('Non-little endian is not implementd yet');
  }

  const dataView = new DataView(new ArrayBuffer(4));
  dataView.setUint8(0, this.getUint8(byteOffset));
  dataView.setUint8(1, this.getUint8(byteOffset + 1));
  dataView.setUint8(2, this.getUint8(byteOffset + 2));
  return dataView.getUint32(0, littleEndian);
};
