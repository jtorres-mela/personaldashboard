(function setRandomBackground() {
  const backgrounds = [
    'https://images.pexels.com/photos/417173/pexels-photo-417173.jpeg',
    'https://images.pexels.com/photos/552785/pexels-photo-552785.jpeg',
    'https://images.pexels.com/photos/3408744/pexels-photo-3408744.jpeg',
    'https://images.pexels.com/photos/547114/pexels-photo-547114.jpeg',
    'https://images.pexels.com/photos/460621/pexels-photo-460621.jpeg'
  ];

  const randomImage = backgrounds[Math.floor(Math.random() * backgrounds.length)];
  document.body.style.backgroundImage = `url('${randomImage}')`;
})();



const imageInput = document.getElementById('imageInput');
const dropzone = document.getElementById('dropzone');
const fileList = document.getElementById('fileList');
const compressBtn = document.getElementById('compressBtn');
const status = document.getElementById('status');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');

let selectedFiles = [];

// Handle file selection
dropzone.addEventListener('click', () => imageInput.click());
imageInput.addEventListener('change', (e) => handleFiles(e.target.files));

// Drag and drop functionality
dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});

dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('dragover');
});

dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  handleFiles(e.dataTransfer.files);
});

function handleFiles(files) {
  selectedFiles = [...files].filter(file => file.type.startsWith('image/'));
  displayFileList();
  compressBtn.disabled = selectedFiles.length === 0;
}

function displayFileList() {
  fileList.innerHTML = '';
  if (selectedFiles.length === 0) return;

  selectedFiles.forEach(file => {
    const sizeKB = (file.size / 1024).toFixed(1);
    const item = document.createElement('div');
    item.textContent = `📄 ${file.name} – ${sizeKB} KB`;
    fileList.appendChild(item);
  });
}

compressBtn.addEventListener('click', async () => {
  if (selectedFiles.length === 0) return;

  compressBtn.disabled = true;
  status.textContent = '';
  progressContainer.style.display = 'block';
  progressBar.style.width = '0%';

  const zip = new JSZip();

  for (let i = 0; i < selectedFiles.length; i++) {
    const file = selectedFiles[i];
    const isPNG = file.type === 'image/png';
    const targetSizeKB = isPNG ? 1000 : 700;
    const originalSizeKB = file.size / 1024;

    if (originalSizeKB <= targetSizeKB) {
      status.innerHTML += `⚠️ ${file.name} already under target size (${originalSizeKB.toFixed(1)} KB), skipping compression<br>`;
      zip.file(`compressed_${file.name}`, file);
      updateProgress(i + 1, selectedFiles.length);
      continue;
    }

    const options = {
      maxSizeMB: targetSizeKB / 1024,
      maxWidthOrHeight: 2000,
      useWebWorker: true,
      fileType: file.type
    };

    try {
      const compressedFile = await imageCompression(file, options);
      const blob = new Blob([compressedFile], { type: compressedFile.type });
      const compressedSizeKB = blob.size / 1024;
      zip.file(`compressed_${file.name}`, blob);
      status.innerHTML += `✔️ ${file.name} compressed from ${originalSizeKB.toFixed(1)} KB to ${compressedSizeKB.toFixed(1)} KB<br>`;
    } catch (err) {
      status.innerHTML += `❌ Failed to compress ${file.name}: ${err.message}<br>`;
    }

    updateProgress(i + 1, selectedFiles.length);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(content);
  link.download = 'compressed_images.zip';
  link.click();

  status.innerHTML += '<br>✅ All done! ZIP download started.';
  compressBtn.disabled = false;
  progressContainer.style.display = 'none';
});

function updateProgress(current, total) {
  const percent = Math.round((current / total) * 100);
  progressBar.style.width = `${percent}%`;
}
