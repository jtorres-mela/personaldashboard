(function setRandomBackground() {
  // Mixed set of static landscape images (Unsplash + Pexels).
  const backgrounds = [
    'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1800&q=80',
    'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1800&q=80',
    'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1800&q=80',
    'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1800&q=80',
    'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1800&q=80',
    'https://images.unsplash.com/photo-1439853949127-fa647821eba0?auto=format&fit=crop&w=1800&q=80',
    'https://images.pexels.com/photos/417173/pexels-photo-417173.jpeg',
    'https://images.pexels.com/photos/30489052/pexels-photo-30489052.jpeg',
    'https://images.pexels.com/photos/30644958/pexels-photo-30644958.jpeg',
    'https://images.pexels.com/photos/16528447/pexels-photo-16528447.jpeg',
    'https://images.pexels.com/photos/1287124/pexels-photo-1287124.jpeg',
    'https://images.pexels.com/photos/914682/pexels-photo-914682.jpeg',
    'https://images.pexels.com/photos/3637060/pexels-photo-3637060.jpeg',
    'https://images.pexels.com/photos/5769308/pexels-photo-5769308.jpeg',
    'https://images.pexels.com/photos/552785/pexels-photo-552785.jpeg',
    'https://images.pexels.com/photos/3408744/pexels-photo-3408744.jpeg',
    'https://images.pexels.com/photos/547114/pexels-photo-547114.jpeg',
    'https://images.pexels.com/photos/460621/pexels-photo-460621.jpeg'
  ];

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  document.body.style.backgroundImage = `url('${pick(backgrounds)}')`;
})();
