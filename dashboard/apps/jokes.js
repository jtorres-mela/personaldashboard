export function setupJokesApp() {
  const jokeText = document.getElementById('jokeText');
  const jokeBtn = document.getElementById('jokeBtn');
  const jokeStatus = document.getElementById('jokeStatus');
  if (!jokeText || !jokeBtn || !jokeStatus) return null;

  let controller = null;

  const setStatus = (msg) => {
    jokeStatus.textContent = msg;
    if (msg) setTimeout(() => { if (jokeStatus.textContent === msg) jokeStatus.textContent = ''; }, 1400);
  };

  const loadJoke = async () => {
    try {
      controller?.abort();
      controller = new AbortController();
      jokeBtn.disabled = true;
      setStatus('Loading...');
      const res = await fetch('https://icanhazdadjoke.com/', {
        headers: { Accept: 'application/json', 'User-Agent': 'Dashboard (demo)' },
        signal: controller.signal
      });
      const data = await res.json();
      jokeText.textContent = data.joke || 'No joke found.';
      setStatus('Got one!');
    } catch (err) {
      if (err.name === 'AbortError') return;
      jokeText.textContent = 'Could not load a joke right now.';
      setStatus('Error');
    } finally {
      jokeBtn.disabled = false;
    }
  };

  jokeBtn.addEventListener('click', loadJoke);
  loadJoke();

  return () => controller?.abort();
}
