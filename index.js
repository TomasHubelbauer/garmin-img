window.addEventListener('load', async () => {
  // https://download.bbbike.org/osm/bbbike/Prag/
  // https://github.com/jerome077/gpsvp/blob/master/doc/imgformat.pdf
  const response = await fetch('Prag.img');
  const arrayBuffer = await response.arrayBuffer();
  const dataView = new DataView(arrayBuffer);
  const garminImg = new GarminImg(dataView);
  document.body.textContent = JSON.stringify(garminImg.files.filter(f => f.type === 'LBL'), null, 2);
});
