class GarminRgnSubfile {
  constructor(/** @type{DataView} */ dataView) {
    this.creationYear = dataView.getUint16(0xe, true);
    this.creationMonth = dataView.getUint8(0x10);
    this.creationDay = dataView.getUint8(0x11);
    this.creationHour = dataView.getUint8(0x12);
    this.creationMinute = dataView.getUint8(0x13);
    this.creationSecond = dataView.getUint8(0x14);
    this.dataOffset = dataView.getUint32(0x15, true);
    this.dataLength = dataView.getUint32(0x19, true);
  }
}
